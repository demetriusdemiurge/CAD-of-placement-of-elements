from fastapi import FastAPI

from api.routes_grid import router as grid_router
from api.routes_opt import router as opt_router

app = FastAPI(title="PCB CAD Backend")

app.include_router(grid_router, prefix="/api")
app.include_router(opt_router, prefix="/api/optimize")


@app.get("/health")
def health_check():
    return {"status": "ok"}
