from urllib.parse import quote

from fastapi import HTTPException
from urllib.request import urlopen
from urllib.parse import urlencode
import json


DEFAULT_TIMEOUT_SECONDS = 35


def arcgis_json_request(url: str, params: dict):
    query = urlencode(params, doseq=True, quote_via=quote)
    request_url = f"{url}?{query}"
    try:
        with urlopen(request_url, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"External ArcGIS service request failed: {exc}",
        ) from exc


def fetch_geojson_pages(url: str, where: str = "1=1", page_size: int = 2000):
    features = []
    offset = 0
    metadata = {"type": "FeatureCollection", "features": features}

    while True:
        payload = arcgis_json_request(
            url,
            {
                "where": where,
                "outFields": "*",
                "f": "geojson",
                "outSR": 4326,
                "resultOffset": offset,
                "resultRecordCount": page_size,
            },
        )

        page_features = payload.get("features") or []
        if offset == 0:
            metadata = {
                key: value
                for key, value in payload.items()
                if key not in {"features", "exceededTransferLimit"}
            }
            metadata["type"] = "FeatureCollection"
            metadata["features"] = features

        features.extend(page_features)

        if not payload.get("exceededTransferLimit") and len(page_features) < page_size:
            break

        if not page_features:
            break

        offset += page_size

    return metadata
