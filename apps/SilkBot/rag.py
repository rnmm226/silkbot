import os
from pathlib import Path


def load_env_file(env_path: Path | str = Path(__file__).resolve().parent / ".env"):
    env_path = Path(env_path)
    if not env_path.is_file():
        return

    with env_path.open("r", encoding="utf-8") as env_file:
        for line in env_file:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_env_file()
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

if not os.environ.get("HF_TOKEN"):
    raise RuntimeError("HF_TOKEN is not set. Add it to .env or your environment.")

import faiss
import numpy as np
from typing import List

from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModelForCausalLM
import fitz  # pymupdf


def load_folder_text(folder_path: str, chunk_size: int = 200) -> List[str]:  # ✅ 200 au lieu de 500
    if not os.path.isdir(folder_path):
        raise ValueError("Provided path is not a directory.")

    supported_ext = {".txt", ".md", ".csv", ".pdf"}
    docs = []

    for filename in os.listdir(folder_path):
        file_path = os.path.join(folder_path, filename)
        _, ext = os.path.splitext(filename)

        if ext.lower() not in supported_ext:
            continue

        try:
            if ext.lower() == ".pdf":
                pdf = fitz.open(file_path)
                text = "\n".join(page.get_text() for page in pdf)
                pdf.close()
            else:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    text = f.read()

            words = text.split()
            for i in range(0, len(words), chunk_size):
                chunk = " ".join(words[i:i + chunk_size])
                if chunk.strip():
                    docs.append(chunk)

        except Exception as e:
            print(f"Failed to read {filename}: {e}")

    if not docs:
        raise ValueError("No supported text files found in the folder.")

    return docs


class VectorStore:
    def __init__(self, embedding_dim: int):
        self.index = faiss.IndexFlatIP(embedding_dim)
        self.documents = []

    def add_documents(self, docs: List[str], embeddings: np.ndarray):
        if embeddings.shape[0] != len(docs):
            raise ValueError("Document count and embedding rows mismatch.")

        self.documents.extend(docs)
        norm_embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
        self.index.add(norm_embeddings.astype("float32"))

    def retrieve(self, embedding: np.ndarray, top_k: int = 3) -> List[str]:
        normalized = embedding / np.linalg.norm(embedding)
        scores, idxs = self.index.search(normalized.astype("float32"), top_k)

        results = []
        for i in idxs[0]:
            if 0 <= i < len(self.documents):
                results.append(self.documents[i])
        return results


class RAG:
    def __init__(self):
        self.embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        self.tokenizer = AutoTokenizer.from_pretrained("TinyLlama/TinyLlama-1.1B-Chat-v1.0")
        self.llm = AutoModelForCausalLM.from_pretrained("TinyLlama/TinyLlama-1.1B-Chat-v1.0")
        self.store = VectorStore(embedding_dim=384)

    def embed(self, texts: List[str]) -> np.ndarray:
        return np.array(self.embedder.encode(texts))

    def build_index_from_folder(self, folder: str):
        docs = load_folder_text(folder)  # chunk_size=200 par défaut
        embeddings = self.embed(docs)
        self.store.add_documents(docs, embeddings)

    def ask(self, question: str, top_k: int = 3) -> str:
        query_emb = self.embed([question])
        top_docs = self.store.retrieve(query_emb, top_k)

        context = "\n".join(top_docs)

        prompt = (
            "You are an assistant that answers using only the context below.\n\n"
            f"Context:\n{context}\n\n"
            f"Question: {question}\nAnswer:"
        )

        enc = self.tokenizer(          # ✅ truncation ajoutée
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=1800
        )
        out_tokens = self.llm.generate(**enc, max_new_tokens=150)  # ✅ temperature retiré
        return self.tokenizer.decode(out_tokens[0], skip_special_tokens=True)


if __name__ == "__main__":
    try:
        rag = RAG()
        folder_path = r"C:\Users\rnmdr\OneDrive\Documents\Stage\SilkBot\docs"
        rag.build_index_from_folder(folder_path)

        print("\n✅ Documents chargés. Pose tes questions (tape 'quit' pour quitter)\n")

        while True:
            question = input("Question: ").strip()
            if question.lower() in ("quit", "exit", "q"):
                print("Au revoir !")
                break
            if not question:
                continue

            response = rag.ask(question)
            print("\nAnswer:\n", response)
            print("-" * 50)

    except Exception as e:
        print("Error:", str(e))