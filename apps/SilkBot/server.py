# server.py - Version corrigée
print("1️⃣ START SERVER")
print("🚀 SERVER VERSION 2026")
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import psycopg
from sentence_transformers import SentenceTransformer

import os
import json
import fitz
import uuid

# ─────────────────────────────
# INIT
# ─────────────────────────────

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

print("2️⃣ CORS OK")

model = SentenceTransformer("all-MiniLM-L6-v2")
print("3️⃣ MODEL LOADED")

DB_URL = "postgresql://postgres:secret123@localhost:5432/monapp"
CHUNK_SIZE = 100

os.makedirs("./docs", exist_ok=True)
print("4️⃣ DOCS FOLDER READY")


# ─────────────────────────────
# UTILS
# ─────────────────────────────

def chunk_text(text: str, size=CHUNK_SIZE):
    words = text.split()
    return [" ".join(words[i:i + size]) for i in range(0, len(words), size)]


# ─────────────────────────────
# SEARCH FUNCTION (DÉFINIE AVANT UTILISATION)
# ─────────────────────────────

def search_semantic(query: str):
    """Fonction de recherche sémantique réutilisable"""
    print(f"\n🔍 Recherche sémantique: {query}")

    emb = model.encode(query).tolist()
    emb_str = json.dumps(emb)

    conn = psycopg.connect(DB_URL)
    cur = conn.cursor()

    cur.execute("""
    SELECT
        seg.id,
        doc.id,
        doc.filename,
        doc.source,
        seg.page_number,
        seg.chunk_index,
        seg.content,
        seg.tags,
        seg.article_number,
        1 - (seg.vector <=> %s::vector) AS similarity
    FROM "SourceDocumentSegment" seg
    JOIN "SourceDocument" doc
    ON doc.id = seg."sourceDocumentid"
    ORDER BY seg.vector <=> %s::vector
    LIMIT 20
    """, (emb_str, emb_str))

    rows = cur.fetchall()
    conn.close()

    print(f"📊 rows found: {len(rows)}")

    chunks = []

    for (
            chunk_id,
            document_id,
            filename,
            source,
            page,
            chunk_index,
            content,
            tags,
            article_number,
            sim
    ) in rows:

        if sim is None:
            continue

        if float(sim) < 0.05:
            continue

        chunks.append({
            "chunk_id": chunk_id,
            "document_id": document_id,
            "filename": filename,
            "source": source,
            "page": page,
            "chunk_index": chunk_index,
            "content": content,
            "similarity": round(float(sim), 4),
            "score": float(sim),
            "tags": tags,
            "article_number": article_number
        })

    print(f"✅ chunks kept: {len(chunks)}")

    return {
        "chunks": chunks,
        "context": "\n".join(c["content"] for c in chunks)
    }


# ─────────────────────────────
# UPLOAD
# ─────────────────────────────

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    print("\n================ UPLOAD =================")
    print("📥 filename:", file.filename)
    print("📥 content_type:", file.content_type)

    content = await file.read()
    print("📦 file size:", len(content))

    if not content:
        print("❌ EMPTY FILE")
        raise HTTPException(400, "Fichier vide")

    doc_id = str(uuid.uuid4())
    print("🆔 GENERATED doc_id:", doc_id)

    ext = ".pdf" if file.content_type == "application/pdf" else ".txt"
    file_path = f"./docs/{doc_id}{ext}"

    print("💾 saving to:", file_path)

    with open(file_path, "wb") as f:
        f.write(content)

    exists = os.path.exists(file_path)
    print("✅ FILE EXISTS:", exists)

    # extract text
    try:
        if file.content_type == "application/pdf":
            pdf = fitz.open(file_path)
            text = "\n".join([p.get_text() for p in pdf])
            pdf.close()
        else:
            text = content.decode("utf-8", errors="ignore")

        print("📄 extracted text length:", len(text))

    except Exception as e:
        print("❌ TEXT EXTRACTION ERROR:", e)
        raise HTTPException(500, "Erreur extraction PDF")

    if not text.strip():
        print("❌ EMPTY TEXT AFTER PARSING")
        raise HTTPException(400, "Texte vide")

    # DB
    conn = psycopg.connect(DB_URL)
    cur = conn.cursor()

    try:
        print("🗄️ inserting document in DB")

        source = "upload"

        cur.execute(
            """
            INSERT INTO "SourceDocument"
            (id, content, filename, source, created_at)
            VALUES (%s, %s, %s, %s, now())
            """,
            (
                doc_id,
                text,
                file.filename,
                source
            )
        )

        chunks = chunk_text(text)
        print("🔪 chunks:", len(chunks))

        for i, chunk in enumerate(chunks):
            emb = model.encode(chunk).tolist()

            cur.execute(
                """
                INSERT INTO "SourceDocumentSegment"
                (
                    id,
                    content,
                    "sourceDocumentid",
                    vector,
                    article_number,
                    chunk_index,
                    "createdAt",
                    page_number,
                    tags
                )
                VALUES
                (
                    gen_random_uuid(),
                    %s,
                    %s,
                    %s::vector,
                    NULL,
                    %s,
                    now(),
                    1,
                    '{}'::jsonb
                )
                """,
                (
                    chunk,
                    doc_id,
                    json.dumps(emb),
                    i
                )
            )

        conn.commit()
        print("✅ DB COMMIT DONE")

    except Exception as e:
        conn.rollback()
        print("❌ DB ERROR:", e)
        raise HTTPException(500, str(e))

    finally:
        conn.close()

    print("🎉 UPLOAD COMPLETE")
    print("========================================\n")

    return {
        "success": True,
        "doc_id": doc_id,
        "file_path": file_path,
        "chunks": len(chunks)
    }


# ─────────────────────────────
# MODELS
# ─────────────────────────────

class SearchRequest(BaseModel):
    question: str


class ArticleRequest(BaseModel):
    article: str


class DocumentRequest(BaseModel):
    filename: str


# ─────────────────────────────
# ENDPOINTS
# ─────────────────────────────

@app.get("/document/{doc_id}")
async def get_document(doc_id: str):
    print("📄 REQUEST DOC_ID:", doc_id)
    import glob

    files = glob.glob(f"./docs/{doc_id}.*")
    print("📁 MATCHED FILES:", files)

    if not files:
        print("❌ NOT FOUND")
        raise HTTPException(404, "Document non trouvé")

    return FileResponse(files[0])


@app.post("/search")
async def search(req: SearchRequest):
    """Endpoint de recherche sémantique principal"""
    return search_semantic(req.question)


@app.post("/search/articles")
async def search_articles(request: SearchRequest):
    """Recherche spécifique dans les articles de loi"""
    try:
        print(f"\n🔍 Recherche articles: {request.question}")
        results = search_semantic(request.question)

        articles = []
        for chunk in results.get("chunks", []):
            content = chunk.get("content", "").lower()
            if "article" in content or "art." in content or "code" in content:
                articles.append(chunk)

        print(f"✅ {len(articles)} articles trouvés")
        return {"chunks": articles[:20]}
    except Exception as e:
        print(f"❌ Error in search_articles: {e}")
        return {"chunks": []}


@app.post("/search/tags")
async def search_tags(request: SearchRequest):
    """Recherche par tags/mots-clés"""
    try:
        print(f"\n🔍 Recherche tags: {request.question}")
        tags = request.question.split(",")
        tags = [tag.strip().lower() for tag in tags]

        results = search_semantic(request.question)

        filtered = []
        for chunk in results.get("chunks", []):
            content = chunk.get("content", "").lower()
            if any(tag in content for tag in tags):
                filtered.append(chunk)

        if not filtered:
            return results

        print(f"✅ {len(filtered)} chunks avec tags")
        return {"chunks": filtered[:20]}
    except Exception as e:
        print(f"❌ Error in search_tags: {e}")
        return {"chunks": []}


@app.post("/search/documents")
async def search_document(req: DocumentRequest):
    """Recherche par nom de document"""
    print(f"\n🔍 Recherche document: {req.filename}")

    conn = psycopg.connect(DB_URL)
    cur = conn.cursor()

    cur.execute("""
        SELECT
            id,
            filename,
            source,
            content
        FROM "SourceDocument"
        WHERE filename ILIKE %s
        ORDER BY filename
        LIMIT 50
    """, (f"%{req.filename}%",))

    rows = cur.fetchall()
    conn.close()

    docs = []
    for row in rows:
        docs.append({
            "document_id": row[0],
            "filename": row[1],
            "source": row[2],
            "content": row[3]
        })

    print(f"✅ {len(docs)} documents trouvés")
    return {"documents": docs}


@app.get("/documents/{doc_id}")
async def get_document_info(doc_id: str):
    """Récupère les informations d'un document"""
    print(f"\n🔍 Document info: {doc_id}")

    conn = psycopg.connect(DB_URL)
    cur = conn.cursor()

    cur.execute("""
        SELECT
            id,
            filename,
            source,
            content,
            created_at
        FROM "SourceDocument"
        WHERE id=%s
    """, (doc_id,))

    row = cur.fetchone()

    if not row:
        conn.close()
        raise HTTPException(404, "Document introuvable")

    cur.execute("""
        SELECT COUNT(*)
        FROM "SourceDocumentSegment"
        WHERE "sourceDocumentid"=%s
    """, (doc_id,))

    nb_chunks = cur.fetchone()[0]

    conn.close()

    return {
        "document_id": row[0],
        "filename": row[1],
        "source": row[2],
        "content": row[3],
        "created_at": row[4],
        "chunks": nb_chunks
    }


@app.get("/pages/{doc_id}/{page}")
async def get_page(doc_id: str, page: int):
    """Récupère une page spécifique d'un document"""
    print(f"\n🔍 Page {page} du document {doc_id}")

    conn = psycopg.connect(DB_URL)
    cur = conn.cursor()

    cur.execute("""
        SELECT
            id,
            chunk_index,
            content,
            tags,
            article_number
        FROM "SourceDocumentSegment"
        WHERE "sourceDocumentid"=%s
        AND page_number=%s
        ORDER BY chunk_index
    """, (doc_id, page))

    rows = cur.fetchall()
    conn.close()

    return {
        "document_id": doc_id,
        "page": page,
        "chunks": [
            {
                "chunk_id": r[0],
                "chunk_index": r[1],
                "content": r[2],
                "tags": r[3],
                "article_number": r[4]
            }
            for r in rows
        ]
    }


@app.get("/health")
async def health():
    """Endpoint de santé pour vérifier que l'API fonctionne"""
    return {
        "status": "healthy",
        "model": "all-MiniLM-L6-v2",
        "db": "connected"
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)