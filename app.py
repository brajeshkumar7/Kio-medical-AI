from backend.config import Settings
from backend.web import create_app

app = create_app()

if __name__ == "__main__":
    settings = Settings.from_env()
    app.run(host=settings.host, port=settings.port, debug=settings.debug)
