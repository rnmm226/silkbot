import os
import re
import json
import psycopg
import time
import threading
import fitz  # PyMuPDF
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
import gc
import tempfile
import shutil

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"


# ─────────────────────────────────────────────
# TIMEOUT (cross-platform)
# ─────────────────────────────────────────────
class TimeoutError(Exception):
    pass


def _run_with_timeout(fn, seconds, *args, **kwargs):
    result, exc = [None], [None]

    def worker():
        try:
            result[0] = fn(*args, **kwargs)
        except Exception as e:
            exc[0] = e

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    t.join(timeout=seconds)
    if t.is_alive(): raise TimeoutError(f"Timeout apres {seconds}s")
    if exc[0]: raise exc[0]
    return result[0]


# ─────────────────────────────────────────────
# TESSERACT / POPPLER
# ─────────────────────────────────────────────
TESSERACT_PATH = r"C:\Users\rnmdr\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"
POPPLER_PATH = r"C:\Users\rnmdr\Downloads\Release-26.02.0-0\poppler-26.02.0\Library\bin"

if os.path.exists(TESSERACT_PATH):
    os.environ['PATH'] = os.path.dirname(TESSERACT_PATH) + os.pathsep + os.environ['PATH']
    print(f"✅ Tesseract: {TESSERACT_PATH}")
else:
    print(f"⚠️  Tesseract introuvable: {TESSERACT_PATH}")

import pytesseract

pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH

if os.path.exists(POPPLER_PATH):
    os.environ['PATH'] = POPPLER_PATH + os.pathsep + os.environ['PATH']
    print(f"✅ Poppler: {POPPLER_PATH}")
else:
    print(f"❌ Poppler introuvable: {POPPLER_PATH}")

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────
DB_URL = "postgresql://postgres:secret123@localhost:5432/monapp"

# 🔹 TROIS DOSSIERS SOURCES
FOLDERS = {
    "jibaya": "downloaded_pdfs",
    "jort": "downloaded_jort_pdfs",
    "luca_pacioli": "downloaded_pacioli_pdfs",  # NOUVEAU
}

PARALLEL_WORKERS = 2
CHUNK_SIZE = 150
EMBEDDING_BATCH_SIZE = 32
DOCLING_MAX_SIZE_MB = 3.0
DOCLING_TIMEOUT = 30
PDF_EXTRACTION_TIMEOUT = 60

SKIP_EXISTING = True
PROGRESS_FILE = "indexation_progress.json"

# 🔹 MAPPING fichier → URL pour les sources avec lien web (Luca Pacioli) — NOUVEAU
PACIOLI_URL_MAP_FILE = "luca_pacioli_urls.json"


def load_pacioli_url_map():
    if not os.path.exists(PACIOLI_URL_MAP_FILE):
        print(f"⚠️  Mapping URL introuvable: {PACIOLI_URL_MAP_FILE} (les articles Luca Pacioli seront indexés sans source_url)")
        return {}
    try:
        with open(PACIOLI_URL_MAP_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️  Erreur lecture {PACIOLI_URL_MAP_FILE}: {e}")
        return {}


PACIOLI_URL_MAP = load_pacioli_url_map()  # NOUVEAU


# ─────────────────────────────────────────────
# WINDOWS UNICODE FIX
# ─────────────────────────────────────────────
def get_safe_pdf_path(filepath):
    try:
        filepath.encode('ascii')
        with open(filepath, 'rb'):
            pass
        return filepath, False
    except (UnicodeEncodeError, UnicodeDecodeError, OSError, FileNotFoundError):
        fd, tmp = tempfile.mkstemp(suffix='.pdf', prefix='pdf_')
        os.close(fd)
        shutil.copy2(filepath, tmp)
        return tmp, True


# Modèle d'embedding partagé (lecture seule après chargement → safe entre threads)
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# ─────────────────────────────────────────────
# PROGRESS FILE
# ─────────────────────────────────────────────
progress_lock = threading.Lock()


def load_progress():
    if not os.path.exists(PROGRESS_FILE): return set()
    try:
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return set(json.load(f).get('processed', []))
    except Exception:
        return set()


def save_progress(key, status):
    with progress_lock:
        done = load_progress()
        done.add(key)
        try:
            with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
                json.dump({'processed': list(done)}, f, ensure_ascii=False)
        except Exception:
            pass


# ─────────────────────────────────────────────
# DB — UNE CONNEXION PAR THREAD (fix crash mémoire)
# ─────────────────────────────────────────────
_db_local = threading.local()
_all_connections = []
_connections_lock = threading.Lock()


def get_db_connection():
    """Renvoie la connexion psycopg du thread courant, en la créant si besoin.
    Évite qu'une même connexion soit utilisée concurremment par plusieurs threads
    (cause probable du crash 0xC0000005)."""
    if not hasattr(_db_local, "conn"):
        _db_local.conn = psycopg.connect(DB_URL)
        with _connections_lock:
            _all_connections.append(_db_local.conn)
    return _db_local.conn


def close_all_connections():
    with _connections_lock:
        for c in _all_connections:
            try:
                c.close()
            except Exception:
                pass
        _all_connections.clear()


# ─────────────────────────────────────────────
# DOCLING (thread-local)
# ─────────────────────────────────────────────
_thread_local = threading.local()


def get_converter():
    if not hasattr(_thread_local, "converter"):
        opts = PdfPipelineOptions()
        opts.do_ocr = False
        opts.do_table_structure = False
        _thread_local.converter = DocumentConverter(
            format_options={"pdf": PdfFormatOption(pipeline_options=opts)}
        )
    return _thread_local.converter


# ─────────────────────────────────────────────
# CHUNKING
# ─────────────────────────────────────────────
def chunk_text_by_words(text, chunk_size=CHUNK_SIZE):
    words = text.split()
    if not words: return []
    return [" ".join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size)]


# ─────────────────────────────────────────────
# 🔹 DÉTECTION SOURCE + MÉTADONNÉES JURIDIQUES TUNISIENNES
# ─────────────────────────────────────────────
def detect_source(filename, relative_path="", default="autre"):
    s = (relative_path + "/" + filename).lower()
    if 'jibaya' in s or 'note commune' in s or 'note-commune' in s or 'doctrine' in s:
        return 'jibaya'
    if 'jort' in s or 'journal officiel' in s or 'journal-officiel' in s:
        return 'jort'
    if 'pacioli' in s or 'luca-pacioli' in s or 'luca_pacioli' in s:  # NOUVEAU
        return 'luca_pacioli'
    return default


MONTHS_FR = {
    'janvier': 1, 'février': 2, 'fevrier': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
    'juillet': 7, 'août': 8, 'aout': 8, 'septembre': 9, 'octobre': 10, 'novembre': 11,
    'décembre': 12, 'decembre': 12,
}


def extract_legal_metadata(text, filename, source):
    meta = {
        'source': source, 'jort_number': None, 'jort_date': None,
        'note_commune_number': None, 'note_commune_year': None,
        'law_number': None, 'decree_number': None, 'arrete': False, 'year': None,
    }
    head = text[:5000]

    m = re.search(r"note\s+commune\s*n[°ºo]?\s*(\d+)\s*[/\-]?\s*(20\d{2})?", head, re.I)
    if m:
        meta['note_commune_number'] = m.group(1)
        if m.group(2): meta['note_commune_year'] = int(m.group(2))

    m = re.search(r"journal\s+officiel.{0,40}?n[°ºo]?\s*(\d+)", head, re.I)
    if m: meta['jort_number'] = m.group(1)

    m = re.search(
        r"(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(20\d{2})",
        head, re.I)
    if m:
        d, mo, y = int(m.group(1)), MONTHS_FR[m.group(2).lower()], int(m.group(3))
        meta['jort_date'] = f"{y:04d}-{mo:02d}-{d:02d}"
        meta['year'] = y

    m = re.search(r"loi\s*n[°ºo]?\s*(20\d{2}\s*[-/]\s*\d+)", head, re.I)
    if m: meta['law_number'] = re.sub(r"\s+", "", m.group(1))
    m = re.search(r"d[ée]cret\s*(?:-loi\s*)?n[°ºo]?\s*(20\d{2}\s*[-/]\s*\d+)", head, re.I)
    if m: meta['decree_number'] = re.sub(r"\s+", "", m.group(1))
    if re.search(r"\barr[êe]t[ée]\s+(du|n[°ºo])", head, re.I):
        meta['arrete'] = True

    if not meta['year']:
        m = re.search(r"(20\d{2})", filename)
        if m: meta['year'] = int(m.group(1))

    return meta


def extract_article_number(text):
    """Renvoie le numéro d'article détecté, ou None si rien trouvé.
    Le None est géré côté appelant (process_and_insert / insert_document)."""
    patterns = [
        r'Art(?:icle)?\.?\s*(?:premier|1er|1ᵉʳ)',
        r'Art(?:icle)?\.?\s*(\d+)\s*(?:bis|ter|quater)?',
        r'[\(\[]\s*Art\.?\s*(\d+)\s*[\)\]]',
        r'الفصل\s+(\d+)',
    ]
    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            return m.group(1) if m.groups() and m.group(1) else '1'
    return None


KEYWORD_TAGS = {
    'tva': ['tva', 'taxe sur la valeur ajoutée', 'الأداء على القيمة المضافة'],
    'irpp': ['irpp', 'impôt sur le revenu', 'الضريبة على الدخل'],
    'is': ['impôt sur les sociétés', 'الضريبة على الشركات'],
    'droits_enregistrement': ["droits d'enregistrement", 'timbre'],
    'douane': ['douane', 'douanier', 'tarif douanier'],
    'investissement': ['investissement', 'incitation', 'prime', 'avantage fiscal'],
    'procedure_fiscale': ['contrôle fiscal', 'vérification', "taxation d'office", 'recouvrement'],
    'social': ['cnss', 'cotisation sociale', 'sécurité sociale'],
    'change': ['change', 'devises', 'bct', 'banque centrale'],
    'foncier': ['foncier', 'immobilier', 'tnb', 'taxe sur les immeubles'],
    'penal_fiscal': ['sanction', 'pénalité', 'infraction fiscale'],
    'comptabilite': ['comptabilité', 'bilan', 'amortissement', 'normes comptables'],  # NOUVEAU (utile pour Pacioli)
}


def generate_tags(content, filename, meta=None):
    tags = set()
    meta = meta or {}

    if meta.get('source'): tags.add(f"source_{meta['source']}")
    if meta.get('note_commune_number'): tags.add('note_commune')
    if meta.get('jort_number'): tags.add('jort')
    if meta.get('law_number'): tags.add('loi')
    if meta.get('decree_number'): tags.add('decret')
    if meta.get('arrete'): tags.add('arrete')
    if meta.get('year'): tags.add(f"year_{meta['year']}")

    fl = filename.lower()
    if 'code' in fl: tags.add('code')
    if 'loi de finances' in fl or 'loi-des-finances' in fl: tags.add('loi_finances')
    if 'convention' in fl: tags.add('convention')
    if 'circulaire' in fl: tags.add('circulaire')
    if 'recueil' in fl: tags.add('recueil')

    cl = content.lower()[:3000]
    for tag, kws in KEYWORD_TAGS.items():
        if any(kw in cl for kw in kws):
            tags.add(tag)

    return list(tags)


# ─────────────────────────────────────────────
# EXTRACTION PDF
# ─────────────────────────────────────────────
def extract_with_docling(filepath, timeout=DOCLING_TIMEOUT):
    result = {'text': None, 'num_pages': 0, 'error': None}

    def worker():
        try:
            r = get_converter().convert(filepath)
            result['text'] = r.document.export_to_markdown()
            if hasattr(r.document, 'pages'):
                result['num_pages'] = len(r.document.pages)
            else:
                try:
                    d = fitz.open(filepath)
                    result['num_pages'] = len(d)
                    d.close()
                except:
                    result['num_pages'] = 1
        except Exception as e:
            result['error'] = str(e)

    t = threading.Thread(target=worker)
    t.start()
    t.join(timeout=timeout)
    if t.is_alive(): return None, 0, f"Timeout {timeout}s"
    if result['error']: return None, 0, result['error']
    if not result['text'] or len(result['text'].strip()) < 50:
        return None, 0, "Texte trop court"
    return result['text'], result['num_pages'], None


def extract_with_fitz(filepath):
    try:
        doc = fitz.open(filepath)
        pages_text = []
        for i in range(min(len(doc), 500)):
            try:
                t = doc[i].get_text().strip()
                if t: pages_text.append(t)
            except:
                continue
        doc.close()
        if not pages_text: return None, 0, "Aucun texte fitz"
        return "\n".join(pages_text), len(pages_text), None
    except Exception as e:
        return None, 0, f"Erreur fitz: {e}"


def is_valid_pdf(filepath):
    try:
        with open(filepath, 'rb') as f:
            if f.read(5) != b'%PDF-': return False
            try:
                f.seek(-20, 2)
                return b'%%EOF' in f.read()
            except:
                return True
    except:
        return False


def extract_with_ocr(filepath):
    try:
        from pdf2image import convert_from_path
        imgs = convert_from_path(filepath, dpi=150, poppler_path=POPPLER_PATH,
                                 first_page=1, last_page=50)
        pages = []
        for img in imgs:
            try:
                t = pytesseract.image_to_string(img, lang='fra+ara').strip()
                if t: pages.append(t)
            except:
                continue
        if not pages: return None, 0, "OCR vide"
        return "\n".join(pages), len(pages), None
    except Exception as e:
        return None, 0, f"Erreur OCR: {e}"


def extract_from_pdf(filepath):
    safe_path, is_temp = get_safe_pdf_path(filepath)
    if not os.path.exists(safe_path): return None, 0, "Fichier inexistant"
    if not is_valid_pdf(safe_path):   return None, 0, "PDF invalide"
    try:
        # 🔹 fitz EN PREMIER : léger, rapide, aucun modèle à charger en mémoire.
        # Couvre la quasi-totalité des PDF JORT/Jibaya (texte numérique simple).
        t, n, e = extract_with_fitz(safe_path)
        if t and len(t.strip()) > 100:
            return t, n, None

        # Docling seulement si fitz échoue (mise en page complexe / texte non extractible),
        # et seulement sous le seuil de taille (sinon trop lourd/lent).
        size_mb = os.path.getsize(safe_path) / (1024 * 1024)
        if size_mb <= DOCLING_MAX_SIZE_MB:
            t, n, e = extract_with_docling(safe_path)
            if t and len(t.strip()) > 100:
                return t, n, None

        # Dernier recours : OCR (PDF scanné sans texte extractible)
        t, n, e = extract_with_ocr(safe_path)
        if t and len(t.strip()) > 100:
            return t, n, None
        return None, 0, e or "Extraction impossible"
    except Exception as e:
        return None, 0, f"Erreur extraction: {e}"
    finally:
        if is_temp and os.path.exists(safe_path):
            try:
                os.unlink(safe_path)
            except:
                pass
        gc.collect()


# ─────────────────────────────────────────────
# INSERTION DB — connexion thread-local + fix article_number + source_url
# ─────────────────────────────────────────────
def insert_document(result):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        unique_key = f"{result['source']}/{result['relative_path']}".replace("\\", "/")

        # Vérifier si le document existe déjà
        cur.execute('SELECT id FROM "SourceDocument" WHERE content = %s', (unique_key,))
        existing = cur.fetchone()
        if existing:
            return 0

        # Vérifier si la colonne source_url existe (évite de planter si la migration n'a pas encore été appliquée)
        cur.execute("""SELECT column_name FROM information_schema.columns
                       WHERE table_name='SourceDocument' AND column_name='source_url'""")
        has_source_url = cur.fetchone() is not None  # NOUVEAU

        if has_source_url:
            cur.execute(
                'INSERT INTO "SourceDocument" (id, content, filename, source, source_url, created_at) '
                'VALUES (gen_random_uuid(), %s, %s, %s, %s, now()) RETURNING id',
                (unique_key, result['filename'], result['source'], result.get('source_url'))
            )
        else:
            cur.execute(
                'INSERT INTO "SourceDocument" (id, content, filename, source, created_at) '
                'VALUES (gen_random_uuid(), %s, %s, %s, now()) RETURNING id',
                (unique_key, result['filename'], result['source'])
            )
        doc_id = cur.fetchone()[0]

        # Vérifier si la colonne article_number existe
        cur.execute("""SELECT column_name FROM information_schema.columns
                       WHERE table_name='SourceDocumentSegment' AND column_name='article_number'""")
        has_article = cur.fetchone() is not None

        if has_article:
            rows = []
            for c in result['chunks']:
                rows.append((
                    c['text'],
                    doc_id,
                    json.dumps(c['embedding']),
                    c['chunk_index'],
                    c['page_number'],
                    json.dumps(c['tags']),
                    c.get('article_number') or 0   # ✅ fix: `or 0` plutôt que .get(key, 0)
                ))
            cur.executemany(
                '''INSERT INTO "SourceDocumentSegment"
                   (id, content, "sourceDocumentid", vector, "createdAt",
                    chunk_index, page_number, tags, article_number)
                   VALUES (gen_random_uuid(), %s, %s, %s::vector, now(), %s, %s, %s::jsonb, %s)''',
                rows,
            )
        else:
            rows = []
            for c in result['chunks']:
                rows.append((
                    c['text'],
                    doc_id,
                    json.dumps(c['embedding']),
                    c['chunk_index'],
                    c['page_number'],
                    json.dumps(c['tags'])
                ))
            cur.executemany(
                '''INSERT INTO "SourceDocumentSegment"
                   (id, content, "sourceDocumentid", vector, "createdAt",
                    chunk_index, page_number, tags)
                   VALUES (gen_random_uuid(), %s, %s, %s::vector, now(), %s, %s, %s::jsonb)''',
                rows,
            )

        conn.commit()
        return len(result['chunks'])
    except Exception as e:
        conn.rollback()
        print(f"❌ Erreur insertion: {e}")
        import traceback
        traceback.print_exc()
        return 0
    finally:
        cur.close()


# ─────────────────────────────────────────────
# TRAITEMENT D'UN PDF — connexion thread-local
# ─────────────────────────────────────────────
def process_and_insert(pdf_info, log_buf: deque):
    filename = pdf_info['filename']
    filepath = pdf_info['path']
    relative_path = pdf_info['relative_path']
    source = pdf_info['source']
    unique_key = f"{source}/{relative_path}".replace("\\", "/")

    conn = get_db_connection()  # connexion propre à ce thread

    def log(msg):
        log_buf.append(msg)

    # ✅ CRUCIAL : Annuler toute transaction en cours avant de faire quoi que ce soit
    try:
        conn.rollback()  # Assure que la connexion est dans un état propre
    except:
        pass

    # Vérifier si le document existe déjà
    try:
        cur = conn.cursor()
        cur.execute('SELECT id FROM "SourceDocument" WHERE content = %s', (unique_key,))
        exists = cur.fetchone() is not None
        cur.close()
        conn.commit()  # ✅ IMPORTANT : valider la transaction de lecture

        if exists and SKIP_EXISTING:
            log(f"⏭️ Déjà indexé: {unique_key[:60]}")
            save_progress(unique_key, 'skipped')
            return True, 0, 'skipped'
    except Exception as e:
        log(f"⚠️ Erreur vérification: {e}")
        conn.rollback()  # ✅ ANNULER en cas d'erreur
        return False, 0, 'error'

    try:
        log(f"📄 Traitement: {unique_key[:60]}")

        # Extraire le texte du PDF
        full_text, num_pages, error = _run_with_timeout(
            extract_from_pdf, PDF_EXTRACTION_TIMEOUT, filepath
        )

        if error or not full_text:
            log(f"❌ {unique_key[:60]}: {error or 'Aucun texte'}")
            save_progress(unique_key, 'error')
            conn.rollback()
            return False, 0, 'error'

        # Chunking
        chunks_text = chunk_text_by_words(full_text)
        if not chunks_text:
            log(f"❌ {unique_key[:60]}: Aucun chunk créé")
            save_progress(unique_key, 'error')
            conn.rollback()
            return False, 0, 'error'

        log(f"📝 {len(chunks_text)} chunks créés pour {unique_key[:40]}")

        # Métadonnées du document
        doc_meta = extract_legal_metadata(full_text, filename, source)

        # Embeddings batch
        embeddings = []
        for i in range(0, len(chunks_text), EMBEDDING_BATCH_SIZE):
            batch = chunks_text[i:i + EMBEDDING_BATCH_SIZE]
            try:
                batch_embeddings = embedding_model.encode(batch, show_progress_bar=False)
                embeddings.extend(batch_embeddings)
            except Exception as e:
                log(f"⚠️ Erreur embedding batch {i}: {e}")
                continue
            gc.collect()

        if len(embeddings) != len(chunks_text):
            log(f"⚠️ Ajustement: {len(embeddings)} embeddings pour {len(chunks_text)} chunks")
            chunks_text = chunks_text[:len(embeddings)]

        # Construire les chunks avec métadonnées
        chunks = []
        for i, (c, e) in enumerate(zip(chunks_text, embeddings)):
            chunk_data = {
                'text': c,
                'embedding': e.tolist(),
                'chunk_index': i,
                'page_number': min((i * CHUNK_SIZE // 500) + 1, num_pages or 1),
                'tags': generate_tags(c, filename, doc_meta),
                'article_number': extract_article_number(c),  # peut être None → géré dans insert_document
            }
            chunks.append(chunk_data)

        # 🔹 URL source (uniquement pour Luca Pacioli pour l'instant) — NOUVEAU
        source_url = PACIOLI_URL_MAP.get(filename) if source == 'luca_pacioli' else None
        if source == 'luca_pacioli' and not source_url:
            log(f"⚠️ Pas d'URL trouvée dans {PACIOLI_URL_MAP_FILE} pour: {filename}")

        # ✅ ICI : Définir result AVANT de l'utiliser
        result = {
            'filename': filename,
            'relative_path': relative_path,
            'source': source,
            'source_url': source_url,   # NOUVEAU
            'num_pages': num_pages or 1,
            'chunks': chunks,
        }

        # Insertion en base de données
        inserted = insert_document(result)

        if inserted > 0:
            log(f"✅ [{source}] {relative_path[:50]} → {inserted} chunks")
            save_progress(unique_key, 'inserted')
            conn.commit()  # ✅ VALIDER
            return True, inserted, 'inserted'
        else:
            log(f"⚠️ Aucun chunk inséré pour {unique_key[:50]}")
            save_progress(unique_key, 'no_chunks')
            conn.rollback()  # ✅ ANNULER
            return False, 0, 'no_chunks'

    except TimeoutError:
        log(f"⏱️ Timeout: {unique_key[:60]}")
        save_progress(unique_key, 'timeout')
        conn.rollback()
        return False, 0, 'timeout'
    except MemoryError:
        log(f"💾 Mémoire: {unique_key[:60]}")
        gc.collect()
        save_progress(unique_key, 'memory')
        conn.rollback()
        return False, 0, 'memory'
    except Exception as e:
        log(f"❌ Erreur {unique_key[:60]}: {e}")
        import traceback
        traceback.print_exc()
        save_progress(unique_key, 'error')
        conn.rollback()  # ✅ TOUJOURS ANNULER
        return False, 0, 'error'


# ─────────────────────────────────────────────
# FICHIERS — parcours des 3 dossiers
# ─────────────────────────────────────────────
def get_pdf_files_recursive():
    out = []
    for source, folder in FOLDERS.items():
        if not os.path.exists(folder):
            print(f"⚠️ Dossier introuvable: {folder}")
            continue
        for root, _, files in os.walk(folder):
            for f in files:
                if f.lower().endswith('.pdf'):
                    fp = os.path.join(root, f)
                    try:
                        rel_path = os.path.relpath(fp, folder).replace('\\', '/')
                        out.append({
                            'filename': f,
                            'path': fp,
                            'relative_path': rel_path,
                            'size': os.path.getsize(fp),
                            'source': source,
                        })
                    except Exception as e:
                        print(f"⚠️ Erreur pour {fp}: {e}")
                        continue
    out.sort(key=lambda x: x['size'])
    return out


def get_already_indexed(conn):
    try:
        cur = conn.cursor()
        cur.execute('SELECT content FROM "SourceDocument"')
        rows = cur.fetchall()
        cur.close()
        return {r[0] for r in rows}
    except Exception as e:
        print(f"⚠️ Erreur récupération documents indexés: {e}")
        return set()


def show_indexation_status(conn):
    try:
        cur = conn.cursor()
        cur.execute('SELECT COUNT(*) FROM "SourceDocument"')
        total = cur.fetchone()[0]
        cur.execute('SELECT COUNT(*) FROM "SourceDocumentSegment"')
        seg = cur.fetchone()[0]
        cur.close()
        return total, seg
    except Exception as e:
        print(f"⚠️ Erreur stats: {e}")
        return 0, 0


# ─────────────────────────────────────────────
# AFFICHAGE LOG SOUS LA BARRE
# ─────────────────────────────────────────────
def _render_log_block(log_buf: deque, width: int = 80):
    lines = list(log_buf)
    if not lines:
        return
    print(f"\033[{len(lines)}A", end="", flush=True)
    for line in lines:
        print(f"  {line[:width - 2]}")
        print("\033[1B", end="", flush=True)
    print(f"\033[{len(lines)}A", end="", flush=True)


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def index_documents():
    print("\n" + "=" * 60)
    print("📚 INDEXATION JIBAYA + JORT + LUCA PACIOLI")
    print("=" * 60)
    for name, folder in FOLDERS.items():
        ok = "✅" if os.path.exists(folder) else "❌"
        print(f"  {ok} {name:<13} → {folder}")
    print(f"🔄 Workers: {PARALLEL_WORKERS}")
    print(f"⏱️  Timeout: Docling {DOCLING_TIMEOUT}s / global {PDF_EXTRACTION_TIMEOUT}s")
    print(f"🔗 Mapping URL Pacioli: {len(PACIOLI_URL_MAP)} entrée(s) chargée(s)")
    print("=" * 60 + "\n")

    try:
        conn = get_db_connection()  # connexion du thread principal (pour les stats)
        print("✅ Connecté à la DB")
    except Exception as e:
        print(f"❌ Connexion DB: {e}")
        return

    total_docs, total_segments = show_indexation_status(conn)
    print(f"📊 Déjà en DB: {total_docs} docs / {total_segments} segments\n")

    already_done = load_progress()
    all_pdfs = get_pdf_files_recursive()
    indexed_in_db = get_already_indexed(conn)

    files_to_index = []
    for f in all_pdfs:
        key = f"{f['source']}/{f['relative_path']}".replace("\\", "/")
        if key in indexed_in_db or key in already_done:
            continue
        files_to_index.append(f)

    if not files_to_index:
        print("✨ Aucun nouveau document à indexer!")
        close_all_connections()
        return

    by_src = {}
    for f in files_to_index:
        by_src[f['source']] = by_src.get(f['source'], 0) + 1
    print(f"📋 {len(all_pdfs)} PDFs trouvés — {len(files_to_index)} à traiter:")
    for s, n in by_src.items():
        print(f"     • {s}: {n}")
    print()

    start = time.time()
    total_chunks = success = skipped = errors = 0

    LOG_LINES = 5
    log_buf: deque = deque(maxlen=LOG_LINES)

    print("\n" * LOG_LINES, end="")
    print(f"\033[{LOG_LINES}A", end="", flush=True)

    with tqdm(
            total=len(files_to_index), unit="doc",
            bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}] {postfix}",
            postfix={"✅": 0, "⏭": 0, "❌": 0},
            dynamic_ncols=True,
    ) as pbar:
        with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as ex:
            futures = {ex.submit(process_and_insert, pdf, log_buf): pdf for pdf in files_to_index}
            for fut in as_completed(futures):
                try:
                    ok, chunks, status = fut.result()
                    if status == 'skipped':
                        skipped += 1
                    elif status == 'inserted' and ok:
                        success += 1
                        total_chunks += chunks
                    else:
                        errors += 1
                except Exception as e:
                    print(f"❌ Erreur future: {e}")
                    errors += 1

                pbar.set_postfix({"✅": success, "⏭": skipped, "❌": errors})
                pbar.update(1)

                if log_buf:
                    _render_log_block(log_buf)
                gc.collect()

    print(f"\033[{LOG_LINES + 1}B", end="", flush=True)
    print("\n" + "=" * 60)

    close_all_connections()
    elapsed = time.time() - start

    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ FINAL")
    print("=" * 60)
    print(f"✅ Indexés     : {success}")
    print(f"⏭️  Ignorés    : {skipped}")
    print(f"❌ Échecs      : {errors}")
    print(f"📦 Chunks      : {total_chunks}")
    print(f"⏱️  Temps       : {elapsed:.1f}s")
    if success > 0:
        print(f"   ({elapsed / success:.1f}s/doc)")
    print(f"\n💾 Progress: {PROGRESS_FILE}")
    print("✨ Terminé!")


if __name__ == "__main__":
    index_documents()