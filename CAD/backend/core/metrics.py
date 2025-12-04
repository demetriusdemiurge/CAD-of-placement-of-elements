# C_len, L_max, штрафы, нормирование, fitness

from dataclasses import dataclass

from backend.core.grid import Grid
from backend.core.elements import Element
from backend.core.nets import Net, compute_connectivity

# Типы для удобства
Placement = dict[int, tuple[int, int]]  # element_id -> (pos_idx, orientation)


@dataclass
class ElementGeom:
    """
    Геометрия элемента в глобальных координатах.
    """
    element: Element
    x: int              # левый верхний угол (клетка)
    y: int
    orientation: int
    w: int              # габариты с учётом ориентации
    h: int


def build_element_geoms(
    grid: Grid,
    elements: dict[int, Element],
    placement: Placement,
) -> dict[int, ElementGeom]:
    """
    Из placement (element_id -> (pos_idx, orientation))
    строим словарь element_id -> ElementGeom.
    """
    geoms: dict[int, ElementGeom] = {}

    for elem_id, (pos_idx, orientation) in placement.items():
        elem = elements[elem_id]
        x, y = grid.idx_to_xy(pos_idx)
        w, h = elem.size_for_orientation(orientation)
        geoms[elem_id] = ElementGeom(
            element=elem,
            x=x,
            y=y,
            orientation=orientation,
            w=w,
            h=h,
        )

    return geoms

def compute_C_len_and_L_max_pins(
    grid: Grid,
    elements: dict[int, Element],
    nets: list[Net],
    placement: Placement,  # element_id -> (pos_idx, orientation)
) -> tuple[float, float]:
    geoms = build_element_geoms(grid, elements, placement)

    C_len = 0.0
    L_max = 0.0

    for net in nets:
        g_a = geoms.get(net.a_element)
        g_b = geoms.get(net.b_element)
        if g_a is None or g_b is None:
            # если элемент ещё не поставлен (в частичном placement) — связь игнорируем
            continue

        el_a = g_a.element
        el_b = g_b.element

        # находим сами пины
        pin_a = next(p for p in el_a.pins if p.id == net.a_pin)
        pin_b = next(p for p in el_b.pins if p.id == net.b_pin)

        # локальные координаты пинов с учётом ориентации
        dx_a, dy_a = el_a.rotated_pin_offset(pin_a, g_a.orientation)
        dx_b, dy_b = el_b.rotated_pin_offset(pin_b, g_b.orientation)

        # глобальные координаты
        x_a = g_a.x + dx_a
        y_a = g_a.y + dy_a
        x_b = g_b.x + dx_b
        y_b = g_b.y + dy_b

        d = abs(x_a - x_b) + abs(y_a - y_b)

        C_len += d
        if d > L_max:
            L_max = d

    return C_len, L_max

def compute_overlap_penalty(
    geoms: dict[int, ElementGeom]
) -> int:
    """
    Считаем количество конфликтов по клеткам.
    Перебираем клетки, которые занимают элементы,
    и смотрим, сколько раз одна и та же клетка занята >1 элементом.
    """
    cell_owners: dict[tuple[int, int], int] = {}  # (x,y) -> element_id
    penalty = 0

    for elem_id, geom in geoms.items():
        for dy in range(geom.h):
            for dx in range(geom.w):
                cx = geom.x + dx
                cy = geom.y + dy
                key = (cx, cy)
                if key in cell_owners:
                    # уже кто-то там стоит -> конфликт
                    penalty += 1
                else:
                    cell_owners[key] = elem_id

    return penalty

def estimate_L_theor_max(grid: Grid) -> float:
    # максимально возможное манхэттенское расстояние между двумя точками сетки
    return (grid.width_cells - 1) + (grid.height_cells - 1)


def estimate_C_len_theor_max(
    grid: Grid,
    nets: list[Net],
) -> float:
    """
    Грубая оценка максимальной суммарной длины всех связей:
    считаем, что каждая связь может растягиваться до L_theor_max.
    """
    L_max = estimate_L_theor_max(grid)

    # теперь каждая Net — это уже одна пара элементов (2 пина)
    total_conn = len(nets)

    if total_conn <= 0:
        return 1.0  # защита от деления на 0

    return L_max * total_conn


def compute_fitness(
    grid: Grid,
    elements: dict[int, Element],
    nets: list[Net],
    placement: Placement,
    w_len: float = 0.7,
    w_Lmax: float = 0.2,
    w_overlap: float = 0.1,
) -> dict[str, float]:
    """
    Возвращает словарь с деталями:
      C_len, L_max, overlap_penalty, F
    """
    # геометрия элементов
    geoms = build_element_geoms(grid, elements, placement)

    # длины
    C_len, L_max = compute_C_len_and_L_max_pins(
        grid, elements, nets, placement
    )

    # штрафы
    overlap_pen = compute_overlap_penalty(geoms)

    # оценки максимумов
    L_theor_max = estimate_L_theor_max(grid)
    C_theor_max = estimate_C_len_theor_max(grid, nets)
    # чтобы не делить на ноль
    if L_theor_max <= 0:
        L_theor_max = 1.0
    if C_theor_max <= 0:
        C_theor_max = 1.0

    # нормирование
    C_len_norm = C_len / C_theor_max
    L_max_norm = L_max / L_theor_max

    # нормировка штрафа: как хочешь, для начала можно логика:
    overlap_norm = 1.0 if overlap_pen > 0 else 0.0

    F = w_len * C_len_norm + w_Lmax * L_max_norm + w_overlap * overlap_norm

    return {
        "C_len": C_len,
        "L_max": L_max,
        "overlap_penalty": overlap_pen,
        "C_len_norm": C_len_norm,
        "L_max_norm": L_max_norm,
        "overlap_norm": overlap_norm,
        "F": F,
    }

