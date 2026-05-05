from pathlib import Path

import geopandas as gpd
import pandas as pd


PROJECT_DIR = Path(__file__).resolve().parents[1]
RAW_DATA_DIR = PROJECT_DIR / "data" / "raw"
OUTPUT_DIR = PROJECT_DIR / "frontend" / "public" / "data"

MAIN_FIELD_MAP = {
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

COMMON_RENAME_MAP = {
    "HT_STORIES": "height_stories",
    "HT_STRING": "height_string",
    "HT_LABEL": "height_label",
    "OBJECTID": "object_id",
    "ZN_PARKZONE": "parking_zone",
    "POLICY_ID": "policy_id",
    "CHAPT_200": "chapter_200",
    "EXCPTN_LK": "exception_link",
    "ROAD_NAME": "road_name",
    "ZN_STRING": "zoning_string",
    "CH600_LINE_TYPE": "chapter_600_line_type",
    "LINEAR_NAME_FULL_LEGAL": "street_name",
    "BYLAW_SECTIONLINK": "bylaw_section_link",
    "RMH_AREA": "rooming_house_area",
    "RMG_HS_NO": "rooming_house_number",
    "RMG_STRING": "rooming_house_string",
    "CHAP150_25": "chapter_150_25",
    "LC_PERCENT": "lot_coverage_percent",
    "LC_STRING": "lot_coverage_string",
    "PRCNT_CVER": "lot_coverage_percent",
    "BLD_SETBACK": "building_setback",
    "SB_STRING": "setback_string",
    "SETBACK": "setback",
    "CH600_AREA_TYPE": "chapter_600_area_type",
}

DATASETS = [
    {
        "source": "zoning_area.geojson",
        "output": "zoning_area_clean.geojson",
        "layer_name": "Zoning Area",
        "field_map": MAIN_FIELD_MAP,
        "keep_mapped_only": True,
    },
    {
        "source": "zoning_height_overlay.geojson",
        "output": "zoning_height_overlay_clean.geojson",
        "layer_name": "Zoning Height Overlay",
        "field_map": COMMON_RENAME_MAP,
        "keep_mapped_only": False,
    },
    {
        "source": "parking_zone_overlay.geojson",
        "output": "parking_zone_overlay_clean.geojson",
        "layer_name": "Parking Zone Overlay",
        "field_map": COMMON_RENAME_MAP,
        "keep_mapped_only": False,
    },
    {
        "source": "zoning_policy_area_overlay.geojson",
        "output": "zoning_policy_area_overlay_clean.geojson",
        "layer_name": "Zoning Policy Area Overlay",
        "field_map": COMMON_RENAME_MAP,
        "keep_mapped_only": False,
    },
    {
        "source": "zoning_policy_road_overlay.geojson",
        "output": "zoning_policy_road_overlay_clean.geojson",
        "layer_name": "Zoning Policy Road Overlay",
        "field_map": COMMON_RENAME_MAP,
        "keep_mapped_only": False,
    },
    {
        "source": "zoning_priority_retail_street_overlay.geojson",
        "output": "zoning_priority_retail_street_overlay_clean.geojson",
        "layer_name": "Zoning Priority Retail Street Overlay",
        "field_map": COMMON_RENAME_MAP,
        "keep_mapped_only": False,
    },
    {
        "source": "zoning_rooming_house_overlay.geojson",
        "output": "zoning_rooming_house_overlay_clean.geojson",
        "layer_name": "Zoning Rooming House Overlay",
        "field_map": COMMON_RENAME_MAP,
        "keep_mapped_only": False,
    },
    {
        "source": "zoning_lot_coverage_overlay.geojson",
        "output": "zoning_lot_coverage_overlay_clean.geojson",
        "layer_name": "Zoning Lot Coverage Overlay",
        "field_map": COMMON_RENAME_MAP,
        "keep_mapped_only": False,
    },
    {
        "source": "zoning_building_setback_overlay.geojson",
        "output": "zoning_building_setback_overlay_clean.geojson",
        "layer_name": "Zoning Building Setback Overlay",
        "field_map": COMMON_RENAME_MAP,
        "keep_mapped_only": False,
    },
]


def clean_nulls(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    cleaned = gdf.copy()
    property_columns = [column for column in cleaned.columns if column != "geometry"]

    for column in property_columns:
        cleaned[column] = cleaned[column].astype("object")
        cleaned.loc[pd.isna(cleaned[column]), column] = None

    return cleaned


def ensure_epsg_4326(gdf: gpd.GeoDataFrame, source_file: Path) -> gpd.GeoDataFrame:
    if gdf.crs is None:
        raise ValueError(f"{source_file} does not define a CRS.")

    if gdf.crs.to_epsg() != 4326:
        return gdf.to_crs(epsg=4326)

    return gdf


def clean_main_zoning(gdf: gpd.GeoDataFrame, dataset: dict) -> gpd.GeoDataFrame:
    required_columns = list(dataset["field_map"].keys()) + ["geometry"]
    missing_columns = [column for column in required_columns if column not in gdf.columns]

    if missing_columns:
        raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")

    return gdf[required_columns].rename(columns=dataset["field_map"])


def clean_overlay(gdf: gpd.GeoDataFrame, dataset: dict) -> gpd.GeoDataFrame:
    property_columns = [column for column in gdf.columns if column != "geometry"]
    cleaned = gdf[property_columns + ["geometry"]].rename(columns=dataset["field_map"])
    cleaned.insert(0, "layer_name", dataset["layer_name"])
    return cleaned


def process_dataset(dataset: dict) -> None:
    source_file = RAW_DATA_DIR / dataset["source"]
    output_file = OUTPUT_DIR / dataset["output"]

    if not source_file.exists():
        raise FileNotFoundError(f"Source file not found: {source_file}")

    gdf = gpd.read_file(source_file)
    gdf = ensure_epsg_4326(gdf, source_file)

    if dataset["keep_mapped_only"]:
        cleaned = clean_main_zoning(gdf, dataset)
    else:
        cleaned = clean_overlay(gdf, dataset)

    cleaned = clean_nulls(cleaned)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    cleaned.to_file(output_file, driver="GeoJSON")

    print("-" * 72)
    print(f"Source: {source_file}")
    print(f"Rows: {len(cleaned)}")
    print(f"CRS: {cleaned.crs}")
    print("Columns:")
    for column in cleaned.columns:
        print(f"  - {column}")
    print(f"Output: {output_file}")


def main() -> None:
    for dataset in DATASETS:
        process_dataset(dataset)


if __name__ == "__main__":
    main()
