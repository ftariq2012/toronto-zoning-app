from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routes import addresses, health, zoning


app = FastAPI(title="Toronto Zoning API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(addresses.router, prefix="/api/addresses", tags=["addresses"])
app.include_router(zoning.router, prefix="/api/zoning", tags=["zoning"])
