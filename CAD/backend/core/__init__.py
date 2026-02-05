from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Set, Tuple, Callable, Optional, Iterable
import math


# ----------------------------
# Модель позиций на плате
# ----------------------------

@dataclass(frozen=True)
class Position:
    """Позиция (ячейка) на плате."""
    pid: str
    x: int
    y: int


def manhattan(a: Position, b: Position) -> int:
    return abs(a.x - b.x) + abs(a.y - b.y)


def euclidean(a: Position, b: Position) -> float:
    return math.hypot(a.x - b.x, a.y - b.y)


def build_4neigh_graph(positions: Iterable[Position]) -> Dict[str, List[str]]:
    """
    Строит граф соседства позиций по 4-связности (вверх/вниз/влево/вправо),
    исходя из (x, y) координат.
    """
    pos_by_xy: Dict[Tuple[int, int], Position] = {(p.x, p.y): p for p in positions}
    neighbors: Dict[str, List[str]] = {p.pid: [] for p in positions}

    for p in positions:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = pos_by_xy.get((p.x + dx, p.y + dy))
            if q is not None:
                neighbors[p.pid].append(q.pid)

    return neighbors


# ----------------------------
# Последовательный алгоритм размещения по связности
# ----------------------------

class SequentialConnectivityPlacer:
    """
    Реализация алгоритма:
      1) Разместить директивные модули (fixed).
      2) Сформировать множество R^k: пустые позиции, соседние с занятыми.
      3) Посчитать J(i) для всех неразмещенных модулей.
      4) Выбрать модуль с max J.
      5) Для выбранного модуля посчитать F(p) по всем p из R^k.
      6) Выбрать позицию с min F.
      7) Разместить.
      8) Повторять пока не разместим все.

    Интерпретация (типичная для таких описаний):
      J(i) = sum_{j in placed} c_ij - sum_{j in unplaced} c_ij   (j != i)

      F(p) = sum_{j in placed} c_ij * d(p, pos(j))

    Где c_ij — веса связности (элемент матрицы смежности ВНГ),
    d(.,.) — метрика (по умолчанию Manhattan).
    """

    def __init__(
        self,
        modules: List[str],
        positions: List[Position],
        c: Dict[str, Dict[str, float]],  # c[i][j] = weight
        fixed: Optional[Dict[str, str]] = None,  # module -> position_id
        neighbors: Optional[Dict[str, List[str]]] = None,  # position_id -> neighbor_position_ids
        dist: Callable[[Position, Position], float] = manhattan,
    ):
        self.modules = modules
        self.pos_by_id = {p.pid: p for p in positions}
        self.positions = positions
        self.c = c
        self.fixed = fixed or {}
        self.neighbors = neighbors or build_4neigh_graph(positions)
        self.dist = dist

        # Проверки
        for m in self.fixed:
            if m not in self.modules:
                raise ValueError(f"Fixed module '{m}' отсутствует в списке modules")
        for m, pid in self.fixed.items():
            if pid not in self.pos_by_id:
                raise ValueError(f"Fixed position '{pid}' для '{m}' отсутствует в positions")

    def _w(self, i: str, j: str) -> float:
        """Вес связи c_ij (0 если не задан)."""
        if i == j:
            return 0.0
        return float(self.c.get(i, {}).get(j, 0.0))

    def _adj_sum(self, i: str, group: Set[str]) -> float:
        return sum(self._w(i, j) for j in group if j != i)

    def place(self) -> Dict[str, str]:
        # Пункт 1. Размещение директивных модулей.
        placed: Dict[str, str] = {}
        occupied_pos: Set[str] = set()

        for m, pid in self.fixed.items():
            if pid in occupied_pos:
                raise ValueError(f"Позиция '{pid}' задана фиксированной для нескольких модулей")
            placed[m] = pid
            occupied_pos.add(pid)

        unplaced: Set[str] = set(self.modules) - set(placed.keys())

        # Если нет ни одного директивного — стартуем с самого "связного" в центр/в любую
        if not placed and unplaced:
            # Возьмем модуль с максимальной суммой связей со всеми остальными
            start = max(unplaced, key=lambda i: self._adj_sum(i, set(self.modules)))
            # Возьмем "центральную" позицию: минимизируем сумму расстояний до всех позиций
            start_pos = min(
                (p.pid for p in self.positions),
                key=lambda pid: sum(self.dist(self.pos_by_id[pid], q) for q in self.positions),
            )
            placed[start] = start_pos
            occupied_pos.add(start_pos)
            unplaced.remove(start)

        # Основной цикл (пункты 2..8)
        while unplaced:
            # Пункт 2. Формирование массива позиций, соседних с занятыми.
            R: Set[str] = set()
            for op in occupied_pos:
                for nb in self.neighbors.get(op, []):
                    if nb not in occupied_pos:
                        R.add(nb)

            # Если плата "разреженная" и соседей нет — разрешим выбирать из любых пустых
            if not R:
                R = set(self.pos_by_id.keys()) - occupied_pos

            placed_set = set(placed.keys())
            unplaced_set = set(unplaced)

            # Пункт 3. Расчет оценки J для всех неразмещенных модулей.
            # J(i) = sum_{j in placed} c_ij - sum_{j in unplaced} c_ij
            J: Dict[str, float] = {}
            for i in unplaced_set:
                J[i] = self._adj_sum(i, placed_set) - self._adj_sum(i, unplaced_set)

            # Пункт 4. Выбор модуля с максимальным значением оценки J.
            # Тай-брейк: больше связей с уже размещенными.
            chosen_module = max(
                unplaced_set,
                key=lambda i: (J[i], self._adj_sum(i, placed_set)),
            )

            # Пункт 5. Расчет оценки F для каждой позиции, соседней с занятыми.
            # F(p) = sum_{j in placed} c_ij * d(p, pos(j))
            def F(pid: str) -> float:
                p = self.pos_by_id[pid]
                total = 0.0
                for j in placed_set:
                    w = self._w(chosen_module, j)
                    if w != 0.0:
                        total += w * self.dist(p, self.pos_by_id[placed[j]])
                return total

            # Пункт 6. Выбор позиции с минимальным значением оценки F.
            # Тай-брейк: ближе к "центру" занятых, чтобы не расползаться (не обязателен, но полезен).
            occ_positions = [self.pos_by_id[pid] for pid in occupied_pos]
            cx = sum(p.x for p in occ_positions) / len(occ_positions)
            cy = sum(p.y for p in occ_positions) / len(occ_positions)

            def center_penalty(pid: str) -> float:
                p = self.pos_by_id[pid]
                return (p.x - cx) ** 2 + (p.y - cy) ** 2

            chosen_pos = min(R, key=lambda pid: (F(pid), center_penalty(pid)))

            # Пункт 7. Размещение выбранного модуля
            placed[chosen_module] = chosen_pos
            occupied_pos.add(chosen_pos)
            unplaced.remove(chosen_module)

            # Пункт 8 — проверка в условии while

        return placed


# ----------------------------
# Пример использования
# ----------------------------
if __name__ == "__main__":
    # Модули
    modules = ["U1", "U2", "U3", "U4", "J1", "R1", "R2"]

    # Позиции 4x3 (x=0..3, y=0..2)
    positions = [Position(f"P{x}_{y}", x, y) for y in range(3) for x in range(4)]

    # Матрица связности (веса; можно считать это "кол-во цепей" между модулями)
    # c[i][j] = c[j][i] обычно симметрична, но алгоритм допускает и несимметричную.
    c = {
        "J1": {"U1": 5, "U2": 2},
        "U1": {"J1": 5, "U2": 4, "U3": 3, "R1": 2},
        "U2": {"J1": 2, "U1": 4, "U3": 4, "U4": 2, "R2": 2},
        "U3": {"U1": 3, "U2": 4, "U4": 5},
        "U4": {"U2": 2, "U3": 5},
        "R1": {"U1": 2},
        "R2": {"U2": 2},
    }

    # Директивное размещение: разъем (или фиксированный элемент) ставим заранее
    fixed = {"J1": "P0_1"}  # слева по центру

    placer = SequentialConnectivityPlacer(
        modules=modules,
        positions=positions,
        c=c,
        fixed=fixed,
        neighbors=None,          # построим 4-соседство автоматически
        dist=manhattan,          # можно euclidean
    )

    placement = placer.place()
    for m in modules:
        print(f"{m:>2} -> {placement[m]}")
