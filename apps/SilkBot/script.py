# search_api.py - Version complète et fonctionnelle
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg
import json
from sentence_transformers import SentenceTransformer
import os
import logging

# Configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # ✅ Permettre les requêtes depuis Next.js

DB_URL = "postgresql://postgres:secret123@localhost:5432/monapp"
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")


@app.route('/search', methods=['POST'])
def search():
    try:
        data = request.json
        query = data.get('query', '')
        top_k = data.get('top_k', 5)

        logger.info(f"📡 Requête reçue: '{query}' (top_k={top_k})")

        if not query:
            return jsonify({'error': 'Query vide'}), 400

        # Générer l'embedding
        query_embedding = embedding_model.encode(query).tolist()
        embedding_json = json.dumps(query_embedding)
        logger.info(f"✅ Embedding généré: {len(query_embedding)} dimensions")

        # Connexion à la base
        conn = psycopg.connect(DB_URL)
        cur = conn.cursor()

        # Recherche
        cur.execute("""
            SELECT 
                s.id,
                s.content,
                s.page_number,
                1 - (s.vector <=> %s::vector) AS similarity,
                s.document_id,
                d.filename,
                d.source,
                d.source_url
            FROM "SourceDocumentSegment" s
            JOIN "SourceDocument" d ON s."sourceDocumentid" = d.id
            WHERE s.vector IS NOT NULL
            ORDER BY s.vector <=> %s::vector
            LIMIT %s
        """, (embedding_json, embedding_json, top_k))

        results = cur.fetchall()
        cur.close()
        conn.close()

        logger.info(f"✅ {len(results)} résultats trouvés")

        return jsonify({
            'results': [{
                'chunk_id': r[0],
                'content': r[1],
                'page_number': r[2] or 1,
                'similarity': float(r[3]),
                'document_id': r[4],
                'filename': r[5],
                'source': r[6],
                'source_url': r[7],
            } for r in results]
        })
    except Exception as e:
        logger.error(f"❌ Erreur: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'all-MiniLM-L6-v2'})


if __name__ == '__main__':
    print("🚀 Démarrage de l'API de recherche...")
    print(f"📡 DB: {DB_URL}")
    print("🔗 http://localhost:5001")
    print("📌 Endpoint POST /search")
    print("📌 Endpoint GET /health")
    app.run(host='0.0.0.0', port=5001, debug=True) 