from __future__ import annotations
from typing import Dict, List, Tuple
import networkx as nx
from app.schemas.design import Design
from app.services.metrics import build_pair_weights, euclid

def build_graph_weighted(design: Design) -> nx.Graph:
    """Граф со взвешенными рёбрами (кратность связей)."""
    G = nx.Graph()
    for name in design.components.keys():
        G.add_node(name)
    w = build_pair_weights(design)
    for (u, v), c in w.items():
        G.add_edge(u, v, w=c)
    return G

def incremental_cost(design: Design, comp: str, p: Tuple[float, float], placed: Dict[str, Tuple[float, float]]) -> float:
    """Приращение суммы w_ij*dist к уже установленным соседям."""
    total = 0.0
    w = build_pair_weights(design)
    for (u, v), c in w.items():
        if c <= 0:
            continue
        if comp == u and v in placed:
            total += c * euclid(p, placed[v])
        elif comp == v and u in placed:
            total += c * euclid(p, placed[u])
    return total

def sequential_place(design: Design, positions: List[Tuple[float, float]], seed: int = 0) -> Dict[str, Tuple[float, float]]:
    """
    Жадный последовательный: порядок = убыванию степени (суммарного веса рёбер).
    Для каждого компонента выбираем свободную позицию, минимизирующую приращение.
    """
    G = build_graph_weighted(design)
    comps = list(design.components.keys())
    # порядок: по сумме весов рёбер ↓
    comps.sort(key=lambda u: sum(d.get("w", 1) for _, _, d in G.edges(u, data=True)), reverse=True)

    free = positions.copy()
    placed: Dict[str, Tuple[float, float]] = {}
    for u in comps:
        best_p, best_val = None, float("inf")
        for p in free:
            val = incremental_cost(design, u, p, placed)
            if val < best_val:
                best_val, best_p = val, p
        placed[u] = best_p
        free.remove(best_p)
    return placed
