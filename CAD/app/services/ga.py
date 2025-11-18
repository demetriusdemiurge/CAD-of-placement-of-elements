from __future__ import annotations
import random
from typing import List, Tuple, Dict
from app.schemas.design import Design
from app.services.metrics import objectives

# Новая хромосома:
#   genes: длиной M = #positions
#   gene[i] = индекс компонента (0..K-1) или -1 (пусто)
# Каждая компонента должна встречаться ровно 1 раз → нужен repair.

def init_genes(M: int, K: int, rng: random.Random) -> List[int]:
    genes = [-1] * M
    pos_idx = rng.sample(range(M), K)
    for comp_id, i in enumerate(pos_idx):
        genes[i] = comp_id
    return genes

def decode_genes(genes: List[int], comp_order: List[str], positions: List[Tuple[float, float]]) -> Dict[str, Tuple[float, float]]:
    placement: Dict[str, Tuple[float, float]] = {}
    for pos_i, comp_id in enumerate(genes):
        if comp_id is not None and comp_id >= 0:
            name = comp_order[comp_id]
            placement[name] = positions[pos_i]
    return placement

def repair(genes: List[int], K: int, rng: random.Random) -> None:
    """Удаляем дубликаты, добавляем недостающих компонентов на свободные слоты (-1)."""
    seen = set()
    # вырежем повторы
    for i, g in enumerate(genes):
        if g is None: genes[i] = -1
    for i, g in enumerate(genes):
        if g >= 0:
            if g in seen:
                genes[i] = -1
            else:
                seen.add(g)
    # добираем недостающих
    missing = [c for c in range(K) if c not in seen]
    empties = [i for i, g in enumerate(genes) if g < 0]
    rng.shuffle(empties)
    for c, slot in zip(missing, empties):
        genes[slot] = c

def fitness(design: Design, genes: List[int], comp_order: List[str], positions: List[Tuple[float, float]], w_pair: float, w_longest: float) -> float:
    placement = decode_genes(genes, comp_order, positions)
    return objectives(design, placement, w_pair, w_longest)["score"]

def uniform_crossover(a: List[int], b: List[int], rng: random.Random) -> Tuple[List[int], List[int]]:
    n = len(a)
    c1 = a[:] ; c2 = b[:]
    for i in range(n):
        if rng.random() < 0.5:
            c1[i] = b[i]
            c2[i] = a[i]
    return c1, c2

def mutate(genes: List[int], rng: random.Random, rate: float) -> None:
    if rng.random() < rate:
        i, j = rng.sample(range(len(genes)), 2)
        genes[i], genes[j] = genes[j], genes[i]
