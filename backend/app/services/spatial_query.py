from sqlalchemy import text

from .zoning_formatters import build_summary


SOURCE = {
    "name": "City of Toronto Zoning By-law Open Data",
    "url": "https://open.toronto.ca/dataset/zoning-by-law/",
}
DISCLAIMER = (
    "This tool is for informational purposes only and is not legal or planning advice. "
    "Always verify with the City of Toronto."
)

OVERLAY_TABLES = {
    "height": "zoning_height_overlay",
    "lot_coverage": "zoning_lot_coverage_overlay",
    "parking": "parking_zone_overlay",
    "building_setback": "zoning_building_setback_overlay",
    "policy_area": "zoning_policy_area_overlay",
    "policy_road": "zoning_policy_road_overlay",
    "priority_retail": "zoning_priority_retail_street_overlay",
    "rooming_house": "zoning_rooming_house_overlay",
}


def zoning_lookup(db, lat: float, lng: float):
    point_sql = "ST_SetSRID(ST_Point(:lng, :lat), 4326)"
    main = fetch_one_properties(
        db,
        f"""
        SELECT to_jsonb(t) - 'geometry' AS properties
        FROM zoning_area t
        WHERE ST_Intersects(t.geometry, {point_sql})
        LIMIT 1
        """,
        lat,
        lng,
    )

    overlays = {
        key: fetch_many_properties(
            db,
            f"""
            SELECT to_jsonb(t) - 'geometry' AS properties
            FROM {table} t
            WHERE ST_Intersects(t.geometry, {point_sql})
            LIMIT 25
            """,
            lat,
            lng,
        )
        for key, table in OVERLAY_TABLES.items()
    }

    found = main is not None
    main_payload = {"properties": main} if found else None

    return {
        "found": found,
        "clicked_point": {"lat": lat, "lng": lng},
        "main": main_payload,
        "overlays": overlays,
        "summary": build_summary(main or {}, overlays) if found else "",
        "source": SOURCE,
        "disclaimer": DISCLAIMER,
    }


def fetch_one_properties(db, sql: str, lat: float, lng: float):
    row = db.execute(text(sql), {"lat": lat, "lng": lng}).mappings().first()
    return row["properties"] if row else None


def fetch_many_properties(db, sql: str, lat: float, lng: float):
    rows = db.execute(text(sql), {"lat": lat, "lng": lng}).mappings().all()
    return [row["properties"] for row in rows]
