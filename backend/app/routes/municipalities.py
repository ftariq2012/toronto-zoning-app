from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..municipality_config import public_municipalities
from ..services.address_search import search_addresses
from ..services.brampton_service import (
    get_brampton_overlay,
    get_brampton_overlays,
    get_brampton_zoning_geojson,
    search_brampton_addresses,
)
from ..services.spatial_query import zoning_lookup


router = APIRouter()


@router.get("")
def list_municipalities():
    return {"municipalities": public_municipalities()}


@router.get("/toronto/zoning")
def toronto_zoning_by_point(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    db: Session = Depends(get_db),
):
    response = zoning_lookup(db, lat, lng)
    response["municipality_id"] = "toronto"
    return response


@router.get("/toronto/address-search")
def toronto_address_search(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    response = search_addresses(db, q)
    response["municipality_id"] = "toronto"
    return response


@router.get("/brampton/zoning-geojson")
def brampton_zoning_geojson():
    return get_brampton_zoning_geojson()


@router.get("/brampton/address-search")
def brampton_address_search(q: str = Query(..., min_length=1)):
    return search_brampton_addresses(q)


@router.get("/brampton/overlays")
def brampton_overlays():
    return get_brampton_overlays()


@router.get("/brampton/overlays/{overlay_key}")
def brampton_overlay(overlay_key: str):
    return get_brampton_overlay(overlay_key)


@router.get("/brampton/zoning")
def brampton_zoning_by_point(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
):
    return {
        "found": False,
        "municipality_id": "brampton",
        "clicked_point": {"lat": lat, "lng": lng},
        "message": "Brampton point zoning lookup is handled in the frontend for this phase.",
    }
