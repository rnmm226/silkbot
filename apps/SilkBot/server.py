print("1️⃣ START SERVER")

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
    return [" ".join(words[i:i+size]) for i in range(0, len(words), size)]


# ─────────────────────────────
# UPLOAD (DEBUG + SAFE)
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

        cur.execute(
            'INSERT INTO "SourceDocument" (id, content, created_at) VALUES (%s, %s, now())',
            (doc_id, file.filename)
        )

        chunks = chunk_text(text)
        print("🔪 chunks:", len(chunks))

        for i, chunk in enumerate(chunks):
            emb = model.encode(chunk).tolist()

            cur.execute(
                """
                INSERT INTO "SourceDocumentSegment"
                (id, content, "sourceDocumentid", vector, created_at, chunk_index)
                VALUES (gen_random_uuid(), %s, %s, %s::vector, now(), %s)
                """,
                (chunk, doc_id, json.dumps(emb), i)
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
# GET DOCUMENT (DEBUG COMPLET)
# ─────────────────────────────

@app.get("/document/{doc_id}")
async def get_document(doc_id: str):

    print("📄 REQUEST DOC_ID:", doc_id)

    import glob

    # cherche fichier correspondant
    files = glob.glob(f"./docs/{doc_id}.*")

    print("📁 MATCHED FILES:", files)

    if not files:
        print("❌ NOT FOUND")
        raise HTTPException(404, "Document non trouvé")

    return FileResponse(files[0])
# ─────────────────────────────
# SEARCH (DEBUG)
# ─────────────────────────────

class SearchRequest(BaseModel):
    question: str


@app.post("/search")
async def search(req: SearchRequest):

    print("\n================ SEARCH =================")
    print("❓ question:", req.question)

    emb = model.encode(req.question).tolist()
    emb_str = json.dumps(emb)

    conn = psycopg.connect(DB_URL)
    cur = conn.cursor()

    cur.execute("""
        SELECT seg.content, doc.content, seg.chunk_index,
               1 - (seg.vector <=> %s::vector) AS similarity
        FROM "SourceDocumentSegment" seg
        JOIN "SourceDocument" doc ON doc.id = seg."sourceDocumentid"
        ORDER BY seg.vector <=> %s::vector
        LIMIT 20
    """, (emb_str, emb_str))

    rows = cur.fetchall()
    conn.close()

    print("📊 rows found:", len(rows))

    chunks = []

    for content, filename, chunk_index, sim in rows:
        print("➡️ sim:", sim)

        if sim is None:
            continue

        if float(sim) < 0.05:
            continue

        chunks.append({
            "filename": filename,
            "chunk_index": chunk_index,
            "content": content,
            "similarity": round(float(sim), 4)
        })

    print("✅ chunks kept:", len(chunks))
    print("========================================\n")

    return {
        "chunks": chunks,
        "context": "\n".join(c["content"] for c in chunks)
    }
