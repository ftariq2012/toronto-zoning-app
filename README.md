# Toronto Zoning Lookup

A frontend-only Toronto zoning lookup prototype built with React, Vite, Leaflet, React Leaflet, and Turf.js.

The app displays City of Toronto zoning polygons. Users can click a polygon or search a Toronto address to see the main zoning record, parsed zoning rules, matching overlay data, by-law references, and collapsible raw data.

Data comes from [City of Toronto Open Data](https://open.toronto.ca/), including the Zoning By-law dataset and Address Points (Municipal) - Toronto One Address Repository.

## Project Structure

```text
toronto-zoning-app/
  data/raw/
  frontend/public/data/
  scripts/
  frontend/
```

## Setup

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/toronto-zoning-app.git
cd toronto-zoning-app
```

Create or activate a Python environment:

```bash
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

Install Python dependencies:

```bash
pip install -r requirements.txt
```

If using Conda:

```bash
conda create -n toronto-zoning python=3.11
conda activate toronto-zoning
conda install -c conda-forge geopandas pandas requests
```

## Download Official Data

Download official Toronto zoning and address data:

```bash
python scripts/download_zoning_from_api.py
```

Raw official data is downloaded into:

```text
data/raw/
```

The downloader uses Toronto's CKAN API. It downloads target GeoJSON resources from the Zoning By-law package and attempts to download Address Points from the Municipal Toronto One Address Repository package. If address data cannot be identified, the script prints candidate package IDs and the zoning workflow continues.

## Prepare Frontend Data

Prepare cleaned frontend-ready GeoJSON and address search index files:

```bash
python scripts/prepare_all_zoning_data.py
```

Cleaned frontend data is written to:

```text
frontend/public/data/
```

Generated files include zoning layers, overlay layers, `address_points_clean.geojson`, and `address_points_index.json` when address data is available.

## Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the local development URL printed by Vite, usually:

```text
http://localhost:5173/
```

## Features

- Interactive Toronto zoning map
- Polygon click lookup
- Address search using local prepared address points
- Plain-English zoning summaries
- Parsed zoning-string rules such as density, frontage, lot area, units, site-specific exceptions, and standards sets
- Matching zoning overlays shown in the side panel
- Collapsible advanced raw data

## Current Architecture

```text
City of Toronto CKAN API
  -> scripts/download_zoning_from_api.py
  -> data/raw/
  -> scripts/prepare_all_zoning_data.py
  -> frontend/public/data/
  -> React + Vite + Leaflet + Turf.js
```

The project currently runs frontend-only. The browser loads GeoJSON files and performs spatial matching with Turf.js.

## Production Direction

The prototype intentionally avoids a backend for now. Production should later move spatial data and overlay matching to:

- PostgreSQL + PostGIS
- FastAPI backend
- Server-side zoning and overlay queries
- Scheduled CKAN updates
- Better search and geocoding workflows

This will improve performance and avoid sending large citywide GeoJSON files to every browser.

## Disclaimer

This tool is for informational purposes only and is not legal or planning advice. Zoning information may be affected by exceptions, site-specific amendments, former by-laws, appeals, or other conditions. Always verify zoning information with official City of Toronto sources before making planning, building, or purchasing decisions.
