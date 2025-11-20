import json
import os
import random
from typing import Dict, List, Optional

import firebase_admin
import requests
from firebase_admin import auth, credentials
from flask import Flask, jsonify, request, send_from_directory
from openai import OpenAI


def _build_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Export it before starting the server."
        )
    return OpenAI(api_key=api_key)


TMDB_BASE = "https://api.themoviedb.org/3"

app = Flask(__name__, static_folder="static", static_url_path="")
client = None

# Initialize Firebase Admin
cred = credentials.Certificate("firebase-credentials.json")
firebase_admin.initialize_app(cred)


@app.before_request
def ensure_client() -> None:
    """
    Lazily configure the OpenAI client so the process can start even if the key
    is injected later (e.g., via dotenv or container secret).
    """
    global client
    if client is None:
        client = _build_openai_client()


@app.get("/")
def login_page():
    return send_from_directory(app.static_folder, "login.html")


@app.get("/login")
def legacy_login_redirect():
    return send_from_directory(app.static_folder, "login.html")


@app.get("/app")
def app_shell():
    return send_from_directory(app.static_folder, "index.html")

@app.post("/api/verify-token")
def verify_token():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'No token provided'}), 401
    
    token = auth_header.split('Bearer ')[1]
    try:
        # Verify the ID token
        decoded_token = auth.verify_id_token(token)
        return jsonify({
            'uid': decoded_token['uid'],
            'email': decoded_token.get('email'),
            'email_verified': decoded_token.get('email_verified', False)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 401


@app.post("/api/recommend")
def recommend():
    payload = request.get_json(silent=True) or {}
    description = (payload.get("description") or "").strip()
    if not description:
        return jsonify({"error": "description is required"}), 400

    prompt = (
        "Return up to five movie titles that best match the following description, "
        "ranked from best to least likely match. Respond with JSON in the form "
        '{"recommendations": ["Title 1", "Title 2"]}. '
        f'Description: "{description}"'
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a movie recommendation engine."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )
    except Exception as err:  # pragma: no cover - network call
        return jsonify({"error": f"OpenAI request failed: {err}"}), 502

    content = response.choices[0].message.content
    recommendations = _extract_recommendations(content)
    if not recommendations:
        return (
            jsonify(
                {
                    "error": "OpenAI response did not contain recommendations.",
                    "raw": content,
                }
            ),
            502,
        )

    return jsonify({"recommendations": recommendations})


@app.get("/api/movie")
def movie_lookup():
    query = (request.args.get("query") or "").strip()
    if not query:
        return jsonify({"error": "query is required"}), 400

    try:
        search = tmdb_get("/search/movie", params={"query": query})
    except RuntimeError as err:
        return jsonify({"error": str(err)}), 500
    except requests.RequestException as err:  # pragma: no cover - network
        return jsonify({"error": f"TMDB search failed: {err}"}), 502

    results = (search or {}).get("results") or []
    if not results:
        return jsonify({"error": f'No results for "{query}"'}), 404

    movie = results[0]
    movie_id = movie.get("id")
    if not movie_id:
        return jsonify({"error": "TMDB result missing movie id."}), 502

    try:
        credits = tmdb_get(f"/movie/{movie_id}/credits")
        reviews = tmdb_get(f"/movie/{movie_id}/reviews")
    except requests.RequestException as err:  # pragma: no cover - network
        return jsonify({"error": f"TMDB detail fetch failed: {err}"}), 502

    return jsonify(
        {
            "movie": movie,
            "credits": (credits or {}).get("cast") or [],
            "reviews": (reviews or {}).get("results") or [],
        }
    )


@app.get("/api/random-movies")
def random_movies():
    try:
        feed = tmdb_get("/trending/movie/week")
    except RuntimeError as err:
        return jsonify({"error": str(err)}), 500
    except requests.RequestException as err:  # pragma: no cover - network
        return jsonify({"error": f"TMDB random fetch failed: {err}"}), 502

    results = (feed or {}).get("results") or []
    if not results:
        return jsonify({"results": []})

    sample_size = min(12, len(results))
    picks = random.sample(results, sample_size)
    payload = []
    for movie in picks:
        if not (movie.get("backdrop_path") or movie.get("poster_path")):
            continue
        payload.append(
            {
                "title": movie.get("title") or movie.get("name"),
                "backdrop_path": movie.get("backdrop_path"),
                "poster_path": movie.get("poster_path"),
            }
        )

    return jsonify({"results": payload})


def tmdb_get(path: str, params: Optional[Dict[str, str]] = None) -> Dict:
    token = os.getenv("TMDB_READ_TOKEN")
    if not token:
        raise RuntimeError("TMDB_READ_TOKEN is not set.")
    url = f"{TMDB_BASE}{path}"
    resp = requests.get(
        url,
        params=params,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def _extract_recommendations(content: str) -> List[str]:
    """
    Parse OpenAI JSON output and normalize to a list of strings.
    """
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return []

    recommendations = data.get("recommendations")
    if not isinstance(recommendations, list):
        return []

    cleaned: List[str] = []
    for item in recommendations:
        if isinstance(item, str):
            text = item.strip()
            if text:
                cleaned.append(text)
    return cleaned


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "0") not in {"0", "false", "False"}
    app.run(host="0.0.0.0", port=port, debug=debug)
