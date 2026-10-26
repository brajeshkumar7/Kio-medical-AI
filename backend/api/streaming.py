import json
from collections.abc import Iterable

from flask import Response


def stream_event(event_type: str, **payload) -> str:
    return json.dumps({"type": event_type, **payload}, ensure_ascii=False) + "\n"


def ndjson_response(events: Iterable[str]) -> Response:
    response = Response(events, content_type="application/x-ndjson; charset=utf-8")
    response.headers["Cache-Control"] = "no-cache, no-transform"
    response.headers["X-Accel-Buffering"] = "no"
    return response
