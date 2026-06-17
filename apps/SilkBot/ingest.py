import psycopg
import os
from sentence_transformers import SentenceTransformer

# 1. Charger le modèle d'embedding
model = SentenceTransformer("all-MiniLM-L6-v2")

# 2. Connexion PostgreSQL
conn = psycopg.connect(
    "postgresql://postgres:secret123@localhost:5432/monapp"
)
cur = conn.cursor()

# 3. Lire les fichiers depuis le dossier "docs"
folder_path = "docs"
documents = []

for filename in os.listdir(folder_path):
    file_path = os.path.join(folder_path, filename)
    if filename.endswith((".txt", ".md", ".csv")):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            documents.append((content, filename))  # (texte, nom du fichier)

# 4. Insérer chaque document avec embedding
for content, source in documents:
    embedding = model.encode(content).tolist()

    cur.execute(
        """
        INSERT INTO document_chunks (content, source, embedding)
        VALUES (%s, %s, %s)
        """,
        (content, source, embedding)
    )

conn.commit()
cur.close()
conn.close()

print(f"✅ {len(documents)} documents insérés avec succès")