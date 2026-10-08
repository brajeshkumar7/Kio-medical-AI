from flask import Blueprint, request, jsonify
from src.ai.rag_pipeline import create_rag_chain

# Create API Blueprint
api_bp = Blueprint("api", __name__)

# Lazy-loaded RAG chain to optimize application startup
_rag_chain = None

def get_rag_chain():
    global _rag_chain
    if _rag_chain is None:
        print("[RAG] Initializing RAG chain retrieval components...")
        _rag_chain = create_rag_chain()
    return _rag_chain

@api_bp.route("/")
def index():
    """
    API Healthcheck route. Returns status information.
    """
    return jsonify({
        "status": "healthy",
        "service": "Medical Chatbot GenAI Backend API",
        "models": {
            "embeddings": "nvidia/llama-nemotron-embed-vl-1b-v2:free",
            "llm": "nvidia/nemotron-3.5-content-safety:free"
        }
    }), 200

@api_bp.route("/get", methods=["GET", "POST"])
def chat():
    """
    Handles chatbot Q&A input, runs the RAG query pipeline, and returns the response.
    """
    if request.method == "POST":
        msg = request.form.get("msg")
    else:
        msg = request.args.get("msg")

    if not msg:
        return jsonify({"error": "Empty message or missing 'msg' parameter"}), 400

    print(f"[API] Query received: {msg}")
    
    try:
        chain = get_rag_chain()
        response = chain.invoke({"input": msg})
        answer = response.get("answer", "Unable to formulate a response based on context.")
        print(f"[API] Query response: {answer}")
        
        # Return structured JSON for easier UI parsing
        return jsonify({
            "query": msg,
            "answer": answer
        }), 200
    except Exception as e:
        print(f"[API] Error invoking RAG chain: {str(e)}")
        return jsonify({"error": f"An error occurred while generating a response: {str(e)}"}), 500
