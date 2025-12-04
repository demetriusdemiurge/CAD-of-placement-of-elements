# последовательный алгоритм по связности

from __future__ import annotations

from backend.core.grid import Grid
from backend.core.elements import Element
from backend.core.nets import Net
from backend.core.metrics import compute_fitness, Placement
from backend.core.nets import compute_connectivity  # если используешь degrees, см. выше

def compute_element_degrees(
    elements: dict[int, Element],
    nets: list[Net],
) -> dict[int, int]:
    from collections import defaultdict

    conn = compute_connectivity(nets)
    degree = defaultdict(int)

    for eid in elements.keys():
        degree[eid] = 0

    for (i, j), count in conn.items():
        degree[i] += count
        degree[j] += count

    return degree


def compute_placement_order(
    elements: dict[int, Element],
    nets: list[Net],
) -> list[int]:
    degree = compute_element_degrees(elements, nets)

    def key(eid: int):
        el = elements[eid]
        area = el.w_cells * el.h_cells
        return (-degree[eid], -area)

    return sorted(elements.keys(), key=key)


def enumerate_valid_positions_for_element(
    grid: Grid,
    element: Element,
):
    """
    Перебираем все (pos_idx, orientation), которые
    хотя бы геометрически помещаются в сетку (без выхода за границы).
    Пересечения с другими пока не проверяем — это сделает fitness.
    """
    for pos_idx in range(grid.num_positions):
        x, y = grid.idx_to_xy(pos_idx)
        for orient in element.allowed_orientations:
            w, h = element.size_for_orientation(orient)
            # Проверка выхода за границы
            if x + w > grid.width_cells or y + h > grid.height_cells:
                continue
            yield pos_idx, orient


def place_sequential(
    grid: Grid,
    elements: dict[int, Element],
    nets: list[Net],
) -> tuple[Placement, dict]:
    """
    Жадный последовательный алгоритм по связности:
      1) считаем порядок элементов (по степени),
      2) для каждого элемента подбираем позицию и ориентацию
         с минимальным fitness.
    Возвращает:
      - placement: element_id -> (pos_idx, orientation)
      - metrics: dict с F, C_len, L_max, etc.
    """
    # 1. порядок
    order = compute_placement_order(elements, nets)

    placement: Placement = {}

    # 2. пошагово размещаем элементы
    for eid in order:
        element = elements[eid]

        best_F = None
        best_choice: tuple[int, int] | None = None  # (pos_idx, orientation)

        for pos_idx, orient in enumerate_valid_positions_for_element(grid, element):
            # формируем кандидата
            candidate_placement = dict(placement)
            candidate_placement[eid] = (pos_idx, orient)

            # считаем fitness для частичного размещения:
            # те связи, где второй элемент ещё не поставлен, просто не дают вклад (и это ок).
            metrics = compute_fitness(grid, elements, nets, candidate_placement)
            F = metrics["F"]

            if best_F is None or F < best_F:
                best_F = F
                best_choice = (pos_idx, orient)

        if best_choice is None:
            # теоретически может не найтись ни одной позиции (если сетка слишком мала),
            # для первой версии просто падаем с ошибкой
            raise RuntimeError(f"Не удалось разместить элемент {eid}: нет валидных позиций")

        # фиксируем лучший вариант
        placement[eid] = best_choice

    # 3. финальная оценка для полного размещения
    final_metrics = compute_fitness(grid, elements, nets, placement)
    return placement, final_metrics

