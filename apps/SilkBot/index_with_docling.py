#!/usr/bin/env python
# -*- coding: utf-8 -*-

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
import sys
import logging
import warnings

# ─────────────────────────────────────────────
# SUPPRESSION DES LOGS ET ERREURS MUPDF
# ─────────────────────────────────────────────
# Supprimer tous les warnings
warnings.filterwarnings("ignore")

# Désactiver les logs de bibliothèques
logging.basicConfig(level=logging.CRITICAL)
for logger_name in ['fitz', 'PyMuPDF', 'pdfminer', 'PdfReader', 'mupdf', 'urllib3', 'requests', 'docling']:
    logger = logging.getLogger(logger_name)
    logger.setLevel(logging.CRITICAL)
    logger.disabled = True
    logger.handlers = []

# Supprimer les handlers de log existants
for handler in logging.root.handlers[:]:
    logging.root.removeHandler(handler)

# Rediriger stderr pour supprimer les messages MuPDF
if os.name == 'nt':  # Windows
    sys.stderr = open('nul', 'w')
else:  # Linux/Mac
    sys.stderr = open(os.devnull, 'w')

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"  # Supprimer les logs TensorFlow
os.environ["PYTHONWARNINGS"] = "ignore"  # Supprimer les warnings Python


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
    "luca_pacioli": "downloaded_pacioli_pdfs",
}

# 🔹 EXTENSIONS SUPPORTÉES
SUPPORTED_EXTENSIONS = {'.pdf', '.txt'}

PARALLEL_WORKERS = 2
CHUNK_SIZE = 150
EMBEDDING_BATCH_SIZE = 32
DOCLING_MAX_SIZE_MB = 3.0
DOCLING_TIMEOUT = 30
PDF_EXTRACTION_TIMEOUT = 60

SKIP_EXISTING = True
PROGRESS_FILE = "indexation_progress.json"

# 🔹 FICHIERS JSON POUR LES URLs
JORT_JSON_FILE = "1-x.json"  # Fichier JORT avec les URLs
JIBAYA_JSON_FILE = "jibaya_data.json"  # Fichier Jibaya avec les URLs
PACIOLI_URL_MAP_FILE = "luca_pacioli_articles.json"  # Fichier Luca Pacioli


# ─────────────────────────────────────────────
# CHARGEMENT DES URLs DEPUIS LES FICHIERS JSON
# ─────────────────────────────────────────────

def load_url_mappings():
    """
    Charge les URLs depuis les différents fichiers JSON.
    Génère des clés multiples pour maximiser les correspondances.
    """
    url_map = {}

    # 1. Charger les URLs JORT depuis 1-x.json
    if os.path.exists(JORT_JSON_FILE):
        try:
            with open(JORT_JSON_FILE, "r", encoding="utf-8") as f:
                jort_data = json.load(f)
                if isinstance(jort_data, list):
                    for item in jort_data:
                        pdf_url = item.get("pdf_url", "")
                        if pdf_url:
                            # Extraire les informations
                            # https://lake.jort.tn/journal-officiel/fr/1957/001.pdf
                            parts = pdf_url.split("/")
                            if len(parts) >= 3:
                                # Créer plusieurs clés pour ce document
                                # Clé 1: fr/1957/001
                                rel_path = pdf_url.split("journal-officiel/")[1].replace(".pdf", "")
                                key1 = f"jort/{rel_path}"
                                url_map[key1] = pdf_url

                                # Clé 2: 1957/001-fr
                                year = parts[-2] if len(parts) >= 2 else ""
                                issue = parts[-1].replace(".pdf", "")
                                lang = parts[-3] if len(parts) >= 3 else ""
                                if year and issue and lang:
                                    key2 = f"jort/{year}/{issue}-{lang}"
                                    url_map[key2] = pdf_url

                                    # Clé 3: 1957/001 (sans langue)
                                    key3 = f"jort/{year}/{issue}"
                                    url_map[key3] = pdf_url

                                    # Clé 4: issue (001) avec année
                                    key4 = f"jort/{year}/{issue}.pdf"
                                    url_map[key4] = pdf_url
        except Exception as e:
            print(f"⚠️ Erreur chargement {JORT_JSON_FILE}: {e}")

    # 2. Charger les URLs Jibaya
    if os.path.exists(JIBAYA_JSON_FILE):
        try:
            with open(JIBAYA_JSON_FILE, "r", encoding="utf-8") as f:
                jibaya_data = json.load(f)
                if isinstance(jibaya_data, list):
                    for category in jibaya_data:
                        for sub in category.get("sub_categories", []):
                            for article in sub.get("articles", []):
                                url = article.get("url", "")
                                title = article.get("title", "")
                                if url:
                                    clean_url = url.replace("https://jibaya.tn/docs/", "").rstrip("/")
                                    # Clé 1: jibaya/nom-du-document
                                    key1 = f"jibaya/{clean_url}"
                                    url_map[key1] = url

                                    # Clé 2: basé sur le titre
                                    if title:
                                        title_key = title.lower().replace(" ", "-")
                                        title_key = re.sub(r'[^a-z0-9-]', '', title_key)
                                        key2 = f"jibaya/{title_key}"
                                        url_map[key2] = url
        except Exception as e:
            print(f"⚠️ Erreur chargement {JIBAYA_JSON_FILE}: {e}")

    # 3. Charger les URLs Luca Pacioli
    if os.path.exists(PACIOLI_URL_MAP_FILE):
        try:
            with open(PACIOLI_URL_MAP_FILE, "r", encoding="utf-8") as f:
                pacioli_data = json.load(f)
                if isinstance(pacioli_data, list):
                    for item in pacioli_data:
                        url = item.get("url", "")
                        title = item.get("title", "")
                        if url:
                            # Extraire le slug depuis l'URL
                            url_parts = url.split("/")
                            slug = url_parts[-1] if url_parts else ""

                            if slug:
                                # Clé 1: luca_pacioli/slug
                                key1 = f"luca_pacioli/{slug}"
                                url_map[key1] = url

                                # Clé 2: basé sur le titre
                                if title:
                                    title_key = title.lower()
                                    title_key = re.sub(r'[^a-z0-9-]', '-', title_key)
                                    title_key = re.sub(r'-+', '-', title_key).strip('-')
                                    key2 = f"luca_pacioli/{title_key}"
                                    url_map[key2] = url
                elif isinstance(pacioli_data, dict):
                    for key, url in pacioli_data.items():
                        url_map[f"luca_pacioli/{key}"] = url
        except Exception as e:
            print(f"⚠️ Erreur chargement {PACIOLI_URL_MAP_FILE}: {e}")

    print(f"✅ {len(url_map)} URLs chargées depuis les fichiers JSON")
    return url_map


# Charger les mappings au démarrage
URL_MAP = load_url_mappings()


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
# DB — UNE CONNEXION PAR THREAD
# ─────────────────────────────────────────────
_db_local = threading.local()
_all_connections = []
_connections_lock = threading.Lock()


def get_db_connection():
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
    if 'pacioli' in s or 'luca-pacioli' in s or 'luca_pacioli' in s:
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
    'comptabilite': ['comptabilité', 'bilan', 'amortissement', 'normes comptables'],
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
    """
    Extrait le texte d'un PDF avec PyMuPDF en ignorant les erreurs d'annotations.
    """
    try:
        doc = fitz.open(filepath)
        pages_text = []
        max_pages = min(len(doc), 500)

        for i in range(max_pages):
            try:
                page = doc[i]
                try:
                    t = page.get_text().strip()
                    if t:
                        pages_text.append(t)
                except Exception:
                    try:
                        t = page.get_text("text").strip()
                        if t:
                            pages_text.append(t)
                    except:
                        continue
            except Exception:
                continue

        doc.close()

        if not pages_text:
            return None, 0, "Aucun texte extrait"

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
        t, n, e = extract_with_fitz(safe_path)
        if t and len(t.strip()) > 100:
            return t, n, None

        size_mb = os.path.getsize(safe_path) / (1024 * 1024)
        if size_mb <= DOCLING_MAX_SIZE_MB:
            t, n, e = extract_with_docling(safe_path)
            if t and len(t.strip()) > 100:
                return t, n, None

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
# EXTRACTION TXT
# ─────────────────────────────────────────────
def extract_from_txt(filepath):
    """
    Extrait le texte d'un fichier TXT.
    """
    try:
        # Essayer différents encodages
        encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']

        for encoding in encodings:
            try:
                with open(filepath, 'r', encoding=encoding) as f:
                    text = f.read()
                    if text and len(text.strip()) > 0:
                        return text, 1, None
            except UnicodeDecodeError:
                continue
            except Exception as e:
                continue

        # Si aucun encodage ne fonctionne, essayer avec errors='ignore'
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
                if text and len(text.strip()) > 0:
                    return text, 1, None
        except Exception as e:
            return None, 0, f"Erreur lecture TXT: {e}"

        return None, 0, "Fichier vide ou illisible"
    except Exception as e:
        return None, 0, f"Erreur extraction TXT: {e}"


# ─────────────────────────────────────────────
# EXTRACTION GENERIQUE
# ─────────────────────────────────────────────
def extract_from_file(filepath):
    """
    Extrait le texte d'un fichier selon son extension.
    """
    ext = os.path.splitext(filepath)[1].lower()

    if ext == '.txt':
        return extract_from_txt(filepath)
    elif ext == '.pdf':
        return extract_from_pdf(filepath)
    else:
        return None, 0, f"Extension non supportée: {ext}"


# ─────────────────────────────────────────────
# 🔹 TROUVER L'URL CORRESPONDANTE
# ─────────────────────────────────────────────
def find_source_url(source, relative_path, filename):
    """
    Trouve l'URL correspondante pour un fichier donné.
    Essaie plusieurs stratégies pour maximiser les correspondances.
    """
    rel_path = relative_path.replace("\\", "/")
    base_name = os.path.splitext(filename)[0]

    keys_to_try = []

    # 1. Chemin complet
    keys_to_try.append(f"{source}/{rel_path}")
    keys_to_try.append(f"{source}/{rel_path}".replace(".pdf", ""))
    keys_to_try.append(f"{source}/{rel_path}".replace(".txt", ""))

    # 2. Nom de fichier uniquement
    keys_to_try.append(f"{source}/{filename}")
    keys_to_try.append(f"{source}/{base_name}")

    # 3. Pour JORT: essayer différentes combinaisons
    if source == "jort":
        parts = rel_path.split("/")
        for i, part in enumerate(parts):
            if re.match(r"^20\d{2}$", part) and i + 1 < len(parts):
                year = part
                issue_file = parts[i + 1]
                issue = issue_file.replace(".pdf", "").replace(".txt", "")
                lang = "fr" if "fr" in rel_path.lower() else "ar"

                keys_to_try.append(f"jort/{year}/{issue}-{lang}")
                keys_to_try.append(f"jort/{year}/{issue}")
                keys_to_try.append(f"jort/{year}/{issue}.pdf")
                keys_to_try.append(f"jort/{rel_path}")

    # 4. Pour Luca Pacioli: essayer différentes variations du nom
    if source == "luca_pacioli":
        clean_name = base_name.lower()
        clean_name = re.sub(r'[^a-z0-9-]', '-', clean_name)
        clean_name = re.sub(r'-+', '-', clean_name).strip('-')

        keys_to_try.append(f"luca_pacioli/{clean_name}")
        keys_to_try.append(f"luca_pacioli/{base_name}")
        keys_to_try.append(f"luca_pacioli/{rel_path}")
        keys_to_try.append(f"luca_pacioli/{filename}")

    # 5. Pour Jibaya: essayer différentes variations
    if source == "jibaya":
        clean_name = base_name.lower().replace(" ", "-")
        clean_name = re.sub(r'[^a-z0-9-]', '', clean_name)
        keys_to_try.append(f"jibaya/{clean_name}")
        keys_to_try.append(f"jibaya/{base_name}")
        keys_to_try.append(f"jibaya/{rel_path}")

    # Essayer toutes les clés
    for key in keys_to_try:
        if key in URL_MAP:
            return URL_MAP[key]

    # Recherche partielle
    for key, url in URL_MAP.items():
        if source in key:
            key_parts = key.split("/")
            if len(key_parts) > 1:
                key_name = key_parts[-1].lower()
                if base_name.lower() in key_name or key_name in base_name.lower():
                    return url

    return None


# ─────────────────────────────────────────────
# FICHIERS — parcours des dossiers
# ─────────────────────────────────────────────
def get_files_recursive():
    """
    Parcourt les dossiers et trouve tous les fichiers supportés (PDF et TXT).
    """
    out = []
    for source, folder in FOLDERS.items():
        if not os.path.exists(folder):
            print(f"⚠️ Dossier introuvable: {folder}")
            continue
        for root, _, files in os.walk(folder):
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in SUPPORTED_EXTENSIONS:
                    fp = os.path.join(root, f)
                    try:
                        rel_path = os.path.relpath(fp, folder).replace('\\', '/')
                        out.append({
                            'filename': f,
                            'path': fp,
                            'relative_path': rel_path,
                            'size': os.path.getsize(fp),
                            'source': source,
                            'extension': ext,
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
    """Affiche le statut de l'indexation"""
    try:
        cur = conn.cursor()
        cur.execute('SELECT COUNT(*) FROM "SourceDocument"')
        total = cur.fetchone()[0]
        cur.execute('SELECT COUNT(*) FROM "SourceDocumentSegment"')
        seg = cur.fetchone()[0]

        cur.execute('SELECT source, COUNT(*) FROM "SourceDocument" GROUP BY source')
        by_source = cur.fetchall()

        print(f"\n📊 STATUT INDEXATION")
        print(f"  - Documents sources: {total}")
        print(f"  - Segments: {seg}")
        print(f"  - Par source:")
        for source, count in by_source:
            print(f"    • {source}: {count} documents")
        cur.close()
        return total, seg, by_source
    except Exception as e:
        print(f"⚠️ Erreur statut: {e}")
        return 0, 0, []


# ─────────────────────────────────────────────
# INSERTION DB - VERSION AMÉLIORÉE
# ─────────────────────────────────────────────
def insert_document(result):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        unique_key = f"{result['source']}/{result['relative_path']}".replace("\\", "/")
        source_url = result.get('source_url')

        cur.execute('SELECT id, source_url FROM "SourceDocument" WHERE content = %s', (unique_key,))
        existing = cur.fetchone()

        if existing:
            doc_id = existing[0]
            existing_url = existing[1]

            if not existing_url and source_url:
                print(f"🔗 Mise à jour URL pour document existant: {source_url[:60]}...")
                cur.execute(
                    'UPDATE "SourceDocument" SET source_url = %s WHERE id = %s',
                    (source_url, doc_id)
                )
                conn.commit()
                return 0, doc_id
            else:
                return 0, doc_id

        cur.execute("""SELECT column_name FROM information_schema.columns
                       WHERE table_name='SourceDocument' AND column_name='source_url'""")
        has_source_url = cur.fetchone() is not None

        if has_source_url and source_url:
            cur.execute(
                'INSERT INTO "SourceDocument" (id, content, filename, source, source_url, created_at) '
                'VALUES (gen_random_uuid(), %s, %s, %s, %s, now()) RETURNING id',
                (unique_key, result['filename'], result['source'], source_url)
            )
        else:
            cur.execute(
                'INSERT INTO "SourceDocument" (id, content, filename, source, created_at) '
                'VALUES (gen_random_uuid(), %s, %s, %s, now()) RETURNING id',
                (unique_key, result['filename'], result['source'])
            )
        doc_id = cur.fetchone()[0]

        cur.execute("""SELECT column_name FROM information_schema.columns
                       WHERE table_name='SourceDocumentSegment' AND column_name='document_id'""")
        has_document_id = cur.fetchone() is not None

        cur.execute("""SELECT column_name FROM information_schema.columns
                       WHERE table_name='SourceDocumentSegment' AND column_name='article_number'""")
        has_article = cur.fetchone() is not None

        columns = ['id', 'content', '"sourceDocumentid"', 'vector', '"createdAt"', 'chunk_index', 'page_number', 'tags']
        placeholders = ['gen_random_uuid()', '%s', '%s', '%s::vector', 'now()', '%s', '%s', '%s::jsonb']

        if has_document_id:
            columns.append('document_id')
            placeholders.append('%s')

        if has_article:
            columns.append('article_number')
            placeholders.append('%s')

        columns_str = ', '.join(columns)
        placeholders_str = ', '.join(placeholders)

        rows = []
        for c in result['chunks']:
            row = [
                c['text'],
                doc_id,
                json.dumps(c['embedding']),
                c['chunk_index'],
                c['page_number'],
                json.dumps(c['tags'])
            ]

            if has_document_id:
                row.append(doc_id)

            if has_article:
                row.append(c.get('article_number') or 0)

            rows.append(row)

        query = f'''INSERT INTO "SourceDocumentSegment"
                    ({columns_str})
                    VALUES ({placeholders_str})'''

        cur.executemany(query, rows)
        conn.commit()
        return len(result['chunks']), doc_id
    except Exception as e:
        conn.rollback()
        print(f"❌ Erreur insertion: {e}")
        import traceback
        traceback.print_exc()
        return 0, None
    finally:
        cur.close()


# ─────────────────────────────────────────────
# TRAITEMENT D'UN FICHIER - VERSION AMÉLIORÉE
# ─────────────────────────────────────────────
def process_and_insert(file_info, log_buf=None, force_update_url=True):
    source = file_info['source']
    filename = file_info['filename']
    path = file_info['path']
    relative_path = file_info['relative_path']
    extension = file_info.get('extension', '.pdf')

    unique_key = f"{source}/{relative_path}".replace("\\", "/")

    if not force_update_url:
        already_done = load_progress()
        if unique_key in already_done:
            return 0, 'skipped'

    conn = get_db_connection()
    cur = conn.cursor()

    doc_exists = False
    doc_has_url = False
    doc_id = None

    try:
        cur.execute('SELECT id, source_url FROM "SourceDocument" WHERE content = %s', (unique_key,))
        row = cur.fetchone()
        if row:
            doc_exists = True
            doc_id = row[0]
            doc_has_url = row[1] is not None and row[1] != ''
    except Exception as e:
        print(f"⚠️ Erreur vérification: {e}")
    finally:
        cur.close()

    if doc_exists and doc_has_url and not force_update_url:
        save_progress(unique_key, 'skipped')
        return 0, 'skipped'

    if doc_exists and not doc_has_url:
        if log_buf:
            log_buf.append(f"🔄 Document existant sans URL: {filename}")

    source_url = find_source_url(source, relative_path, filename)

    if doc_exists and not doc_has_url and source_url:
        try:
            cur = conn.cursor()
            cur.execute('UPDATE "SourceDocument" SET source_url = %s WHERE id = %s', (source_url, doc_id))
            conn.commit()
            if log_buf:
                log_buf.append(f"✅ URL ajoutée à {filename}: {source_url[:60]}...")
            save_progress(unique_key, 'updated')
            return 0, 'url_updated'
        except Exception as e:
            conn.rollback()
            if log_buf:
                log_buf.append(f"❌ Erreur mise à jour URL: {str(e)[:60]}")
        finally:
            cur.close()
            return 0, 'error'

    if doc_exists and doc_has_url:
        save_progress(unique_key, 'skipped')
        return 0, 'skipped'

    if source_url and log_buf:
        log_buf.append(f"🔗 URL trouvée: {source_url[:60]}...")
    elif log_buf:
        log_buf.append(f"⚠️ Aucune URL trouvée pour {filename}")

    try:
        text, pages, err = extract_from_file(path)
        if err or not text:
            if log_buf:
                log_buf.append(f"❌ Extraction échouée ({extension}): {err[:60] if err else 'vide'}")
            return 0, 'error'
    except Exception as e:
        if log_buf:
            log_buf.append(f"❌ Erreur extraction ({extension}): {str(e)[:60]}")
        return 0, 'error'

    meta = extract_legal_metadata(text, filename, source)
    meta['source_url'] = source_url
    meta['file_type'] = extension

    article_num = extract_article_number(text)

    chunks = chunk_text_by_words(text)

    if not chunks:
        if log_buf:
            log_buf.append(f"⚠️ {filename}: aucun chunk créé")
        return 0, 'error'

    try:
        embeddings = embedding_model.encode(
            [c[:512] for c in chunks],
            batch_size=EMBEDDING_BATCH_SIZE,
            show_progress_bar=False
        )
    except Exception as e:
        if log_buf:
            log_buf.append(f"❌ Erreur embedding: {str(e)[:60]}")
        return 0, 'error'

    result = {
        'filename': filename,
        'relative_path': relative_path,
        'source': source,
        'source_url': source_url,
        'chunks': [],
        'meta': meta,
        'file_type': extension,
    }

    tags = generate_tags(text, filename, meta)
    tags.append(f"type_{extension.replace('.', '')}")

    for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        chunk_data = {
            'text': chunk,
            'embedding': emb.tolist(),
            'chunk_index': i,
            'page_number': 1,
            'tags': tags,
            'article_number': article_num,
        }
        result['chunks'].append(chunk_data)

    try:
        chunks_count, doc_id = insert_document(result)
        if chunks_count > 0:
            save_progress(unique_key, 'inserted')
            if log_buf:
                url_info = f" (URL: {source_url})" if source_url else " (sans URL)"
                log_buf.append(f"✅ {filename} [{extension}]: {chunks_count} chunks{url_info}")
            return chunks_count, 'inserted'
        else:
            if chunks_count == 0 and doc_id:
                if log_buf:
                    log_buf.append(f"🔄 {filename}: document existant mis à jour")
                return 0, 'updated'
            if log_buf:
                log_buf.append(f"⚠️ {filename}: insertion 0 chunks")
            return 0, 'error'
    except Exception as e:
        if log_buf:
            log_buf.append(f"❌ {filename}: {str(e)[:60]}")
        return 0, 'error'


# ─────────────────────────────────────────────
# FONCTION PRINCIPALE - VERSION AMÉLIORÉE
# ─────────────────────────────────────────────
def index_all_files(force_update_urls=True):
    """
    Fonction principale pour indexer tous les fichiers supportés (PDF et TXT).
    """
    print(f"\n{'=' * 70}")
    print(f"📚 DÉMARRAGE DE L'INDEXATION")
    if force_update_urls:
        print("🔄 Mode: mise à jour des URLs manquantes activée")
    print(f"  📁 Types supportés: {', '.join(SUPPORTED_EXTENSIONS)}")
    print(f"{'=' * 70}")

    try:
        conn = get_db_connection()
        print(f"✅ Connexion à la base de données OK")
        total_existing, seg_existing, by_source = show_indexation_status(conn)
    except Exception as e:
        print(f"❌ Erreur de connexion à la DB: {e}")
        return

    files = get_files_recursive()

    pdf_count = sum(1 for f in files if f.get('extension', '.pdf') == '.pdf')
    txt_count = sum(1 for f in files if f.get('extension') == '.txt')

    print(f"\n📁 {len(files)} fichiers trouvés:")
    print(f"  - PDF: {pdf_count} fichiers")
    print(f"  - TXT: {txt_count} fichiers")
    for source, files_list in [(s, [f for f in files if f['source'] == s]) for s in FOLDERS.keys()]:
        pdf_src = sum(1 for f in files_list if f.get('extension', '.pdf') == '.pdf')
        txt_src = sum(1 for f in files_list if f.get('extension') == '.txt')
        print(f"  - {source}: {len(files_list)} fichiers (PDF: {pdf_src}, TXT: {txt_src})")

    if not files:
        print("⚠️ Aucun fichier trouvé")
        return

    to_process = []
    need_url_update = []

    for file_info in files:
        unique_key = f"{file_info['source']}/{file_info['relative_path']}".replace("\\", "/")
        progress = load_progress()

        if unique_key in progress:
            if force_update_urls:
                try:
                    cur = conn.cursor()
                    cur.execute('SELECT source_url FROM "SourceDocument" WHERE content = %s', (unique_key,))
                    row = cur.fetchone()
                    cur.close()
                    if row and (row[0] is None or row[0] == ''):
                        need_url_update.append(file_info)
                except Exception as e:
                    print(f"⚠️ Erreur vérification URL: {e}")
        else:
            to_process.append(file_info)

    print(f"\n📝 Fichiers à traiter:")
    print(f"  - Nouveaux fichiers: {len(to_process)}")
    if force_update_urls:
        print(f"  - Fichiers avec URL manquante: {len(need_url_update)}")

    to_process.extend(need_url_update)

    if not to_process:
        print("✅ Tous les fichiers sont déjà indexés avec leurs URLs")
        return

    stats = {
        'total': len(to_process),
        'processed': 0,
        'inserted': 0,
        'updated_urls': 0,
        'errors': 0,
        'skipped': 0,
        'pdf_processed': 0,
        'txt_processed': 0,
        'start_time': time.time()
    }

    log_buffers = {i: [] for i in range(PARALLEL_WORKERS)}

    print(f"\n⚙️  Traitement avec {PARALLEL_WORKERS} workers...")
    print(f"📊 {stats['total']} fichiers à traiter\n")

    pbar = tqdm(total=stats['total'],
                desc="Progression",
                bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}] {postfix}')

    with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as executor:
        futures = {
            executor.submit(process_and_insert, file_info, log_buffers[i % PARALLEL_WORKERS], force_update_urls):
                (file_info, i % PARALLEL_WORKERS)
            for i, file_info in enumerate(to_process)
        }

        for future in as_completed(futures):
            file_info, worker_id = futures[future]
            try:
                count, status = future.result(timeout=300)
                stats['processed'] += 1

                if file_info.get('extension', '.pdf') == '.pdf':
                    stats['pdf_processed'] += 1
                else:
                    stats['txt_processed'] += 1

                if status == 'inserted':
                    stats['inserted'] += 1
                elif status == 'url_updated':
                    stats['updated_urls'] += 1
                elif status == 'updated':
                    stats['updated_urls'] += 1
                elif status == 'error':
                    stats['errors'] += 1
                else:
                    stats['skipped'] += 1
            except Exception as e:
                stats['errors'] += 1
                print(f"❌ Erreur worker pour {file_info['filename']}: {e}")

            pbar.set_postfix({
                'ins': stats['inserted'],
                'url_upd': stats['updated_urls'],
                'err': stats['errors'],
                'skip': stats['skipped']
            })
            pbar.update(1)

    pbar.close()

    elapsed_time = time.time() - stats['start_time']
    hours = int(elapsed_time // 3600)
    minutes = int((elapsed_time % 3600) // 60)
    seconds = int(elapsed_time % 60)

    print(f"\n{'=' * 70}")
    print(f"📋 RÉSUMÉ DES OPÉRATIONS:")
    print(f"{'=' * 70}")

    print(f"\n  📊 Par type de fichier:")
    print(f"    - PDF traités: {stats['pdf_processed']}")
    print(f"    - TXT traités: {stats['txt_processed']}")

    print(f"\n  📈 Résultats:")
    print(f"    - Total traités: {stats['processed']}")
    print(f"    - Nouveaux documents insérés: {stats['inserted']}")
    print(f"    - URLs mises à jour: {stats['updated_urls']}")
    print(f"    - Erreurs: {stats['errors']}")
    print(f"    - Ignorés: {stats['skipped']}")
    print(f"  ⏱️  Temps écoulé: {hours:02d}h {minutes:02d}m {seconds:02d}s")

    if stats['processed'] > 0:
        success_rate = ((stats['inserted'] + stats['updated_urls']) / stats['processed'] * 100)
        print(f"  📈 Taux de réussite: {success_rate:.1f}%")

    show_indexation_status(conn)
    close_all_connections()


# ─────────────────────────────────────────────
# FONCTION POUR METTRE À JOUR UNIQUEMENT LES URLs
# ─────────────────────────────────────────────
def update_missing_urls():
    """
    Fonction spécifique pour mettre à jour les URLs manquantes sans réindexer les documents.
    """
    print(f"\n{'=' * 70}")
    print(f"🔄 MISE À JOUR DES URLs MANQUANTES")
    print(f"{'=' * 70}")

    try:
        conn = get_db_connection()
        print(f"✅ Connexion à la base de données OK")
    except Exception as e:
        print(f"❌ Erreur de connexion à la DB: {e}")
        return

    try:
        cur = conn.cursor()
        cur.execute('''
            SELECT id, content, filename, source 
            FROM "SourceDocument" 
            WHERE source_url IS NULL OR source_url = ''
        ''')
        docs_without_url = cur.fetchall()
        cur.close()

        print(f"\n📝 {len(docs_without_url)} documents trouvés sans URL")

        if not docs_without_url:
            print("✅ Tous les documents ont une URL")
            return

        stats = {
            'total': len(docs_without_url),
            'updated': 0,
            'not_found': 0,
            'errors': 0
        }

        with tqdm(total=stats['total'], desc="Mise à jour URLs") as pbar:
            for doc_id, content, filename, source in docs_without_url:
                parts = content.split("/", 1)
                if len(parts) == 2:
                    relative_path = parts[1]
                else:
                    relative_path = ""

                source_url = find_source_url(source, relative_path, filename)

                if source_url:
                    try:
                        cur = conn.cursor()
                        cur.execute('UPDATE "SourceDocument" SET source_url = %s WHERE id = %s', (source_url, doc_id))
                        conn.commit()
                        cur.close()
                        stats['updated'] += 1
                    except Exception as e:
                        conn.rollback()
                        stats['errors'] += 1
                        print(f"\n  ❌ {filename}: Erreur mise à jour - {e}")
                else:
                    stats['not_found'] += 1
                    if stats['not_found'] % 10 == 0:
                        print(f"\n  ⚠️ {filename}: Aucune URL trouvée")

                pbar.set_postfix({
                    'upd': stats['updated'],
                    'not': stats['not_found'],
                    'err': stats['errors']
                })
                pbar.update(1)

        print(f"\n{'=' * 70}")
        print(f"✅ MISE À JOUR TERMINÉE")
        print(f"{'=' * 70}")
        print(f"  - Total traités: {stats['total']}")
        print(f"  - URLs ajoutées: {stats['updated']}")
        print(f"  - URLs non trouvées: {stats['not_found']}")
        print(f"  - Erreurs: {stats['errors']}")

    except Exception as e:
        print(f"❌ Erreur: {e}")
        import traceback
        traceback.print_exc()
    finally:
        close_all_connections()


# ─────────────────────────────────────────────
# POINT D'ENTRÉE
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Indexation des fichiers juridiques tunisiens (PDF et TXT)')
    parser.add_argument('--update-urls', action='store_true',
                        help='Met à jour les URLs manquantes sans réindexer')
    parser.add_argument('--force', action='store_true',
                        help='Force la mise à jour des URLs même pour les documents existants')
    parser.add_argument('--no-update', action='store_true',
                        help='Désactive la mise à jour des URLs (seulement nouveaux documents)')

    args = parser.parse_args()

    try:
        if args.update_urls:
            update_missing_urls()
        else:
            force_update = not args.no_update
            index_all_files(force_update_urls=force_update)
    except KeyboardInterrupt:
        print("\n⏹️  Indexation interrompue par l'utilisateur")
    except Exception as e:
        print(f"\n❌ Erreur fatale: {e}")
        import traceback

        traceback.print_exc()
    finally:
        close_all_connections()
        print("\n🧹 Connexions fermées")