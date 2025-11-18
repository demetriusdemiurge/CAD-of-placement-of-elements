from __future__ import annotations
import math
from itertools import combinations
from typing import Dict, List, Tuple, DefaultDict
from collections import defaultdict
from app.schemas.design import Design

def euclid(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    dx, dy = a[0] - b[0], a[1] - b[1]
    return math.hypot(dx, dy)

def board_diag(design: Design) -> float:
    return math.hypot(design.board.W, design.board.H)

def build_pair_weights(design: Design) -> Dict[Tuple[str, str], int]:
    """
    Вес пары (u,v) = сколько раз они связаны.
    - из Net: каждая пара внутри нетлиста добавляет +1
    - из Link: добавляет count
    """
    w: DefaultDict[Tuple[str, str], int] = defaultdict(int)
    # nets -> каждая пара в net.nodes
    for net in design.nets:
        nodes = net.nodes
        for u, v in combinations(nodes, 2):
            a, b = sorted((u, v))
            w[(a, b)] += 1
    # links
    for lk in design.links:
        a, b = sorted((lk.a, lk.b))
        w[(a, b)] += max(1, int(lk.count))
    return dict(w)

def pair_sum_cost(design: Design, placement: Dict[str, Tuple[float, float]]) -> float:
    """Сумма по парам: w_ij * dist(i,j)."""
    w = build_pair_weights(design)
    total = 0.0
    for (u, v), c in w.items():
        if u in placement and v in placement:
            total += c * euclid(placement[u], placement[v])
    return total

def longest_link(design: Design, placement: Dict[str, Tuple[float, float]]) -> float:
    """Длина самой длинной связи (без учёта кратности)."""
    w = build_pair_weights(design)
    L = 0.0
    for (u, v), c in w.items():
        if c <= 0:
            continue
        if u in placement and v in placement:
            d = euclid(placement[u], placement[v])
            if d > L: L = d
    return L

def objectives(design: Design, placement: Dict[str, Tuple[float, float]], w_pair: float = 1.0, w_longest: float = 0.3) -> Dict[str, float]:
    """
    Возвращает сырые и нормированные метрики + итоговую аддитивную цель.
    Нормирование:
      J_pair_norm = (sum w_ij*dist) / (diag * max(1, sum w_ij))
      J_longest_norm = Lmax / diag
    Итог: score = w1*J_pair_norm + w2*J_longest_norm
    """
    diag = board_diag(design)
    w = build_pair_weights(design)
    sum_w = float(sum(w.values())) if w else 1.0

    j_pair = pair_sum_cost(design, placement)
    j_long = longest_link(design, placement)

    j_pair_norm = (j_pair / (diag * max(1.0, sum_w))) if diag > 0 else 0.0
    j_long_norm = (j_long / diag) if diag > 0 else 0.0

    score = w_pair * j_pair_norm + w_longest * j_long_norm
    return {
        "pair_sum": j_pair,
        "longest": j_long,
        "pair_norm": j_pair_norm,
        "longest_norm": j_long_norm,
        "score": score,
    }
