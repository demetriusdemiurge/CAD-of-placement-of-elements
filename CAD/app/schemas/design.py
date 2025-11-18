from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional
from pydantic import BaseModel, Field

# -------------------- Domain --------------------
@dataclass
class Component:
    name: str
    w: float
    h: float
    movable: bool = True
    # Произвольная геометрия (локальные координаты, мм, относительно центра (0,0))
    # Примитивы: {"type":"rect","x":-4,"y":-3,"w":8,"h":6,"rx":0,"ry":0}
    #            {"type":"circle","cx":0,"cy":0,"r":4}
    #            {"type":"polygon","points":[[x1,y1],[x2,y2],...]}
    #            {"type":"path","d":"M -4,-3 L 4,-3 L 4,3 L -4,3 Z"}
    geometry: Optional[List[dict]] = None

@dataclass
class Net:
    name: str
    nodes: List[str]

@dataclass
class Link:
    a: str
    b: str
    count: int = 1

@dataclass
class Board:
    W: float
    H: float
    grid: float = 1.0
    margin: float = 3.0

@dataclass
class Design:
    board: Board
    components: Dict[str, Component]
    nets: List[Net]
    links: List[Link]
    field: Optional[List[Tuple[float, float]]] = None

# -------------------- Pydantic In --------------------
class BoardIn(BaseModel):
    W: float
    H: float
    grid: float = 1.0
    margin: float = 3.0

class CompIn(BaseModel):
    name: str
    w: float
    h: float
    movable: bool = True
    geometry: Optional[List[dict]] = None

class NetIn(BaseModel):
    name: str
    nodes: List[str]

class LinkIn(BaseModel):
    a: str
    b: str
    count: int = 1

class DesignIn(BaseModel):
    board: BoardIn
    components: List[CompIn]
    nets: List[NetIn] = Field(default_factory=list)
    links: List[LinkIn] = Field(default_factory=list)
    field: Optional[List[Tuple[float, float]]] = None

    def to_domain(self) -> Design:
        comps = {
            c.name: Component(c.name, c.w, c.h, c.movable, c.geometry)
            for c in self.components
        }
        nets = [Net(n.name, n.nodes) for n in self.nets]
        links = [Link(l.a, l.b, l.count) for l in self.links]
        board = Board(self.board.W, self.board.H, self.board.grid, self.board.margin)
        return Design(board=board, components=comps, nets=nets, links=links, field=self.field)

class GAOptions(BaseModel):
    nx: int = 16
    ny: int = 10
    pop_size: int = 120
    generations: int = 400
    mut_rate: float = 0.2
    elite: int = 2
    islands: int = 4
    migration_interval: int = 20
    seed: int = 0
    w_pair: float = 1.0
    w_longest: float = 0.3

class SeqReq(BaseModel):
    design: DesignIn
    nx: int = 16
    ny: int = 10
    seed: int = 0
    w_pair: float = 1.0
    w_longest: float = 0.3

class GAReq(BaseModel):
    design: DesignIn
    options: GAOptions

# -------------------- Demo --------------------
def demo_design_dict() -> dict:
    board = {"W": 160.0, "H": 100.0, "grid": 1.0, "margin": 5.0}
    comps = [
        # пример: прямоугольный корпус с ключом-скосом (geometry переопределяет «рисовку»)
        {
            "name": "U0", "w": 10, "h": 6, "movable": True,
            "geometry": [
                {"type": "rect", "x": -5, "y": -3, "w": 10, "h": 6, "rx": 0.5, "ry": 0.5},
                {"type": "polygon", "points": [[-5,-3],[-3,-3],[-5,-1]]}
            ]
        },
    ] + [
        {"name": f"U{i}", "w": 8 + (i % 3), "h": 6 + ((i + 1) % 3), "movable": True}
        for i in range(1, 10)
    ]
    links = [
        {"a": "U0", "b": "U1", "count": 2},
        {"a": "U0", "b": "U2", "count": 1},
        {"a": "U3", "b": "U4", "count": 3},
    ]
    nets = [
        {"name": "BUS1", "nodes": ["U5", "U6", "U7"]},
        {"name": "PWR", "nodes": ["U0", "U8", "U9"]},
    ]
    return {"board": board, "components": comps, "links": links, "nets": nets}
