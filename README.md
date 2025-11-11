# MOOvies

Movie finder UI that combines TMDB data with AI-powered recommendations.

## Prerequisites

- Python 3.10+
- TMDB read access token (`TMDB_READ_TOKEN`)
- OpenAI API key (`OPENAI_API_KEY`)

Install dependencies:

```bash
pip install -r requirements.txt
```

Export your API keys before starting the server:

```bash
export OPENAI_API_KEY=sk-...
export TMDB_READ_TOKEN=eyJhb...
```

## Running the app

```bash
python server.py
```

Flask serves the static frontend from `http://localhost:5000`. The browser page calls the backend for everything, so the API keys stay server-side:

- `GET /api/movie?query=...` proxies TMDB search + cast + reviews data.
- `POST /api/recommend` sends the free-form description to OpenAI and returns clickable suggestions that re-use the TMDB search box automatically.

### Deployment note

The current EC2 deployment is reachable at `http://18.210.0.181:5000/` (update the security-group rule if you change the port).
