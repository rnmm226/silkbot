import re
import pdfplumber
from sentence_transformers import SentenceTransformer


def extract_article_number(text):
    """Extrait le numéro d'article (ex: Art. 15, Article 16)"""
    match = re.search(r'Art\.?\s*(\d+)|Article\s*(\d+)', text, re.IGNORECASE)
    if match:
        return match.group(1) or match.group(2)
    return None


def extract_page_number_from_chunk(chunk_text, page_texts):
    """Trouve à quelle page appartient le chunk"""
    for page_num, page_content in enumerate(page_texts, 1):
        if chunk_text[:100] in page_content:
            return page_num
    return None


def index_documents():
    conn = psycopg.connect(DB_URL)
    cur = conn.cursor()

    for filename in os.listdir(FOLDER):
        if not filename.endswith('.pdf'):
            continue

        filepath = os.path.join(FOLDER, filename)

        # Extraire le texte page par page
        pages_text = []
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                pages_text.append(page.extract_text() or "")

        full_text = "\n".join(pages_text)
        chunks = chunk_text_with_overlap(full_text)

        # Insérer le document
        cur.execute(
            'INSERT INTO "SourceDocument" (id, content, created_at) VALUES (gen_random_uuid(), %s, now()) RETURNING id',
            (filename,)
        )
        doc_id = cur.fetchone()[0]

        for idx, chunk in enumerate(chunks):
            # Trouver la page de ce chunk
            page_num = extract_page_number_from_chunk(chunk, pages_text)
            article_num = extract_article_number(chunk)

            # Générer les tags
            tags = generate_tags(chunk, filename)

            embedding = model.encode(chunk).tolist()

            cur.execute(
                '''INSERT INTO "SourceDocumentSegment" 
                   (id, content, "sourceDocumentid", vector, created_at, 
                    chunk_index, page_number, tags, article_number)
                   VALUES (gen_random_uuid(), %s, %s, %s::vector, now(), %s, %s, %s, %s)''',
                (chunk, doc_id, json.dumps(embedding), idx, page_num, tags, article_num)
            )

        print(f"✅ {filename} : {len(chunks)} chunks, {len(set([c[5] for c in chunks if c[5]]))} pages")

    conn.commit()
    conn.close()
print("\n✅ Indexation terminée")