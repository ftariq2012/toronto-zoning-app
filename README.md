# Municipal Zoning Lookup

A local zoning lookup app using React, Vite, Leaflet, Turf.js, FastAPI, and PostGIS.

The app currently supports Toronto and Brampton. Users can pick a municipality, click a zoning polygon, or search an address where address coordinates are available. The side panel returns normalized zoning details, by-law references, plain-English summaries, and advanced raw data.

Toronto data comes from City of Toronto Open Data through the CKAN API. Brampton zoning polygons are loaded through a FastAPI proxy to Brampton's ArcGIS REST zoning service.

## Project Structure

```text
toronto-zoning-app/
  backend/
  data/raw/
  frontend/
  frontend/public/data/
  scripts/
  docker-compose.yml
```

## Database Port

Local PostgreSQL may already use port `5432`, so this project maps Docker PostGIS to host port `5433`.

Local development database URL:

```text
postgresql+psycopg://postgres:postgres@localhost:5433/zoning_db
```

## Prerequisites

- Docker Desktop
- Python 3.11+
- Node.js

## Start PostGIS

```bash
docker compose up -d db
```

## Install Backend Dependencies

```bash
cd backend
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\activate
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Copy environment settings:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## Download, Prepare, and Load Data

From the project root:

```bash
python scripts/download_zoning_from_api.py
python scripts/prepare_all_zoning_data.py
python scripts/load_to_postgis.py
```

Raw official data is downloaded into:

```text
data/raw/
```

Cleaned frontend-ready GeoJSON files are written to:

```text
frontend/public/data/
```

The PostGIS loader currently creates Toronto tables:

- `zoning_area`
- `zoning_height_overlay`
- `zoning_lot_coverage_overlay`
- `parking_zone_overlay`
- `zoning_building_setback_overlay`
- `zoning_policy_area_overlay`
- `zoning_policy_road_overlay`
- `zoning_priority_retail_street_overlay`
- `zoning_rooming_house_overlay`
- `address_points`

Brampton is proxied from ArcGIS for this phase and is not loaded into PostGIS yet.

## Run Backend

From `backend/`:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

Useful local URLs:

```text
http://127.0.0.1:8010/health
http://127.0.0.1:8010/docs
http://127.0.0.1:8010/api/zoning?lat=43.6532&lng=-79.3832
http://127.0.0.1:8010/api/municipalities
http://127.0.0.1:8010/api/municipalities/brampton/zoning-geojson
http://127.0.0.1:8010/api/municipalities/brampton/overlays
```

## Run Frontend

From `frontend/`:

```bash
npm install
npm run dev
```

The frontend uses:

```text
VITE_API_URL=http://127.0.0.1:8010
```

See `frontend/.env.example`.

## Frontend Deployment

The frontend remains deployable to Vercel as a static Vite app. The FastAPI backend and PostGIS database need separate hosting for production.

## Current Architecture

```text
Brampton ArcGIS REST services are proxied through FastAPI so the frontend does not depend directly on the external service.

```text
City of Toronto CKAN API / Brampton ArcGIS REST
  -> Python download/prepare scripts
  -> PostGIS for Toronto, backend proxy for Brampton
  -> FastAPI
  -> React + Leaflet frontend
```

The frontend still has a local GeoJSON fallback for development, but the backend is preferred for address search, zoning lookup, and overlay matching.

## Production Direction

Future production work should include:

- Hosted PostGIS
- Hosted FastAPI
- Scheduled CKAN refresh jobs
- Server-side address search and spatial indexes
- Better frontend loading states
- Additional GTA municipalities

## Disclaimer

This tool is for informational purposes only and is not legal or planning advice. Zoning information may be affected by exceptions, site-specific amendments, former by-laws, appeals, or other conditions. Always verify zoning information with the official municipality before making planning, building, or purchasing decisions.
