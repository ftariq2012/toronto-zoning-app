from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError


def search_addresses(db, query: str):
    if not query.strip():
        return {"results": []}

    sql = text(
        """
        SELECT
          address_label,
          ST_Y(ST_PointOnSurface(geometry)) AS lat,
          ST_X(ST_PointOnSurface(geometry)) AS lng
        FROM address_points
        WHERE search_text ILIKE :query
        ORDER BY address_label
        LIMIT 10
        """
    )

    try:
        rows = db.execute(sql, {"query": f"%{query.strip()}%"}).mappings().all()
    except ProgrammingError:
        db.rollback()
        return {"results": [], "message": "Address search data is not loaded."}

    return {
        "results": [
            {
                "address_label": row["address_label"],
                "lat": row["lat"],
                "lng": row["lng"],
            }
            for row in rows
        ]
    }
