# CRUD сетки/компонентов/сетей
from fastapi import APIRouter

router = APIRouter()


@router.get("/grid")
def get_grid():
    # TODO: вернуть реальную плату
    return {"message": "grid endpoint stub"}
