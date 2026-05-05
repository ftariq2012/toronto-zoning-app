import os
import re
from pathlib import Path

import geopandas as gpd
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text


PROJECT_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DATA_DIR = PROJECT_DIR / "frontend" / "public" / "data"
RAW_DATA_DIR = PROJECT_DIR / "data" / "raw"
DEFAULT_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5433/zoning_db"

load_dotenv(PROJECT_DIR / "backend" / ".env")
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)

LAYERS = [
    ("zoning_area", FRONTEND_DATA_DIR / "zoning_area_clean.geojson"),
    ("zoning_height_overlay", FRONTEND_DATA_DIR / "zoning_height_overlay_clean.geojson"),
    ("zoning_lot_coverage_overlay", FRONTEND_DATA_DIR / "zoning_lot_coverage_overlay_clean.geojson"),
    ("parking_zone_overlay", FRONTEND_DATA_DIR / "parking_zone_overlay_clean.geojson"),
    ("zoning_building_setback_overlay", FRONTEND_DATA_DIR / "zoning_building_setback_overlay_clean.geojson"),
    ("zoning_policy_area_overlay", FRONTEND_DATA_DIR / "zoning_policy_area_overlay_clean.geojson"),
    ("zoning_policy_road_overlay", FRONTEND_DATA_DIR / "zoning_policy_road_overlay_clean.geojson"),
    ("zoning_priority_retail_street_overlay", FRONTEND_DATA_DIR / "zoning_priority_retail_street_overlay_clean.geojson"),
    ("zoning_rooming_house_overlay", FRONTEND_DATA_DIR / "zoning_rooming_house_overlay_clean.geojson"),
]

ADDRESS_SOURCE = RAW_DATA_DIR / "address_points.geojson"


def snake_case(value: str) -> str:
    value = re.sub(r"[^0-9a-zA-Z]+", "_", value).strip("_")
    value = re.sub(r"_+", "_", value)
    return value.lower()


def clean_columns(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    renamed = {}
    seen = set()
    for column in gdf.columns:
        if column == "geometry":
            continue
        clean_name = snake_case(column)
        base_name = clean_name
        suffix = 2
        while clean_name in seen or clean_name == "geometry":
            clean_name = f"{base_name}_{suffix}"
            suffix += 1
        seen.add(clean_name)
        renamed[column] = clean_name
    return gdf.rename(columns=renamed)


def clean_nulls(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    cleaned = gdf.copy()
    for column in [column for column in cleaned.columns if column != "geometry"]:
        cleaned[column] = cleaned[column].astype("object")
        cleaned.loc[pd.isna(cleaned[column]), column] = None
    return cleaned


def ensure_epsg_4326(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    if gdf.crs is None:
        raise ValueError("GeoDataFrame does not define a CRS.")
    if gdf.crs.to_epsg() != 4326:
        return gdf.to_crs(epsg=4326)
    return gdf


def read_layer(path: Path) -> gpd.GeoDataFrame:
    gdf = gpd.read_file(path)
    gdf = ensure_epsg_4326(gdf)
    gdf = clean_columns(gdf)
    return clean_nulls(gdf)


def first_value(row, names):
    for name in names:
        if name in row and row[name] not in (None, "", -1, "-1"):
            return str(row[name]).strip()
    return ""


def prepare_address_points() -> gpd.GeoDataFrame | None:
    if not ADDRESS_SOURCE.exists():
        print(f"Warning: {ADDRESS_SOURCE} is missing. Skipping address_points.")
        return None

    gdf = read_layer(ADDRESS_SOURCE)

    def label(row):
        full = first_value(row, ["address_full", "address", "full_address"])
        if full:
            return full
        number = first_value(row, ["address_number", "street_number", "lo_num"])
        street = first_value(row, ["linear_name_full", "street_name", "linear_name"])
        return " ".join(part for part in [number, street] if part)

    gdf["address_label"] = gdf.apply(label, axis=1)
    gdf["search_text"] = gdf["address_label"].fillna("").str.lower()
    if "municipality_name" in gdf.columns:
        gdf["search_text"] = (
            gdf["search_text"] + " " + gdf["municipality_name"].fillna("").str.lower()
        )

    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    gdf = gdf[gdf["address_label"].fillna("") != ""]
    return gdf


def load_table(engine, table_name: str, gdf: gpd.GeoDataFrame) -> None:
    print(f"Loading {table_name}: {len(gdf)} rows")
    gdf.to_postgis(table_name, engine, if_exists="replace", index=False)
    with engine.begin() as conn:
        conn.execute(
            text(
                f"CREATE INDEX IF NOT EXISTS {table_name}_geometry_gix "
                f"ON {table_name} USING GIST (geometry)"
            )
        )


def main() -> None:
    engine = create_engine(DATABASE_URL)
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))

    for table_name, path in LAYERS:
        if not path.exists():
            print(f"Warning: {path} is missing. Skipping {table_name}.")
            continue
        load_table(engine, table_name, read_layer(path))

    address_points = prepare_address_points()
    if address_points is not None:
        load_table(engine, "address_points", address_points)
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS address_points_search_text_idx "
                    "ON address_points USING GIN (search_text gin_trgm_ops)"
                )
            )


if __name__ == "__main__":
    main()
