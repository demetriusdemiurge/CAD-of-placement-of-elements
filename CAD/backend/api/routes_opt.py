# /optimize/seq, /optimize/ga, /optimize/pga
from fastapi import APIRouter

router = APIRouter()


@router.post("/seq")
def optimize_seq():
    # TODO: вызвать реальный seq_placement
    return {"message": "seq optimization stub"}

@router.post("/ga")
def optimize_ga():
    # TODO: вызвать реальный ga_placement
    return {"message": "ga optimization stub"}

@router.post("/pga")
def optimize_pga():
    # TODO: вызвать реальный pga_placement
    return {"message": "pga optimization stub"}