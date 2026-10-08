from src.api.app_factory import create_app
from src.config.settings import Settings

# Create Flask app instance using the modular factory
app = create_app()

if __name__ == '__main__':
    print(f"[Server] Launching Flask app on {Settings.HOST}:{Settings.PORT} (Debug={Settings.DEBUG})...")
    app.run(
        host=Settings.HOST,
        port=Settings.PORT,
        debug=Settings.DEBUG
    )
