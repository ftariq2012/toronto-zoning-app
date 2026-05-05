from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.address_search import search_addresses


router = APIRouter()


@router.get("/search")
def search(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    return search_addresses(db, q)
