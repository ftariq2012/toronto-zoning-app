from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.address_search import search_addresses
from ..services.spatial_query import zoning_lookup


router = APIRouter()


@router.get("")
def get_zoning_by_point(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    db: Session = Depends(get_db),
):
    return zoning_lookup(db, lat, lng)


@router.get("/address")
def get_zoning_by_address(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    results = search_addresses(db, q).get("results", [])
    if not results:
        return {"found": False, "message": "No matching address found."}

    address = results[0]
    response = zoning_lookup(db, address["lat"], address["lng"])
    response["selected_address"] = address
    return response
