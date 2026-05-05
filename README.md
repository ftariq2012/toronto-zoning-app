# Toronto Zoning Lookup MVP

An interactive local prototype for looking up City of Toronto zoning data. The app shows the main Zoning Area polygons on a Leaflet map. When a user clicks a zoning polygon, the side panel combines the main zoning data with matching Toronto zoning overlay data.

Official data source: [City of Toronto Zoning By-law Open Data](https://open.toronto.ca/dataset/zoning-by-law/)

## Current MVP Architecture

```text
Toronto CKAN API
  -> scripts/download_zoning_from_api.py
  -> data/raw/*.geojson
  -> scripts/prepare_all_zoning_data.py
  -> frontend/public/data/*.geojson
  -> React + Vite + Leaflet frontend
  -> Turf.js overlay matching in the browser
```

This remains a frontend-only prototype. It does not use PostGIS, FastAPI, Docker, or a backend yet.

The source files are large, especially `zoning_area.geojson`. Loading full GeoJSON files directly in the browser is acceptable for this MVP, but production should move spatial data and overlay matching to PostGIS + FastAPI for better performance.

## Locations

Project:

```text
C:\Users\ftariq\Downloads\toronto-zoning-app
```

Raw downloaded data:

```text
C:\Users\ftariq\Downloads\toronto-zoning-app\data\raw
```

Generated frontend data:

```text
C:\Users\ftariq\Downloads\toronto-zoning-app\frontend\public\data
```

## Download Official Data From Toronto API

From the project root:

```powershell
cd C:\Users\ftariq\Downloads\toronto-zoning-app
C:\Users\ftariq\miniconda3\python.exe .\scripts\download_zoning_from_api.py
```

The downloader calls the Toronto CKAN `package_show` endpoint for package `zoning-by-law`, filters to GeoJSON resources, and downloads only these target resources:

- Zoning Area
- Zoning Height Overlay
- Parking Zone Overlay
- Zoning Policy Area Overlay
- Zoning Policy Road Overlay
- Zoning Priority Retail Street Overlay
- Zoning Rooming House Overlay
- Zoning Lot Coverage Overlay
- Zoning Building Setback Overlay

The script saves raw files using clean snake_case names in `data/raw`.

## Prepare Cleaned Frontend Data

From the project root:

```powershell
C:\Users\ftariq\miniconda3\python.exe .\scripts\prepare_all_zoning_data.py
```

The script reads raw GeoJSON files from `data/raw`, ensures outputs are EPSG:4326, replaces empty values with JSON nulls, and writes cleaned files to `frontend/public/data`.

Generated files include:

- `zoning_area_clean.geojson`
- `zoning_height_overlay_clean.geojson`
- `parking_zone_overlay_clean.geojson`
- `zoning_policy_area_overlay_clean.geojson`
- `zoning_policy_road_overlay_clean.geojson`
- `zoning_priority_retail_street_overlay_clean.geojson`
- `zoning_rooming_house_overlay_clean.geojson`
- `zoning_lot_coverage_overlay_clean.geojson`
- `zoning_building_setback_overlay_clean.geojson`

## Run the Frontend

```powershell
cd frontend
npm install
npm run dev
```

Vite will print a local URL, usually:

```text
http://localhost:5173/
```

Open that URL in your browser.

## Python Interpreter in VS Code

Use your Miniconda base Python interpreter:

```text
C:\Users\ftariq\miniconda3\python.exe
```

In VS Code:

1. Open the Command Palette.
2. Run `Python: Select Interpreter`.
3. Choose `C:\Users\ftariq\miniconda3\python.exe`.

## How Overlay Matching Works

The map only displays the main Zoning Area polygons. Overlay layers are loaded in the background but are not drawn by default.

When a user clicks a main zoning polygon:

1. The app stores the clicked zoning polygon properties.
2. The app stores the clicked latitude/longitude.
3. Turf.js checks the clicked point against each overlay dataset.
4. Polygon overlays use point-in-polygon matching.
5. Line overlays use a small point-to-line distance tolerance for nearby policy road and priority retail street matches.
6. The side panel shows readable zoning information first, then overlay sections and collapsible raw data.

If an overlay has no match, the panel says `No matching overlay found.`

## Main Zoning Field Mapping

| Source field | App field             | Meaning                                                 |
| ------------ | --------------------- | ------------------------------------------------------- |
| `ZN_ZONE`    | `zone_code`           | Short zoning category code, such as `RD`.               |
| `ZN_STRING`  | `zone_string`         | Full zoning string, including standards and exceptions. |
| `FRONTAGE`   | `frontage`            | Minimum frontage value where listed.                    |
| `ZN_AREA`    | `lot_area`            | Minimum lot area value where listed.                    |
| `COVERAGE`   | `coverage`            | Lot coverage value where listed.                        |
| `EXCPTN_NO`  | `exception_number`    | Exception number associated with the zoning area.       |
| `ZBL_CHAPT`  | `bylaw_chapter`       | Zoning by-law chapter reference.                        |
| `ZBL_SECTN`  | `bylaw_section`       | Zoning by-law section reference.                        |
| `ZBL_EXCPTN` | `exception_reference` | Full exception reference, such as `900.3.10(1058)`.     |

## Official Source and Disclaimer

Every selected result links to:

[City of Toronto Zoning By-law Open Data](https://open.toronto.ca/dataset/zoning-by-law/)

Disclaimer shown in the app:

## Future Production Plan

- Move data to PostGIS
- Add a FastAPI backend
- Query overlays server-side
- Add scheduled updates from the Toronto CKAN API
- Add address search
- Add more GTA municipalities
