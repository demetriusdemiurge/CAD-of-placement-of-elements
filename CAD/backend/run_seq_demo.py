# backend/run_seq_demo.py

from __future__ import annotations

from typing import Dict, Tuple

from backend.core.grid import Grid
from backend.core.elements import Element, Pin
from backend.core.nets import Net
from backend.algorithms.seq_placement import (
    place_sequential,
    element_bbox,  # используем для отрисовки
)
from backend.core.metrics import Placement


# ---------- Пример задачи ----------

def build_example_problem() -> tuple[Grid, Dict[int, Element], list[Net], Placement]:
    """
    Создаём небольшую тестовую задачу:
      - сетка 6x4 (24 клетки)
      - 4 элемента разных размеров
      - несколько связей между ними
      - один элемент директивно размещён в центре
    Всё это легко поменять под свои примеры.
    """

    # 1. Сетка
    grid = Grid(width_cells=6, height_cells=4)

    # 2. Элементы
    # Все пины пока в левом верхнем углу (0,0) — этого достаточно,
    # чтобы увидеть работу алгоритма и влияние поворота.
    elements: Dict[int, Element] = {
        1: Element(
            id=1,
            name="E1",
            w_cells=2,
            h_cells=2,
            pins=[Pin(id="1", dx=0, dy=0)],
        ),
        2: Element(
            id=2,
            name="E2",
            w_cells=2,
            h_cells=1,
            pins=[Pin(id="1", dx=0, dy=0)],
        ),
        3: Element(
            id=3,
            name="E3",
            w_cells=1,
            h_cells=2,
            pins=[Pin(id="1", dx=0, dy=0)],
        ),
        4: Element(
            id=4,
            name="E4",
            w_cells=1,
            h_cells=1,
            pins=[Pin(id="1", dx=0, dy=0)],
        ),
    }

    # 3. Связи (каждая связь соединяет два пина)
    nets: list[Net] = [
        Net(id=1, a_element=1, a_pin="1", b_element=2, b_pin="1"),
        Net(id=2, a_element=1, a_pin="1", b_element=3, b_pin="1"),
        Net(id=3, a_element=2, a_pin="1", b_element=4, b_pin="1"),
        Net(id=4, a_element=3, a_pin="1", b_element=4, b_pin="1"),
    ]

    # 4. Директивное размещение
    directive_placement: Placement = {}

    # Пример: элемент 1 директивно ставим в "центр" сетки, ориентация 0°
    center_x, center_y = 2, 1  # можно поменять
    pos_idx_center = grid.xy_to_idx(center_x, center_y)
    directive_placement[1] = (pos_idx_center, 0)

    return grid, elements, nets, directive_placement


# ---------- Отрисовка результата в консоли ----------

def build_cell_to_element_map(
    grid: Grid,
    elements: Dict[int, Element],
    placement: Placement,
) -> Dict[tuple[int, int], int]:
    """
    Строим словарь (x,y) -> element_id для всех занятых клеток.
    """
    cell_to_elem: Dict[tuple[int, int], int] = {}

    for eid, (pos_idx, orient) in placement.items():
        el = elements[eid]
        x, y, w, h = element_bbox(grid, el, pos_idx, orient)
        for dy in range(h):
            for dx in range(w):
                cx = x + dx
                cy = y + dy
                cell_to_elem[(cx, cy)] = eid

    return cell_to_elem


def print_placement_ascii(
    grid: Grid,
    elements: Dict[int, Element],
    placement: Placement,
) -> None:
    """
    Печатаем ASCII-карту: по строкам сетки, в каждой клетке либо номер элемента, либо '.'.
    Для больших элементов тот же номер повторяется на всех занимаемых клетках.
    """
    cell_to_elem = build_cell_to_element_map(grid, elements, placement)

    print("ASCII-карта размещения (x по горизонтали, y по вертикали):")
    print("   " + "".join(f"{x:3d}" for x in range(grid.width_cells)))
    for y in range(grid.height_cells):
        row_cells = []
        for x in range(grid.width_cells):
            eid = cell_to_elem.get((x, y))
            if eid is None:
                row_cells.append("  .")
            else:
                row_cells.append(f"{eid:3d}")
        print(f"{y:2d} " + "".join(row_cells))
    print()


def print_placement_list(
    grid: Grid,
    elements: Dict[int, Element],
    placement: Placement,
) -> None:
    """
    Подробный список: элемент -> (x,y), ориентация, размеры.
    """
    print("Список размещения элементов:")
    for eid in sorted(placement.keys()):
        pos_idx, orient = placement[eid]
        x, y = grid.idx_to_xy(pos_idx)
        el = elements[eid]
        w, h = el.size_for_orientation(orient)
        print(
            f"  e{eid}: pos_idx={pos_idx:2d}, (x={x}, y={y}), "
            f"orient={orient}°, size={w}x{h}"
        )
    print()


# ---------- Точка входа ----------

def main() -> None:
    grid, elements, nets, directive_placement = build_example_problem()

    print("=== Последовательный алгоритм по связности: демо ===")
    print(f"Сетка: {grid.width_cells} x {grid.height_cells} клеток")
    print(f"Элементов: {len(elements)}, связей: {len(nets)}")
    print()

    placement, metrics = place_sequential(
        grid=grid,
        elements=elements,
        nets=nets,
        directive_placement=directive_placement,
        verbose=True,
    )

    print_placement_ascii(grid, elements, placement)
    print_placement_list(grid, elements, placement)

    print("Метрики (глобальный fitness):")
    for k in sorted(metrics.keys()):
        print(f"  {k}: {metrics[k]}")
    print()


if __name__ == "__main__":
    main()
