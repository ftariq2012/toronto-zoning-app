import json
from pathlib import Path

import geopandas as gpd
import pandas as pd


PROJECT_DIR = Path(__file__).resolve().parents[1]
RAW_DATA_DIR = PROJECT_DIR / "data" / "raw"
OUTPUT_DIR = PROJECT_DIR / "frontend" / "public" / "data"
ADDRESS_RAW_FILE = RAW_DATA_DIR / "address_points.geojson"

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


def clean_text(value) -> str:
    if value is None or pd.isna(value):
        return ""

    text = str(value).strip()
    if not text or text.lower() == "nan" or text == "-1":
        return ""

    return text


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


def find_column(columns: list[str], candidates: list[str]) -> str | None:
    normalized_columns = {column.lower(): column for column in columns}

    for candidate in candidates:
        if candidate.lower() in normalized_columns:
            return normalized_columns[candidate.lower()]

    for column in columns:
        lowered = column.lower()
        if any(candidate.lower() in lowered for candidate in candidates):
            return column

    return None


def build_address_label(row, columns: list[str]) -> str:
    full_address_column = find_column(
        columns,
        ["address", "full_address", "address_full", "addr_full", "linear_name_full"],
    )
    street_number_column = find_column(
        columns,
        ["street_number", "st_num", "number", "addr_num", "address_number"],
    )
    street_name_column = find_column(
        columns,
        ["street_name", "st_name", "street", "road_name", "linear_name"],
    )

    full_address = clean_text(row.get(full_address_column)) if full_address_column else ""
    if full_address:
        return full_address

    street_number = (
        clean_text(row.get(street_number_column)) if street_number_column else ""
    )
    street_name = clean_text(row.get(street_name_column)) if street_name_column else ""
    combined = " ".join(part for part in [street_number, street_name] if part)

    if combined:
        return combined

    useful_parts = [
        clean_text(row.get(column))
        for column in columns
        if column != "geometry" and clean_text(row.get(column))
    ]
    return " ".join(useful_parts[:4])


def clean_address_points() -> None:
    if not ADDRESS_RAW_FILE.exists():
        print("-" * 72)
        print(f"Address source not found: {ADDRESS_RAW_FILE}")
        print("Skipping address search data. Run download_zoning_from_api.py if needed.")
        return

    gdf = gpd.read_file(ADDRESS_RAW_FILE)
    gdf = ensure_epsg_4326(gdf, ADDRESS_RAW_FILE)
    gdf = clean_nulls(gdf)

    property_columns = [column for column in gdf.columns if column != "geometry"]
    street_number_column = find_column(
        property_columns,
        ["street_number", "st_num", "number", "addr_num", "address_number"],
    )
    street_name_column = find_column(
        property_columns,
        ["street_name", "st_name", "street", "road_name", "linear_name"],
    )

    gdf["address_label"] = gdf.apply(
        lambda row: build_address_label(row, property_columns),
        axis=1,
    )
    gdf["street_number"] = (
        gdf[street_number_column].map(clean_text) if street_number_column else ""
    )
    gdf["street_name"] = (
        gdf[street_name_column].map(clean_text) if street_name_column else ""
    )
    gdf["search_text"] = gdf.apply(
        lambda row: " ".join(
            clean_text(row.get(column))
            for column in ["address_label", "street_number", "street_name"]
            if clean_text(row.get(column))
        ).lower(),
        axis=1,
    )

    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    gdf = gdf[gdf["address_label"].map(bool)]

    address_geojson = OUTPUT_DIR / "address_points_clean.geojson"
    address_index = OUTPUT_DIR / "address_points_index.json"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    gdf.to_file(address_geojson, driver="GeoJSON")

    index_records = []
    for _, row in gdf.iterrows():
        point = row.geometry
        if point.geom_type != "Point":
            point = point.representative_point()

        index_records.append(
            {
                "address_label": row["address_label"],
                "search_text": row["search_text"],
                "lat": point.y,
                "lng": point.x,
            }
        )

    with address_index.open("w", encoding="utf-8") as file:
        json.dump(index_records, file, ensure_ascii=False)

    print("-" * 72)
    print(f"Source: {ADDRESS_RAW_FILE}")
    print(f"Rows: {len(gdf)}")
    print(f"CRS: {gdf.crs}")
    print("Columns:")
    for column in gdf.columns:
        print(f"  - {column}")
    print(f"Output: {address_geojson}")
    print(f"Index: {address_index}")


def main() -> None:
    for dataset in DATASETS:
        process_dataset(dataset)
    clean_address_points()


if __name__ == "__main__":
    main()
