# C_len, L_max, штрафы, нормирование, fitness

from dataclasses import dataclass

from grid import Grid
from elements import Element
from nets import Net, compute_connectivity

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

def element_center(geom: ElementGeom) -> tuple[float, float]:
    """
    Центр элемента в координатах сетки.
    Можно оставить float, т.к. при нечётных размерах центр будет .5.
    """
    cx = geom.x + geom.w / 2.0
    cy = geom.y + geom.h / 2.0
    return cx, cy


def compute_C_len_and_L_max_components(
    grid: Grid,
    elements: dict[int, Element],
    nets: list[Net],
    placement: Placement,
) -> tuple[float, float]:
    """
    C_len = sum_{i<j} conn_count[i,j] * dist(center_i, center_j)
    L_max = max dist(center_i, center_j) по всем парам с conn_count>0.
    """
    geoms = build_element_geoms(grid, elements, placement)
    conn_count = compute_connectivity(nets)

    C_len = 0.0
    L_max = 0.0

    for (i, j), count in conn_count.items():
        gi = geoms.get(i)
        gj = geoms.get(j)
        # если элемент не размещён (нет в placement), пропускаем
        if gi is None or gj is None:
            continue

        cx_i, cy_i = element_center(gi)
        cx_j, cy_j = element_center(gj)

        # манхэттенское расстояние по центрам
        d = abs(cx_i - cx_j) + abs(cy_i - cy_j)

        C_len += count * d
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
    # грубая оценка: все связи тянутся через L_theor_max
    L_max = estimate_L_theor_max(grid)

    # считаем количество связей (элементарных пар в nets)
    total_conn = 0
    for net in nets:
        # каждая сеть с k элементами даёт k*(k-1)/2 пар
        k = len(set(e_id for (e_id, _) in net.pins))
        if k >= 2:
            total_conn += k * (k - 1) / 2

    return L_max * total_conn if total_conn > 0 else 1.0

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
    C_len, L_max = compute_C_len_and_L_max_components(
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

