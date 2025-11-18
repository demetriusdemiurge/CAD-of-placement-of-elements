from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.routers.place import router as place_router

app = FastAPI(title="PCB Placer (Sequential + Parallel GA)")

# API
app.include_router(place_router, prefix="/api", tags=["placer"])

# простая «веб-морда»
app.mount("/", StaticFiles(directory="static", html=True), name="static")
