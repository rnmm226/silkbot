import os
import re
import json
import psycopg
import time
import threading
import fitz  # PyMuPDF (fallback)
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
import signal
import gc
from contextlib import contextmanager

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"


# ─────────────────────────────────────────────
# TIMEOUT HANDLER — compatible Windows (pas de SIGALRM)
# ─────────────────────────────────────────────
class TimeoutError(Exception):
    pass


@contextmanager
def time_limit(seconds):
    """Timeout cross-platform : lance un thread watchdog."""
    if seconds <= 0:
        yield
        return
    _done = threading.Event()
    def _watchdog():
        _done.wait(timeout=seconds)
    t = threading.Thread(target=_watchdog, daemon=True)
    t.start()
    try:
        yield
    finally:
        _done.set()
        t.join(timeout=1)


def _run_with_timeout(fn, seconds, *args, **kwargs):
    """Exécute fn(*args, **kwargs) dans un thread séparé avec timeout strict.
    Lève TimeoutError si le délai est dépassé.
    """
    result = [None]
    exc = [None]
    def worker():
        try:
            result[0] = fn(*args, **kwargs)
        except Exception as e:
            exc[0] = e
    t = threading.Thread(target=worker, daemon=True)
    t.start()
    t.join(timeout=seconds)
    if t.is_alive():
        raise TimeoutError(f"Timeout apres {seconds}s")
    if exc[0] is not None:
        raise exc[0]
    return result[0]


# ─────────────────────────────────────────────
# TESSERACT CONFIGURATION
# ─────────────────────────────────────────────
TESSERACT_PATH = r"C:\Users\rnmdr\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"

if os.path.exists(TESSERACT_PATH):
    os.environ['PATH'] = os.path.dirname(TESSERACT_PATH) + os.pathsep + os.environ['PATH']
    print(f"✅ Tesseract found: {TESSERACT_PATH}")
else:
    print(f"⚠️  Tesseract not found at {TESSERACT_PATH}")

import pytesseract

pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH

# ─────────────────────────────────────────────
# POPPLER CONFIGURATION
# ─────────────────────────────────────────────
POPPLER_PATH = r"C:\Users\rnmdr\Downloads\Release-26.02.0-0\poppler-26.02.0\Library\bin"

if os.path.exists(POPPLER_PATH):
    os.environ['PATH'] = POPPLER_PATH + os.pathsep + os.environ['PATH']
    print(f"✅ Poppler configured: {POPPLER_PATH}")
else:
    print(f"❌ Poppler path does not exist: {POPPLER_PATH}")

# ─────────────────────────────────────────────
# CONFIGURATION - OPTIMISÉE POUR GROS VOLUMES
# ─────────────────────────────────────────────
DB_URL = "postgresql://postgres:secret123@localhost:5432/monapp"
FOLDER = "downloaded_pdfs"
PARALLEL_WORKERS = 1  # ⚠️ RÉDUIT À 1 pour éviter les crashes mémoire
CHUNK_SIZE = 150
EMBEDDING_BATCH_SIZE = 32  # Réduit pour moins de mémoire
DOCLING_MAX_SIZE_MB = 3.0  # Réduit: les gros PDFs vont directement à fitz
DOCLING_TIMEOUT = 30  # Réduit à 30s
PDF_EXTRACTION_TIMEOUT = 60  # Timeout global pour l'extraction

# 🔒 CONFIGURATION DE SÉCURITÉ
SAFE_MODE = True
ALLOW_DELETION = False
SKIP_EXISTING = True
BATCH_COMMIT_SIZE = 10  # Commit après N documents
PROGRESS_FILE = "indexation_progress.json"  # Fichier de reprise

# ─────────────────────────────────────────────
# FIX WINDOWS UNICODE FILENAME ISSUES
# ─────────────────────────────────────────────
import tempfile
import shutil


def get_safe_pdf_path(filepath):
    try:
        filepath.encode('ascii')
        with open(filepath, 'rb') as f:
            pass
        return filepath, False
    except (UnicodeEncodeError, UnicodeDecodeError, OSError, FileNotFoundError):
        temp_fd, temp_path = tempfile.mkstemp(suffix='.pdf', prefix='pdf_')
        os.close(temp_fd)
        shutil.copy2(filepath, temp_path)
        return temp_path, True


# Modèle partagé entre les threads
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
db_lock = threading.Lock()

# ─────────────────────────────────────────────
# GESTION DE LA REPRISE (PROGRESS FILE)
# ─────────────────────────────────────────────
progress_lock = threading.Lock()

def load_progress():
    """Charge les fichiers déjà traités (succès ET échecs) depuis le fichier de reprise."""
    if not os.path.exists(PROGRESS_FILE):
        return set()
    try:
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return set(data.get('processed', []))
    except Exception:
        return set()

def save_progress(filename, status):
    """Ajoute un fichier traité dans le fichier de reprise."""
    with progress_lock:
        processed = load_progress()
        processed.add(filename)
        try:
            with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
                json.dump({'processed': list(processed)}, f, ensure_ascii=False)
        except Exception:
            pass

# ─────────────────────────────────────────────
# DOCLING — une instance par thread via thread-local
# ─────────────────────────────────────────────
_thread_local = threading.local()


def get_converter():
    if not hasattr(_thread_local, "converter"):
        opts = PdfPipelineOptions()
        opts.do_ocr = False
        opts.do_table_structure = False
        # Désactiver les fonctionnalités lourdes
        opts.do_ocr = False
        opts.do_table_structure = False
        _thread_local.converter = DocumentConverter(
            format_options={"pdf": PdfFormatOption(pipeline_options=opts)}
        )
    return _thread_local.converter


# ─────────────────────────────────────────────
# UTILITAIRES TEXTE
# ─────────────────────────────────────────────
def chunk_text_by_words(text, chunk_size=CHUNK_SIZE):
    words = text.split()
    if not words:
        return []
    return [" ".join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size)]


def extract_article_number(text):
    patterns = [
        r'Art\.?\s*(\d+)[^\d]',
        r'Article\s*(\d+)[^\d]',
        r'[\(\[][Aa]rt\.?\s*(\d+)[\)\]]',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def generate_tags(content, filename):
    tags = []
    year_match = re.search(r'(20\d{2})', filename)
    if year_match:
        tags.append(f"year_{year_match.group(1)}")
    file_lower = filename.lower()
    if 'code' in file_lower:
        tags.append('code')
    if 'note commune' in file_lower or 'note-commune' in file_lower:
        tags.append('note_commune')
    if 'loi de finances' in file_lower or 'loi-des-finances' in file_lower:
        tags.append('loi_finances')
    if 'convention' in file_lower:
        tags.append('convention')
    if 'recueil' in file_lower:
        tags.append('recueil')
    content_lower = content.lower()[:2000]
    keywords = {
        'fiscal': ['fiscal', 'impôt', 'taxe', 'tva', 'irpp', 'is'],
        'investissement': ['investissement', 'incitation', 'prime', 'avantage'],
        'procedure': ['procédure', 'déclaration', 'recouvrement', 'contrôle'],
        'social': ['social', 'solidarité', 'cotisation'],
    }
    for category, cat_keywords in keywords.items():
        if any(kw in content_lower for kw in cat_keywords):
            tags.append(category)
    return list(set(tags))


# ─────────────────────────────────────────────
# EXTRACTION PDF - VERSION ROBUSTE
# ─────────────────────────────────────────────
def extract_with_docling(filepath, timeout=DOCLING_TIMEOUT):
    """Extraction avec Docling et timeout"""
    result = {'text': None, 'num_pages': 0, 'error': None}

    def worker():
        try:
            converter = get_converter()
            doc_result = converter.convert(filepath)
            result['text'] = doc_result.document.export_to_markdown()
            # Estimer le nombre de pages
            if hasattr(doc_result.document, 'pages'):
                result['num_pages'] = len(doc_result.document.pages)
            else:
                # Fallback: essayer d'ouvrir avec fitz pour le nombre de pages
                try:
                    doc = fitz.open(filepath)
                    result['num_pages'] = len(doc)
                    doc.close()
                except:
                    result['num_pages'] = 1
        except Exception as e:
            result['error'] = str(e)

    t = threading.Thread(target=worker)
    t.start()
    t.join(timeout=timeout)

    if t.is_alive():
        return None, 0, f"Timeout après {timeout}s"
    if result['error']:
        return None, 0, result['error']
    if not result['text'] or len(result['text'].strip()) < 50:
        return None, 0, "Texte trop court ou vide"
    return result['text'], result['num_pages'], None


def extract_with_fitz(filepath):
    """Extraction avec PyMuPDF (fitz)"""
    try:
        doc = fitz.open(filepath)
        total_pages = len(doc)
        pages_text = []

        # Limiter le nombre de pages pour les PDFs géants
        max_pages = min(total_pages, 500)

        for page_num in range(max_pages):
            try:
                page = doc[page_num]
                text = page.get_text().strip()
                if text:
                    pages_text.append(text)
            except Exception as e:
                # Ignorer les erreurs de page individuelle
                continue

        doc.close()

        if not pages_text:
            return None, 0, "Aucun texte extrait avec fitz"

        full_text = "\n".join(pages_text)
        return full_text, len(pages_text), None
    except Exception as e:
        return None, 0, f"Erreur fitz: {e}"


def is_valid_pdf(filepath):
    try:
        with open(filepath, 'rb') as f:
            header = f.read(5)
            if header != b'%PDF-':
                return False
            # Vérifier rapidement EOF
            try:
                f.seek(-20, 2)
                tail = f.read()
                return b'%%EOF' in tail
            except:
                # Si le fichier est trop petit, le considérer comme valide
                return True
    except:
        return False


def extract_with_ocr(filepath):
    """Extraction OCR avec Tesseract"""
    try:
        from pdf2image import convert_from_path

        # Limiter le nombre de pages OCR
        max_ocr_pages = 50
        images = convert_from_path(filepath, dpi=150, poppler_path=POPPLER_PATH, first_page=1, last_page=max_ocr_pages)

        pages_text = []
        for img in images:
            try:
                text = pytesseract.image_to_string(img, lang='fra')
                if text.strip():
                    pages_text.append(text.strip())
                else:
                    # Essayer en arabe
                    text = pytesseract.image_to_string(img, lang='ara')
                    if text.strip():
                        pages_text.append(text.strip())
            except Exception as e:
                continue

        if not pages_text:
            return None, 0, "OCR: aucun texte"
        return "\n".join(pages_text), len(pages_text), None
    except Exception as e:
        return None, 0, f"Erreur OCR: {e}"


def extract_from_pdf(filepath):
    """Extraction robuste avec fallback"""
    safe_path, is_temp = get_safe_pdf_path(filepath)

    if not os.path.exists(safe_path):
        return None, 0, "Fichier inexistant"

    if not is_valid_pdf(safe_path):
        return None, 0, "PDF invalide"

    try:
        size_mb = os.path.getsize(safe_path) / (1024 * 1024)

        # Stratégie: d'abord fitz pour les gros fichiers, docling pour les petits
        if size_mb > DOCLING_MAX_SIZE_MB:
            text, num_pages, error = extract_with_fitz(safe_path)
            if text and len(text.strip()) > 100:
                return text, num_pages, None

            # Si fitz échoue, essayer OCR
            text, num_pages, error = extract_with_ocr(safe_path)
            if text and len(text.strip()) > 100:
                return text, num_pages, None
            return None, 0, error or "Extraction impossible"

        # Petit fichier: d'abord Docling
        text, num_pages, error = extract_with_docling(safe_path)
        if text and len(text.strip()) > 100:
            return text, num_pages, None

        # Docling échoue -> fitz
        text, num_pages, error = extract_with_fitz(safe_path)
        if text and len(text.strip()) > 100:
            return text, num_pages, None

        # Fitz échoue -> OCR
        text, num_pages, error = extract_with_ocr(safe_path)
        if text and len(text.strip()) > 100:
            return text, num_pages, None

        return None, 0, error or "Extraction impossible"

    except Exception as e:
        return None, 0, f"Erreur extraction: {e}"
    finally:
        if is_temp and safe_path and os.path.exists(safe_path):
            try:
                os.unlink(safe_path)
            except:
                pass
        # Forcer le garbage collection
        gc.collect()


# ─────────────────────────────────────────────
# INSERTION EN BASE - AVEC BATCH
# ─────────────────────────────────────────────
def insert_document(conn, result):
    """Insère un nouveau document seulement s'il n'existe pas"""
    cur = conn.cursor()
    try:
        # Vérifier si le document existe déjà
        cur.execute('SELECT id FROM "SourceDocument" WHERE content = %s', (result['filename'],))
        existing = cur.fetchone()

        if existing:
            return 0  # Ignoré

        # Nouveau document
        cur.execute(
            'INSERT INTO "SourceDocument" (id, content, created_at) '
            'VALUES (gen_random_uuid(), %s, now()) RETURNING id',
            (result['filename'],)
        )
        doc_id = cur.fetchone()[0]

        # Vérifier la colonne article_number
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name='SourceDocumentSegment' AND column_name='article_number'
        """)
        has_article_number = cur.fetchone() is not None

        # Insérer les chunks en batch
        if has_article_number:
            chunk_rows = [
                (
                    chunk['text'],
                    doc_id,
                    json.dumps(chunk['embedding']),
                    chunk['chunk_index'],
                    chunk['page_number'],
                    chunk['tags'],
                    chunk['article_number'],
                )
                for chunk in result['chunks']
            ]
            cur.executemany(
                '''INSERT INTO "SourceDocumentSegment"
                   (id, content, "sourceDocumentid", vector, "createdAt",
                    chunk_index, page_number, tags, article_number)
                   VALUES (gen_random_uuid(), %s, %s, %s::vector, now(), %s, %s, %s, %s)''',
                chunk_rows,
            )
        else:
            chunk_rows = [
                (
                    chunk['text'],
                    doc_id,
                    json.dumps(chunk['embedding']),
                    chunk['chunk_index'],
                    chunk['page_number'],
                    json.dumps(chunk['tags']),
                )
                for chunk in result['chunks']
            ]
            cur.executemany(
                '''INSERT INTO "SourceDocumentSegment"
                   (id, content, "sourceDocumentid", vector, "createdAt",
                    chunk_index, page_number, tags, article_number)
                   VALUES (gen_random_uuid(), %s, %s, %s::vector, now(), %s, %s, %s, 0)''',
                chunk_rows,
            )

        conn.commit()
        return len(result['chunks'])

    except Exception as e:
        conn.rollback()
        print(f"  ❌ Erreur insertion: {e}")
        return 0
    finally:
        cur.close()


# ─────────────────────────────────────────────
# TRAITEMENT D'UN SEUL PDF - OPTIMISÉ
# ─────────────────────────────────────────────
def process_and_insert(pdf_info, conn, log_buf: deque):
    """Extrait, encode et insère UNIQUEMENT les nouveaux PDFs"""
    filename = pdf_info['filename']
    filepath = pdf_info['path']
    relative_path = pdf_info['relative_path']

    def log(msg):
        log_buf.append(msg)

    # Vérification rapide en DB
    cur = conn.cursor()
    cur.execute('SELECT id FROM "SourceDocument" WHERE content = %s', (filename,))
    exists = cur.fetchone() is not None
    cur.close()

    if exists and SKIP_EXISTING:
        save_progress(filename, 'skipped')
        return True, 0, 'skipped'

    try:
        # Extraction avec timeout global (thread-based, compatible Windows)
        full_text, num_pages, error = _run_with_timeout(
            extract_from_pdf, PDF_EXTRACTION_TIMEOUT, filepath
        )

        if error or not full_text:
            log(f"❌ {filename[:60]}: {error or 'Aucun texte'}")
            save_progress(filename, 'error')
            return False, 0, 'error'

        chunks_text = chunk_text_by_words(full_text)
        if not chunks_text:
            log(f"❌ {filename[:60]}: Aucun chunk généré")
            save_progress(filename, 'error')
            return False, 0, 'error'

        # Embeddings par batch
        embeddings = []
        for i in range(0, len(chunks_text), EMBEDDING_BATCH_SIZE):
            batch = chunks_text[i:i + EMBEDDING_BATCH_SIZE]
            try:
                batch_embeddings = embedding_model.encode(batch, show_progress_bar=False)
                embeddings.extend(batch_embeddings)
            except Exception as e:
                log(f"⚠️ {filename[:50]}: erreur embedding batch — {e}")
                continue
            gc.collect()

        if len(embeddings) != len(chunks_text):
            chunks_text = chunks_text[:len(embeddings)]

        chunks = []
        for idx, (chunk, emb) in enumerate(zip(chunks_text, embeddings)):
            chunks.append({
                'text': chunk,
                'embedding': emb.tolist(),
                'chunk_index': idx,
                'page_number': min((idx * CHUNK_SIZE // 500) + 1, num_pages or 1),
                'tags': generate_tags(chunk, filename),
                'article_number': extract_article_number(chunk),
            })

        result = {
            'filename': filename,
            'relative_path': relative_path,
            'num_pages': num_pages or 1,
            'chunks': chunks,
        }

        with db_lock:
            inserted = insert_document(conn, result)

        if inserted > 0:
            log(f"✅ {relative_path[:65]} → {inserted} chunks")
        save_progress(filename, 'inserted')
        return True, inserted, 'inserted'

    except TimeoutError:
        log(f"⏱️ {filename[:60]}: timeout global ({PDF_EXTRACTION_TIMEOUT}s)")
        save_progress(filename, 'timeout')
        return False, 0, 'timeout'
    except MemoryError:
        log(f"💾 {filename[:60]}: mémoire insuffisante")
        gc.collect()
        save_progress(filename, 'memory')
        return False, 0, 'memory'
    except Exception as e:
        log(f"❌ {filename[:60]}: {e}")
        save_progress(filename, 'error')
        return False, 0, 'error'


# ─────────────────────────────────────────────
# GESTION DES FICHIERS
# ─────────────────────────────────────────────
def get_pdf_files_recursive(folder):
    pdf_files = []
    for root, _, files in os.walk(folder):
        for file in files:
            if file.endswith('.pdf'):
                filepath = os.path.join(root, file)
                try:
                    size = os.path.getsize(filepath)
                    pdf_files.append({
                        'filename': file,
                        'path': filepath,
                        'relative_path': os.path.relpath(filepath, folder),
                        'size': size,
                    })
                except:
                    continue
    # Trier par taille (petits d'abord)
    pdf_files.sort(key=lambda x: x['size'])
    return pdf_files


def get_already_indexed(conn):
    cur = conn.cursor()
    cur.execute('SELECT content FROM "SourceDocument"')
    rows = cur.fetchall()
    cur.close()
    return {r[0] for r in rows}


def get_new_files_only(conn):
    pdf_files = get_pdf_files_recursive(FOLDER)
    indexed = get_already_indexed(conn)
    new_files = [info for info in pdf_files if info['filename'] not in indexed]
    return new_files


def show_indexation_status(conn):
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM "SourceDocument"')
    total = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM "SourceDocumentSegment"')
    segments = cur.fetchone()[0]
    cur.close()
    return total, segments


# ─────────────────────────────────────────────
# POINT D'ENTRÉE PRINCIPAL
# ─────────────────────────────────────────────
def _render_log_block(log_buf: deque, width: int = 80):
    """Affiche les N dernières lignes de log sous la barre tqdm."""
    lines = list(log_buf)
    print("")  # sauter la ligne de la barre
    for line in lines:
        # tronquer si trop long pour le terminal
        print(f"  {line[:width - 2]}")
    # remonter le curseur pour écraser au prochain appel
    # (+1 pour la ligne vide au-dessus)
    up = len(lines) + 1
    print(f"\033[{up}A", end="", flush=True)


def index_documents():
    if not os.path.exists(FOLDER):
        print(f"❌ Le dossier {FOLDER} n'existe pas!")
        return

    print("\n" + "=" * 60)
    print("📚 INDEXATION OPTIMISÉE - NOUVEAUX UNIQUEMENT")
    print("=" * 60)
    print(f"📁 Dossier      : {FOLDER}")
    print(f"🔄 Workers      : {PARALLEL_WORKERS}")
    print(f"⏱️  Timeout      : Docling {DOCLING_TIMEOUT}s / global {PDF_EXTRACTION_TIMEOUT}s")
    print(f"📂 Progress file: {PROGRESS_FILE}")
    print("=" * 60 + "\n")

    try:
        conn = psycopg.connect(DB_URL)
        print("✅ Connecté à la base de données")
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")
        return

    # Statut actuel
    total_docs, total_segments = show_indexation_status(conn)
    print(f"📊 Déjà indexés : {total_docs} docs / {total_segments} segments\n")

    # Charger les fichiers déjà traités (DB + progress file)
    already_done = load_progress()

    # Tous les PDFs du dossier
    all_pdfs = get_pdf_files_recursive(FOLDER)
    # Exclure ceux déjà en DB OU déjà dans le progress file
    indexed_in_db = get_already_indexed(conn)
    files_to_index = [
        f for f in all_pdfs
        if f['filename'] not in indexed_in_db and f['filename'] not in already_done
    ]

    if not files_to_index:
        print("✨ Aucun nouveau document à indexer!")
        conn.close()
        return

    skipped_by_progress = len([f for f in all_pdfs if f['filename'] in already_done])
    print(f"📋 {len(all_pdfs)} PDFs trouvés — {len(indexed_in_db)} en DB"
          f"{f', {skipped_by_progress} ignorés (progress file)' if skipped_by_progress else ''}"
          f" → {len(files_to_index)} à traiter\n")

    start_time = time.time()
    total_chunks = 0
    success_count = 0
    skipped_count = 0
    error_count = 0

    # Buffer circulaire: 10 dernières entrées de log
    LOG_LINES = 10
    log_buf: deque = deque(maxlen=LOG_LINES)
    # Réserver de l'espace pour le bloc de log sous la barre
    print("\n" * LOG_LINES, end="")
    print(f"\033[{LOG_LINES + 1}A", end="", flush=True)

    bar_format = (
        "  {l_bar}{bar}| {n_fmt}/{total_fmt} "
        "[{elapsed}<{remaining}, {rate_fmt}] "
        "✅{postfix[ok]} ❌{postfix[err]}"
    )

    with tqdm(
        total=len(files_to_index),
        unit="doc",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}] {postfix}",
        postfix={"✅": 0, "⏭": 0, "❌": 0},
        dynamic_ncols=True,
    ) as pbar:

        with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as executor:
            futures = {
                executor.submit(process_and_insert, pdf, conn, log_buf): pdf
                for pdf in files_to_index
            }

            for future in as_completed(futures):
                ok, chunks, status = future.result()

                if status == 'skipped':
                    skipped_count += 1
                elif status == 'inserted' and ok:
                    success_count += 1
                    total_chunks += chunks
                else:
                    error_count += 1

                pbar.set_postfix({"✅": success_count, "⏭": skipped_count, "❌": error_count})
                pbar.update(1)

                # Redessiner le bloc de log sous la barre
                _render_log_block(log_buf)

                gc.collect()

    # Descendre après le bloc de log
    print(f"\033[{LOG_LINES + 1}B", end="", flush=True)
    print()

    conn.close()
    elapsed = time.time() - start_time

    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ DE L'INDEXATION")
    print("=" * 60)
    print(f"✅ Nouveaux documents indexés : {success_count}")
    print(f"⏭️  Ignorés (déjà traités)    : {skipped_count}")
    print(f"❌ Échecs                     : {error_count}")
    print(f"📦 Total nouveaux chunks      : {total_chunks}")
    print(f"⏱️  Temps total                : {elapsed:.1f}s")
    if success_count > 0:
        print(f"   ({elapsed / success_count:.1f}s/doc en moyenne)")
    print(f"\n💾 Progress sauvegardé dans : {PROGRESS_FILE}")
    print("✨ Indexation terminée!")


if __name__ == "__main__":
    index_documents()