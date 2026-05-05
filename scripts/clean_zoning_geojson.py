from pathlib import Path

import geopandas as gpd


SOURCE_PATH = Path(r"C:\Users\ftariq\Downloads\zoning_area.geojson")
OUTPUT_PATH = (
    Path(__file__).resolve().parents[1]
    / "frontend"
    / "public"
    / "data"
    / "zoning_area_clean.geojson"
)

FIELD_MAP = {
    "ZN_ZONE": "zone_code",
    "ZN_STRING": "zone_string",
    "FRONTAGE": "frontage",
    "ZN_AREA": "lot_area",
    "COVERAGE": "coverage",
    "EXCPTN_NO": "exception_number",
    "ZBL_CHAPT": "bylaw_chapter",
    "ZBL_SECTN": "bylaw_section",
    "ZBL_EXCPTN": "exception_reference",
}


def main() -> None:
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(f"Source GeoJSON not found: {SOURCE_PATH}")

    zoning = gpd.read_file(SOURCE_PATH)

    if zoning.crs is None:
        raise ValueError("Source GeoJSON does not define a CRS.")

    epsg = zoning.crs.to_epsg()
    if epsg != 4326:
        raise ValueError(f"Expected EPSG:4326, got {zoning.crs}.")

    required_columns = list(FIELD_MAP.keys()) + ["geometry"]
    missing_columns = [column for column in required_columns if column not in zoning.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")

    cleaned = zoning[required_columns].rename(columns=FIELD_MAP)

    # Fiona/GeoJSON handles Python None cleanly as JSON null.
    cleaned = cleaned.where(cleaned.notna(), None)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_file(OUTPUT_PATH, driver="GeoJSON")

    print(f"Rows: {len(cleaned)}")
    print(f"CRS: {cleaned.crs}")
    print(f"Output: {OUTPUT_PATH}")
    print("Columns:")
    for column in cleaned.columns:
        print(f"  - {column}")


if __name__ == "__main__":
    main()
