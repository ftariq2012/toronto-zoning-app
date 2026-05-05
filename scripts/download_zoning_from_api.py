import re
from pathlib import Path

import requests


PROJECT_DIR = Path(__file__).resolve().parents[1]
RAW_DATA_DIR = PROJECT_DIR / "data" / "raw"

CKAN_BASE_URL = "https://ckan0.cf.opendata.inter.prod-toronto.ca"
PACKAGE_SHOW_URL = f"{CKAN_BASE_URL}/api/3/action/package_show"
PACKAGE_ID = "zoning-by-law"

TARGET_RESOURCES = {
    "Zoning Area": "zoning_area.geojson",
    "Zoning Height Overlay": "zoning_height_overlay.geojson",
    "Parking Zone Overlay": "parking_zone_overlay.geojson",
    "Zoning Policy Area Overlay": "zoning_policy_area_overlay.geojson",
    "Zoning Policy Road Overlay": "zoning_policy_road_overlay.geojson",
    "Zoning Priority Retail Street Overlay": "zoning_priority_retail_street_overlay.geojson",
    "Zoning Rooming House Overlay": "zoning_rooming_house_overlay.geojson",
    "Zoning Lot Coverage Overlay": "zoning_lot_coverage_overlay.geojson",
    "Zoning Building Setback Overlay": "zoning_building_setback_overlay.geojson",
}


def normalize_name(name: str) -> str:
    without_extension = re.sub(r"\.geojson$", "", name, flags=re.IGNORECASE)
    without_projection = re.sub(r"\s*-\s*(4326|2952)$", "", without_extension)
    return re.sub(r"\s+", " ", without_projection).strip().lower()


def get_target_filename(resource_name: str) -> str | None:
    normalized_resource_name = normalize_name(resource_name)

    for target_name, filename in TARGET_RESOURCES.items():
        if normalized_resource_name == normalize_name(target_name):
            return filename

    return None


def is_geojson_resource(resource: dict) -> bool:
    resource_format = str(resource.get("format", "")).strip().lower()
    resource_name = str(resource.get("name", "")).strip().lower()
    resource_url = str(resource.get("url", "")).strip().lower()

    return (
        resource_format == "geojson"
        or resource_name.endswith(".geojson")
        or resource_url.endswith(".geojson")
    )


def download_file(url: str, output_path: Path) -> None:
    with requests.get(url, stream=True, timeout=120) as response:
        response.raise_for_status()

        with output_path.open("wb") as file:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    file.write(chunk)


def resource_priority(resource: dict) -> tuple[int, int, int]:
    name = str(resource.get("name", "")).lower()
    url_type = str(resource.get("url_type", "")).lower()
    url = str(resource.get("url", "")).lower()

    has_4326 = "4326" in name or "4326" in url
    is_upload = url_type == "upload" or "/download/" in url
    ends_geojson = name.endswith(".geojson") or url.endswith(".geojson")

    return (
        0 if has_4326 else 1,
        0 if is_upload else 1,
        0 if ends_geojson else 1,
    )


def main() -> None:
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)

    package_response = requests.get(
        PACKAGE_SHOW_URL,
        params={"id": PACKAGE_ID},
        timeout=60,
    )
    package_response.raise_for_status()
    package = package_response.json()

    if not package.get("success"):
        raise RuntimeError(f"CKAN package_show failed: {package}")

    resources = package["result"]["resources"]
    candidates_by_filename = {filename: [] for filename in TARGET_RESOURCES.values()}
    downloaded_targets = set()

    for resource in resources:
        resource_name = resource.get("name", "")

        if not is_geojson_resource(resource):
            continue

        output_filename = get_target_filename(resource_name)
        if output_filename is None:
            continue

        candidates_by_filename[output_filename].append(resource)

    for output_filename, candidates in candidates_by_filename.items():
        if not candidates:
            continue

        resource = sorted(candidates, key=resource_priority)[0]
        resource_name = resource.get("name", "")
        resource_url = resource.get("url")
        if not resource_url:
            print(f"Skipping {resource_name}: missing URL")
            continue

        output_path = RAW_DATA_DIR / output_filename
        download_file(resource_url, output_path)
        downloaded_targets.add(output_filename)

        print("-" * 72)
        print(f"Downloaded: {resource_name}")
        print(f"URL: {resource_url}")
        print(f"Output: {output_path}")

    missing = sorted(set(TARGET_RESOURCES.values()) - downloaded_targets)
    if missing:
        raise RuntimeError(
            "Missing target GeoJSON resources from CKAN response: "
            + ", ".join(missing)
        )


if __name__ == "__main__":
    main()
