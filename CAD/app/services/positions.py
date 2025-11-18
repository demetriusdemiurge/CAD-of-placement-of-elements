from __future__ import annotations
from typing import Dict, List, Tuple
import numpy as np
from app.schemas.design import Board, Component

def generate_positions(board: Board, comps: Dict[str, Component], nx: int, ny: int) -> List[Tuple[float, float]]:
    """Равномерное заранее поле (nx×ny), снап к grid, отступ margin."""
    xs = np.linspace(board.margin, board.W - board.margin, nx)
    ys = np.linspace(board.margin, board.H - board.margin, ny)
    def snap(v: float) -> float: return round(v / board.grid) * board.grid
    pts = [(snap(x), snap(y)) for y in ys for x in xs]
    uniq, seen = [], set()
    for p in pts:
        if p not in seen:
            uniq.append(p); seen.add(p)
    return uniq
