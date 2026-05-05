import re
from pathlib import Path

import requests


PROJECT_DIR = Path(__file__).resolve().parents[1]
RAW_DATA_DIR = PROJECT_DIR / "data" / "raw"

CKAN_BASE_URL = "https://ckan0.cf.opendata.inter.prod-toronto.ca"
PACKAGE_SHOW_URL = f"{CKAN_BASE_URL}/api/3/action/package_show"
PACKAGE_SEARCH_URL = f"{CKAN_BASE_URL}/api/3/action/package_search"
PACKAGE_ID = "zoning-by-law"
ADDRESS_PACKAGE_ID = "address-points-municipal-toronto-one-address-repository"
ADDRESS_SEARCH_TERMS = [
    "address points municipal",
    "Toronto One Address Repository",
    "address points",
]

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


def is_address_resource(resource: dict) -> bool:
    return is_geojson_resource(resource) and "address points" in str(
        resource.get("name", "")
    ).lower()


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


def get_package(package_id: str) -> dict:
    response = requests.get(
        PACKAGE_SHOW_URL,
        params={"id": package_id},
        timeout=60,
    )
    response.raise_for_status()
    package = response.json()

    if not package.get("success"):
        raise RuntimeError(f"CKAN package_show failed: {package}")

    return package["result"]


def search_address_packages() -> list[dict]:
    candidates = []
    seen_ids = set()

    for query in ADDRESS_SEARCH_TERMS:
        response = requests.get(
            PACKAGE_SEARCH_URL,
            params={"q": query, "rows": 5},
            timeout=60,
        )
        response.raise_for_status()
        result = response.json()["result"]

        for package in result.get("results", []):
            package_id = package.get("name")
            if package_id and package_id not in seen_ids:
                seen_ids.add(package_id)
                candidates.append(package)

    return candidates


def download_zoning_resources() -> None:
    package = get_package(PACKAGE_ID)
    resources = package["resources"]
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


def download_address_points() -> None:
    try:
        package = get_package(ADDRESS_PACKAGE_ID)
    except Exception as error:
        print("Could not load known address package.")
        print(f"Package id tried: {ADDRESS_PACKAGE_ID}")
        print(f"Error: {error}")
        print_address_candidates()
        return

    resources = [
        resource
        for resource in package.get("resources", [])
        if is_address_resource(resource)
    ]

    if not resources:
        print("No GeoJSON Address Points resource found in the address package.")
        print_address_candidates()
        return

    resource = sorted(resources, key=resource_priority)[0]
    resource_url = resource.get("url")
    if not resource_url:
        print("Address Points resource is missing a URL.")
        print_address_candidates()
        return

    output_path = RAW_DATA_DIR / "address_points.geojson"
    download_file(resource_url, output_path)

    print("-" * 72)
    print(f"Downloaded: {resource.get('name')}")
    print(f"URL: {resource_url}")
    print(f"Output: {output_path}")


def print_address_candidates() -> None:
    print("Address package candidates from CKAN package_search:")
    try:
        for package in search_address_packages():
            print(f"  - {package.get('name')}: {package.get('title')}")
    except Exception as error:
        print(f"  Could not search address package candidates: {error}")


def main() -> None:
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    download_zoning_resources()
    download_address_points()


if __name__ == "__main__":
    main()
