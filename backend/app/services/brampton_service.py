from ..municipality_config import MUNICIPALITY_CONFIG
from .arcgis_service import arcgis_json_request, fetch_geojson_pages


BRAMPTON = MUNICIPALITY_CONFIG["brampton"]
ZONING_URL = BRAMPTON["external_sources"]["zoning_geojson"]
ADDRESS_URL = BRAMPTON["external_sources"]["address_lookup"]
ADDRESS_GEOCODER_URL = BRAMPTON["external_sources"]["address_geocoder"]
OVERLAY_URLS = {
    "height": BRAMPTON["external_sources"]["height_overlay"],
    "density": BRAMPTON["external_sources"]["density_overlay"],
    "lot_width": BRAMPTON["external_sources"]["lot_width_overlay"],
    "parking": BRAMPTON["external_sources"]["parking_overlay"],
    "driveway": BRAMPTON["external_sources"]["driveway_overlay"],
}
_OVERLAY_CACHE = None
_ZONING_CACHE = None
ADDRESS_SEARCH_FIELDS = [
    "PIN",
    "ZONE_CODE",
    "CATEGORY",
    "TYPE",
    "SPECIAL_SECTION",
    "ZONING_OVERRIDE",
]


def get_brampton_zoning_geojson():
    global _ZONING_CACHE
    if _ZONING_CACHE is None:
        _ZONING_CACHE = fetch_geojson_pages(ZONING_URL)
    return _ZONING_CACHE


def get_brampton_overlays():
    global _OVERLAY_CACHE
    if _OVERLAY_CACHE is not None:
        return _OVERLAY_CACHE

    overlays = {}
    for key, url in OVERLAY_URLS.items():
        try:
            overlays[key] = fetch_geojson_pages(url)
        except Exception as exc:
            if key == "driveway":
                overlays[key] = {
                    "type": "FeatureCollection",
                    "features": [],
                    "warning": f"Driveway overlay unavailable: {exc}",
                }
                continue
            raise

    _OVERLAY_CACHE = overlays
    return overlays


def get_brampton_overlay(key: str):
    overlays = get_brampton_overlays()
    return overlays.get(
        key,
        {"type": "FeatureCollection", "features": [], "warning": "Overlay not found."},
    )


def search_brampton_addresses(query: str):
    cleaned_query = query.strip()
    if not cleaned_query:
        return {"results": []}

    geocoder_results = search_brampton_geocoder(cleaned_query)
    if geocoder_results["results"]:
        return geocoder_results

    # Fallback: Brampton Zoning_New layer 7 is a zoning lookup table, not a
    # true address point layer. It has no address text or geometry, but querying
    # it can still help users who search by PIN or zone.
    escaped = cleaned_query.replace("'", "''").upper()
    where = " OR ".join(
        f"UPPER({field}) LIKE '%{escaped}%'" for field in ADDRESS_SEARCH_FIELDS
    )

    payload = arcgis_json_request(
        ADDRESS_URL,
        {
            "where": where,
            "outFields": "*",
            "returnGeometry": "true",
            "f": "json",
            "outSR": 4326,
            "resultRecordCount": 10,
        },
    )

    features = payload.get("features") or []
    rows = []
    for feature in features[:10]:
        attrs = feature.get("attributes") or {}
        geometry = feature.get("geometry") or {}
        lng = geometry.get("x")
        lat = geometry.get("y")
        label = build_brampton_address_label(attrs)

        rows.append(
            {
                "address_label": label,
                "lat": lat,
                "lng": lng,
                "municipality_id": "brampton",
                "properties": attrs,
            }
        )

    message = (
        "No Brampton address found. Try a full address or click the map."
        if not rows
        else (
            "Brampton zoning table matches were found, but they do not include "
            "map coordinates. Try a full address or click the map."
        )
    )

    return {"results": rows, "message": message}


def search_brampton_geocoder(query: str):
    payload = arcgis_json_request(
        ADDRESS_GEOCODER_URL,
        {
            "SingleLine": query,
            "f": "json",
            "outSR": 4326,
            "maxLocations": 10,
        },
    )

    results = []
    for candidate in payload.get("candidates") or []:
        location = candidate.get("location") or {}
        lng = location.get("x")
        lat = location.get("y")
        address = candidate.get("address") or query

        if lat is None or lng is None:
            continue

        results.append(
            {
                "municipalityId": "brampton",
                "municipality_id": "brampton",
                "displayAddress": address,
                "address_label": address,
                "lat": lat,
                "lng": lng,
                "score": candidate.get("score"),
                "rawProperties": candidate,
                "properties": candidate,
            }
        )

    return {
        "municipalityId": "brampton",
        "municipality_id": "brampton",
        "results": results,
        "message": None
        if results
        else "No Brampton address found. Try a full address or click the map.",
    }


def build_brampton_address_label(attrs: dict):
    pin = attrs.get("PIN")
    zone = attrs.get("ZONE_CODE")
    category = attrs.get("CATEGORY")
    zoning_type = attrs.get("TYPE")

    parts = []
    if pin:
        parts.append(f"PIN {pin}")
    if zone:
        parts.append(f"Zone {zone}")
    if category:
        parts.append(str(category))
    if zoning_type and zoning_type != category:
        parts.append(str(zoning_type))

    return " - ".join(parts) or "Brampton zoning record"
