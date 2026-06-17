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
from contextlib import contextmanager

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"


# ─────────────────────────────────────────────
# TIMEOUT (cross-platform)
# ─────────────────────────────────────────────
class TimeoutError(Exception):
    pass


def _run_with_timeout(fn, seconds, *args, **kwargs):
    result, exc = [None], [None]
    def worker():
        try: result[0] = fn(*args, **kwargs)
        except Exception as e: exc[0] = e
    t = threading.Thread(target=worker, daemon=True)
    t.start(); t.join(timeout=seconds)
    if t.is_alive(): raise TimeoutError(f"Timeout apres {seconds}s")
    if exc[0]: raise exc[0]
    return result[0]


# ─────────────────────────────────────────────
# TESSERACT / POPPLER
# ─────────────────────────────────────────────
TESSERACT_PATH = r"C:\Users\rnmdr\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"
POPPLER_PATH   = r"C:\Users\rnmdr\Downloads\Release-26.02.0-0\poppler-26.02.0\Library\bin"

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

# 🔹 DEUX DOSSIERS SOURCES
FOLDERS = {
    "jibaya": "downloaded_pdfs",
    "jort":   "downloaded_jort_pdfs",
}

PARALLEL_WORKERS        = 1
CHUNK_SIZE              = 150
EMBEDDING_BATCH_SIZE    = 32
DOCLING_MAX_SIZE_MB     = 3.0
DOCLING_TIMEOUT         = 30
PDF_EXTRACTION_TIMEOUT  = 60

SKIP_EXISTING  = True
PROGRESS_FILE  = "indexation_progress.json"


# ─────────────────────────────────────────────
# WINDOWS UNICODE FIX
# ─────────────────────────────────────────────
def get_safe_pdf_path(filepath):
    try:
        filepath.encode('ascii')
        with open(filepath, 'rb'): pass
        return filepath, False
    except (UnicodeEncodeError, UnicodeDecodeError, OSError, FileNotFoundError):
        fd, tmp = tempfile.mkstemp(suffix='.pdf', prefix='pdf_')
        os.close(fd)
        shutil.copy2(filepath, tmp)
        return tmp, True


# Modèle d'embedding partagé
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
db_lock = threading.Lock()


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
        done = load_progress(); done.add(key)
        try:
            with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
                json.dump({'processed': list(done)}, f, ensure_ascii=False)
        except Exception:
            pass


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
    return default


MONTHS_FR = {
    'janvier':1,'février':2,'fevrier':2,'mars':3,'avril':4,'mai':5,'juin':6,
    'juillet':7,'août':8,'aout':8,'septembre':9,'octobre':10,'novembre':11,
    'décembre':12,'decembre':12,
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

    m = re.search(r"(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(20\d{2})", head, re.I)
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
                    d = fitz.open(filepath); result['num_pages'] = len(d); d.close()
                except: result['num_pages'] = 1
        except Exception as e:
            result['error'] = str(e)
    t = threading.Thread(target=worker); t.start(); t.join(timeout=timeout)
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
            except: continue
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
                f.seek(-20, 2); return b'%%EOF' in f.read()
            except: return True
    except: return False


def extract_with_ocr(filepath):
    try:
        from pdf2image import convert_from_path
        imgs = convert_from_path(filepath, dpi=150, poppler_path=POPPLER_PATH,
                                 first_page=1, last_page=50)
        pages = []
        for img in imgs:
            try:
                # Essai bilingue fra+ara directement
                t = pytesseract.image_to_string(img, lang='fra+ara').strip()
                if t: pages.append(t)
            except: continue
        if not pages: return None, 0, "OCR vide"
        return "\n".join(pages), len(pages), None
    except Exception as e:
        return None, 0, f"Erreur OCR: {e}"


def extract_from_pdf(filepath):
    safe_path, is_temp = get_safe_pdf_path(filepath)
    if not os.path.exists(safe_path): return None, 0, "Fichier inexistant"
    if not is_valid_pdf(safe_path):   return None, 0, "PDF invalide"
    try:
        size_mb = os.path.getsize(safe_path) / (1024 * 1024)
        if size_mb > DOCLING_MAX_SIZE_MB:
            t, n, e = extract_with_fitz(safe_path)
            if t and len(t.strip()) > 100: return t, n, None
            t, n, e = extract_with_ocr(safe_path)
            if t and len(t.strip()) > 100: return t, n, None
            return None, 0, e or "Extraction impossible"

        t, n, e = extract_with_docling(safe_path)
        if t and len(t.strip()) > 100: return t, n, None
        t, n, e = extract_with_fitz(safe_path)
        if t and len(t.strip()) > 100: return t, n, None
        t, n, e = extract_with_ocr(safe_path)
        if t and len(t.strip()) > 100: return t, n, None
        return None, 0, e or "Extraction impossible"
    except Exception as e:
        return None, 0, f"Erreur extraction: {e}"
    finally:
        if is_temp and os.path.exists(safe_path):
            try: os.unlink(safe_path)
            except: pass
        gc.collect()


# ─────────────────────────────────────────────
# INSERTION DB — clé unique = source/relative_path
# ─────────────────────────────────────────────
def insert_document(conn, result):
    cur = conn.cursor()
    try:
        unique_key = f"{result['source']}/{result['relative_path']}".replace("\\", "/")

        cur.execute('SELECT id FROM "SourceDocument" WHERE content = %s', (unique_key,))
        if cur.fetchone():
            return 0

        cur.execute(
            'INSERT INTO "SourceDocument" (id, content, created_at) '
            'VALUES (gen_random_uuid(), %s, now()) RETURNING id',
            (unique_key,)
        )
        doc_id = cur.fetchone()[0]

        cur.execute("""SELECT column_name FROM information_schema.columns
                       WHERE table_name='SourceDocumentSegment' AND column_name='article_number'""")
        has_article = cur.fetchone() is not None

        if has_article:
            rows = [(c['text'], doc_id, json.dumps(c['embedding']), c['chunk_index'],
                     c['page_number'], c['tags'], c['article_number']) for c in result['chunks']]
            cur.executemany(
                '''INSERT INTO "SourceDocumentSegment"
                   (id, content, "sourceDocumentid", vector, "createdAt",
                    chunk_index, page_number, tags, article_number)
                   VALUES (gen_random_uuid(), %s, %s, %s::vector, now(), %s, %s, %s, %s)''',
                rows,
            )
        else:
            rows = [(c['text'], doc_id, json.dumps(c['embedding']), c['chunk_index'],
                     c['page_number'], json.dumps(c['tags'])) for c in result['chunks']]
            cur.executemany(
                '''INSERT INTO "SourceDocumentSegment"
                   (id, content, "sourceDocumentid", vector, "createdAt",
                    chunk_index, page_number, tags, article_number)
                   VALUES (gen_random_uuid(), %s, %s, %s::vector, now(), %s, %s, %s, 0)''',
                rows,
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
# TRAITEMENT D'UN PDF
# ─────────────────────────────────────────────
def process_and_insert(pdf_info, conn, log_buf: deque):
    filename       = pdf_info['filename']
    filepath       = pdf_info['path']
    relative_path  = pdf_info['relative_path']
    source         = pdf_info['source']
    unique_key     = f"{source}/{relative_path}".replace("\\", "/")

    def log(msg): log_buf.append(msg)

    cur = conn.cursor()
    cur.execute('SELECT id FROM "SourceDocument" WHERE content = %s', (unique_key,))
    exists = cur.fetchone() is not None
    cur.close()
    if exists and SKIP_EXISTING:
        save_progress(unique_key, 'skipped')
        return True, 0, 'skipped'

    try:
        full_text, num_pages, error = _run_with_timeout(
            extract_from_pdf, PDF_EXTRACTION_TIMEOUT, filepath
        )
        if error or not full_text:
            log(f"❌ {unique_key[:65]}: {error or 'Aucun texte'}")
            save_progress(unique_key, 'error')
            return False, 0, 'error'

        chunks_text = chunk_text_by_words(full_text)
        if not chunks_text:
            save_progress(unique_key, 'error')
            return False, 0, 'error'

        # Métadonnées du document
        doc_meta = extract_legal_metadata(full_text, filename, source)

        # Embeddings batch
        embeddings = []
        for i in range(0, len(chunks_text), EMBEDDING_BATCH_SIZE):
            batch = chunks_text[i:i + EMBEDDING_BATCH_SIZE]
            try:
                embeddings.extend(embedding_model.encode(batch, show_progress_bar=False))
            except Exception as e:
                log(f"⚠️ {filename[:50]}: embedding — {e}")
                continue
            gc.collect()

        if len(embeddings) != len(chunks_text):
            chunks_text = chunks_text[:len(embeddings)]

        chunks = [{
            'text': c,
            'embedding': e.tolist(),
            'chunk_index': i,
            'page_number': min((i * CHUNK_SIZE // 500) + 1, num_pages or 1),
            'tags': generate_tags(c, filename, doc_meta),
            'article_number': extract_article_number(c),
        } for i, (c, e) in enumerate(zip(chunks_text, embeddings))]

        result = {
            'filename': filename,
            'relative_path': relative_path,
            'source': source,
            'num_pages': num_pages or 1,
            'chunks': chunks,
        }

        with db_lock:
            inserted = insert_document(conn, result)

        if inserted > 0:
            log(f"✅ [{source}] {relative_path[:55]} → {inserted} chunks")
        save_progress(unique_key, 'inserted')
        return True, inserted, 'inserted'

    except TimeoutError:
        log(f"⏱️ {unique_key[:65]}: timeout")
        save_progress(unique_key, 'timeout')
        return False, 0, 'timeout'
    except MemoryError:
        log(f"💾 {unique_key[:65]}: mémoire")
        gc.collect()
        save_progress(unique_key, 'memory')
        return False, 0, 'memory'
    except Exception as e:
        log(f"❌ {unique_key[:65]}: {e}")
        save_progress(unique_key, 'error')
        return False, 0, 'error'


# ─────────────────────────────────────────────
# FICHIERS — parcours des 2 dossiers
# ─────────────────────────────────────────────
def get_pdf_files_recursive():
    out = []
    for source, folder in FOLDERS.items():
        if not os.path.exists(folder):
            print(f"⚠️  Dossier introuvable: {folder}")
            continue
        for root, _, files in os.walk(folder):
            for f in files:
                if f.lower().endswith('.pdf'):
                    fp = os.path.join(root, f)
                    try:
                        out.append({
                            'filename': f,
                            'path': fp,
                            'relative_path': os.path.relpath(fp, folder),
                            'size': os.path.getsize(fp),
                            'source': source,
                        })
                    except: continue
    out.sort(key=lambda x: x['size'])
    return out


def get_already_indexed(conn):
    cur = conn.cursor()
    cur.execute('SELECT content FROM "SourceDocument"')
    rows = cur.fetchall(); cur.close()
    return {r[0] for r in rows}


def show_indexation_status(conn):
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM "SourceDocument"'); total = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM "SourceDocumentSegment"'); seg = cur.fetchone()[0]
    cur.close()
    return total, seg


# ─────────────────────────────────────────────
# AFFICHAGE LOG SOUS LA BARRE
# ─────────────────────────────────────────────
def _render_log_block(log_buf: deque, width: int = 80):
    lines = list(log_buf)
    print("")
    for line in lines:
        print(f"  {line[:width - 2]}")
    print(f"\033[{len(lines) + 1}A", end="", flush=True)


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def index_documents():
    print("\n" + "=" * 60)
    print("📚 INDEXATION JIBAYA + JORT")
    print("=" * 60)
    for name, folder in FOLDERS.items():
        ok = "✅" if os.path.exists(folder) else "❌"
        print(f"  {ok} {name:<8} → {folder}")
    print(f"🔄 Workers: {PARALLEL_WORKERS}")
    print(f"⏱️  Timeout: Docling {DOCLING_TIMEOUT}s / global {PDF_EXTRACTION_TIMEOUT}s")
    print("=" * 60 + "\n")

    try:
        conn = psycopg.connect(DB_URL)
        print("✅ Connecté à la DB")
    except Exception as e:
        print(f"❌ Connexion DB: {e}"); return

    total_docs, total_segments = show_indexation_status(conn)
    print(f"📊 Déjà en DB: {total_docs} docs / {total_segments} segments\n")

    already_done  = load_progress()
    all_pdfs      = get_pdf_files_recursive()
    indexed_in_db = get_already_indexed(conn)

    files_to_index = []
    for f in all_pdfs:
        key = f"{f['source']}/{f['relative_path']}".replace("\\", "/")
        if key in indexed_in_db or key in already_done:
            continue
        files_to_index.append(f)

    if not files_to_index:
        print("✨ Aucun nouveau document à indexer!")
        conn.close(); return

    # Stats par source
    by_src = {}
    for f in files_to_index:
        by_src[f['source']] = by_src.get(f['source'], 0) + 1
    print(f"📋 {len(all_pdfs)} PDFs trouvés — {len(files_to_index)} à traiter:")
    for s, n in by_src.items():
        print(f"     • {s}: {n}")
    print()

    start = time.time()
    total_chunks = success = skipped = errors = 0

    LOG_LINES = 10
    log_buf: deque = deque(maxlen=LOG_LINES)
    print("\n" * LOG_LINES, end="")
    print(f"\033[{LOG_LINES + 1}A", end="", flush=True)

    with tqdm(
        total=len(files_to_index), unit="doc",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}] {postfix}",
        postfix={"✅": 0, "⏭": 0, "❌": 0},
        dynamic_ncols=True,
    ) as pbar:
        with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as ex:
            futures = {ex.submit(process_and_insert, pdf, conn, log_buf): pdf for pdf in files_to_index}
            for fut in as_completed(futures):
                ok, chunks, status = fut.result()
                if status == 'skipped': skipped += 1
                elif status == 'inserted' and ok:
                    success += 1; total_chunks += chunks
                else: errors += 1
                pbar.set_postfix({"✅": success, "⏭": skipped, "❌": errors})
                pbar.update(1)
                _render_log_block(log_buf)
                gc.collect()

    print(f"\033[{LOG_LINES + 1}B", end="", flush=True); print()

    conn.close()
    elapsed = time.time() - start
    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ")
    print("=" * 60)
    print(f"✅ Indexés     : {success}")
    print(f"⏭️  Ignorés    : {skipped}")
    print(f"❌ Échecs      : {errors}")
    print(f"📦 Chunks      : {total_chunks}")
    print(f"⏱️  Temps       : {elapsed:.1f}s")
    if success: print(f"   ({elapsed/success:.1f}s/doc)")
    print(f"\n💾 Progress: {PROGRESS_FILE}")
    print("✨ Terminé!")


if __name__ == "__main__":
    index_documents()
