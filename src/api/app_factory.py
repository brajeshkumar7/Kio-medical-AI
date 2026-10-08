from flask import Flask
from flask_cors import CORS
from src.config.settings import Settings
from src.api.routes import api_bp

def create_app() -> Flask:
    """
    Flask Application Factory. Configures and registers app modules/blueprints.
    Enables CORS for frontend client API calls.
    """
    # Initialize Flask app as a headless API (removed template/static configs)
    app = Flask(__name__)
    
    # Bind configurations from the Settings object
    app.config.from_object(Settings)
    
    # Enable Cross-Origin Resource Sharing (CORS)
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    # Register Blueprint routes
    app.register_blueprint(api_bp)
    
    print("[App Factory] Flask Headless API application initialized with CORS.")
    return app
