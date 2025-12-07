# последовательный алгоритм по связности (книжный вариант) с логированием

from __future__ import annotations

from typing import Dict, List, Tuple, Set

from backend.core.grid import Grid
from backend.core.elements import Element, Pin
from backend.core.nets import Net, compute_connectivity
from backend.core.metrics import Placement, compute_fitness


# ---------- Вспомогательные функции по геометрии ----------

def element_bbox(
    grid: Grid,
    element: Element,
    pos_idx: int,
    orientation: int,
) -> Tuple[int, int, int, int]:
    """
    Возвращает (x, y, w, h) для элемента, если его левый верхний угол
    стоит в позиции pos_idx и он имеет ориентацию orientation.
    """
    x, y = grid.idx_to_xy(pos_idx)
    w, h = element.size_for_orientation(orientation)
    return x, y, w, h


def occupied_cells_for_element(
    grid: Grid,
    element: Element,
    pos_idx: int,
    orientation: int,
) -> Set[Tuple[int, int]]:
    """
    Клетки сетки (x,y), занятые данным элементом.
    """
    x, y, w, h = element_bbox(grid, element, pos_idx, orientation)
    cells: Set[Tuple[int, int]] = set()
    for dy in range(h):
        for dx in range(w):
            cx = x + dx
            cy = y + dy
            cells.add((cx, cy))
    return cells


def build_occupied_cells(
    grid: Grid,
    elements: Dict[int, Element],
    placement: Placement,
) -> Set[Tuple[int, int]]:
    """
    Все занятые клетки сетки для текущего размещения.
    """
    occupied: Set[Tuple[int, int]] = set()
    for elem_id, (pos_idx, orient) in placement.items():
        elem = elements[elem_id]
        occupied |= occupied_cells_for_element(grid, elem, pos_idx, orient)
    return occupied


def is_feasible_position_for_element(
    grid: Grid,
    element: Element,
    pos_idx: int,
    orientation: int,
    occupied_cells: Set[Tuple[int, int]],
) -> bool:
    """
    Можно ли поставить element с ориентацией orientation в pos_idx:
      - не вылезет ли за границы;
      - не наложится ли на уже занятые клетки;
      - (опционально) все клетки допустимы в grid.allowed.
    """
    x, y, w, h = element_bbox(grid, element, pos_idx, orientation)

    if x < 0 or y < 0:
        return False
    if x + w > grid.width_cells or y + h > grid.height_cells:
        return False

    for dy in range(h):
        for dx in range(w):
            cx = x + dx
            cy = y + dy
            if (cx, cy) in occupied_cells:
                return False
            idx = grid.xy_to_idx(cx, cy)
            if hasattr(grid, "allowed"):
                allowed = getattr(grid, "allowed")
                if isinstance(allowed, (list, tuple)):
                    if not allowed[idx]:
                        return False

    return True


def compute_neighbor_positions(
    grid: Grid,
    elements: Dict[int, Element],
    placement: Placement,
) -> Set[int]:
    """
    Формируем множество позиций R^k, соседних с занятыми.
    Если ни один элемент не размещён, возвращаем все позиции сетки.
    """
    if not placement:
        return set(range(grid.num_positions))

    occupied = build_occupied_cells(grid, elements, placement)
    neighbors: Set[int] = set()

    for (x, y) in occupied:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx = x + dx
            ny = y + dy
            if 0 <= nx < grid.width_cells and 0 <= ny < grid.height_cells:
                if (nx, ny) in occupied:
                    continue
                idx = grid.xy_to_idx(nx, ny)
                if hasattr(grid, "allowed"):
                    allowed = getattr(grid, "allowed")
                    if isinstance(allowed, (list, tuple)):
                        if not allowed[idx]:
                            continue
                neighbors.add(idx)

    # если соседей нет — fallback: все позиции
    if not neighbors:
        return set(range(grid.num_positions))

    return neighbors


# ---------- Связность: матрица c_ij и оценки J ----------

def build_c_ij(nets: List[Net]) -> Dict[Tuple[int, int], int]:
    """
    c_ij = количество связей между элементами i и j.
    Обёртка над compute_connectivity для явной семантики.
    """
    return compute_connectivity(nets)


def get_c(c_ij: Dict[Tuple[int, int], int], i: int, j: int) -> int:
    if i == j:
        return 0
    key = (min(i, j), max(i, j))
    return c_ij.get(key, 0)


def compute_J_for_all(
    E_r: Set[int],
    E_n: Set[int],
    c_ij: Dict[Tuple[int, int], int],
) -> Dict[int, float]:
    """
    J_i = sum_{r ∈ E_r} c_ir - sum_{n ∈ E_n} c_in, i ∈ E_n.
    """
    J: Dict[int, float] = {}
    for i in E_n:
        pos_part = sum(get_c(c_ij, i, r) for r in E_r)
        neg_part = sum(get_c(c_ij, i, n) for n in E_n if n != i)
        J[i] = pos_part - neg_part
    return J


# ---------- Расстояния по пинам и локальный критерий F ----------

def find_pin(element: Element, pin_id: str) -> Pin:
    for p in element.pins:
        if p.id == pin_id:
            return p
    raise KeyError(f"У элемента {element.id} нет пина с id={pin_id!r}")


def total_pin_distance_between(
    elem_i: int,
    elem_r: int,
    placement: Placement,
    elements: Dict[int, Element],
    nets: List[Net],
    grid: Grid,
) -> float:
    """
    Суммарная длина всех связей (Net) между элементами i и r
    при данном placement, по пинам и с учётом ориентации.
    """
    if elem_i not in placement or elem_r not in placement:
        return 0.0

    pos_i, ori_i = placement[elem_i]
    pos_r, ori_r = placement[elem_r]

    el_i = elements[elem_i]
    el_r = elements[elem_r]

    x_i, y_i = grid.idx_to_xy(pos_i)
    x_r, y_r = grid.idx_to_xy(pos_r)

    total = 0.0

    for net in nets:
        if net.a_element == elem_i and net.b_element == elem_r:
            pin_i_id, pin_r_id = net.a_pin, net.b_pin
        elif net.a_element == elem_r and net.b_element == elem_i:
            pin_i_id, pin_r_id = net.b_pin, net.a_pin
        else:
            continue

        pin_i = find_pin(el_i, pin_i_id)
        pin_r = find_pin(el_r, pin_r_id)

        dx_i, dy_i = el_i.rotated_pin_offset(pin_i, ori_i)
        dx_r, dy_r = el_r.rotated_pin_offset(pin_r, ori_r)

        x_i_pin = x_i + dx_i
        y_i_pin = y_i + dy_i
        x_r_pin = x_r + dx_r
        y_r_pin = y_r + dy_r

        d = abs(x_i_pin - x_r_pin) + abs(y_i_pin - y_r_pin)
        total += d

    return total


def compute_local_F_for_candidate(
    i: int,
    pos_idx: int,
    theta: int,
    E_r: Set[int],
    placement: Placement,
    elements: Dict[int, Element],
    nets: List[Net],
    grid: Grid,
) -> float:
    """
    Локальный критерий F(p) для модуля i в позиции pos_idx с ориентацией theta:
      F = Σ_{r ∈ E_r} длина связей между i и r.
    """
    candidate_placement = dict(placement)
    candidate_placement[i] = (pos_idx, theta)

    F = 0.0
    for r in E_r:
        F += total_pin_distance_between(i, r, candidate_placement, elements, nets, grid)
    return F


# ---------- Основной алгоритм ----------

def place_sequential(
    grid: Grid,
    elements: Dict[int, Element],
    nets: List[Net],
    directive_placement: Placement | None = None,
    verbose: bool = False,
) -> Tuple[Placement, dict]:
    """
    Последовательный алгоритм размещения по связности (по книге).

    Параметр verbose=True включает подробный лог в консоль.

    Возвращает:
      - placement: element_id -> (pos_idx, orientation)
      - final_metrics: глобальные метрики (через compute_fitness).
    """

    def log(msg: str) -> None:
        if verbose:
            print(msg)

    # Инициализация множеств E_r и E_n
    placement: Placement = {}
    if directive_placement:
        placement.update(directive_placement)

    all_ids: Set[int] = set(elements.keys())
    E_r: Set[int] = set(placement.keys())
    E_n: Set[int] = all_ids - E_r

    log("=== Старт последовательного алгоритма по связности ===")
    log(f"Сетка: {grid.width_cells} x {grid.height_cells} клеток")
    log(f"Всего элементов: {len(elements)}, связей: {len(nets)}")
    log(f"Директивно размещены: {sorted(E_r)}")
    log("")

    # Матрица смежности c_ij
    c_ij = build_c_ij(nets)

    step = 1

    # Главный цикл по шагам k
    while E_n:
        log(f"--- Шаг {step} ---")
        log(f"Размещены (E_r): {sorted(E_r)}")
        log(f"Не размещены (E_n): {sorted(E_n)}")

        # Пункт 2: множество позиций, соседних с занятыми
        neighbor_positions = compute_neighbor_positions(grid, elements, placement)
        log(f"Соседние позиции R^k (индексы): {sorted(neighbor_positions)}")

        # Пункт 3: оценки J для всех неразмещённых
        J = compute_J_for_all(E_r, E_n, c_ij)
        log("Оценки J для неразмещённых элементов:")
        for eid in sorted(E_n):
            log(f"  e{eid}: J = {J.get(eid, 0.0)}")

        # Пункт 4: выбор элемента с максимальным J (при равенстве — с меньшим id)
        best_J = None
        candidates: List[int] = []
        for eid in E_n:
            val = J.get(eid, 0.0)
            if best_J is None or val > best_J:
                best_J = val
                candidates = [eid]
            elif val == best_J:
                candidates.append(eid)

        chosen_elem = min(candidates)
        element = elements[chosen_elem]
        log(f"Выбран элемент e{chosen_elem} с J = {best_J}")
        log("")

        # Пункт 5–6: выбор лучшей позиции по F для выбранного модуля
        occupied = build_occupied_cells(grid, elements, placement)
        best_F = None
        best_choice: Tuple[int, int] | None = None  # (pos_idx, orientation)

        log(f"Перебор позиций для e{chosen_elem}:")
        for pos_idx in sorted(neighbor_positions):
            for orient in element.allowed_orientations:
                if not is_feasible_position_for_element(grid, element, pos_idx, orient, occupied):
                    log(f"  pos_idx={pos_idx}, orient={orient}: НЕДОПУСТИМО (границы/пересечение)")
                    continue

                F_local = compute_local_F_for_candidate(
                    chosen_elem, pos_idx, orient, E_r, placement, elements, nets, grid
                )
                x, y = grid.idx_to_xy(pos_idx)
                log(
                    f"  pos_idx={pos_idx} (x={x},y={y}), orient={orient}: "
                    f"F = {F_local}"
                )

                if (
                    best_F is None
                    or F_local < best_F
                    or (F_local == best_F and (best_choice is None or pos_idx < best_choice[0]))
                ):
                    best_F = F_local
                    best_choice = (pos_idx, orient)

        # Fallback: если среди соседних ничего не нашли, ищем по всей сетке
        if best_choice is None:
            log("Среди соседних позиций нет допустимых — ищем по всей сетке.")
            for pos_idx in range(grid.num_positions):
                for orient in element.allowed_orientations:
                    if not is_feasible_position_for_element(grid, element, pos_idx, orient, occupied):
                        continue
                    F_local = compute_local_F_for_candidate(
                        chosen_elem, pos_idx, orient, E_r, placement, elements, nets, grid
                    )
                    if (
                        best_F is None
                        or F_local < best_F
                        or (F_local == best_F and (best_choice is None or pos_idx < best_choice[0]))
                    ):
                        best_F = F_local
                        best_choice = (pos_idx, orient)

        if best_choice is None:
            raise RuntimeError(f"Не удалось разместить элемент {chosen_elem}: нет валидных позиций")

        pos_idx_best, orient_best = best_choice
        x_best, y_best = grid.idx_to_xy(pos_idx_best)
        log(
            f"Итог для e{chosen_elem}: выбрана позиция pos_idx={pos_idx_best} "
            f"(x={x_best}, y={y_best}), ориентация={orient_best}, F_min={best_F}"
        )
        log("")

        # Пункт 7: фиксируем размещение и обновляем множества
        placement[chosen_elem] = best_choice
        E_r.add(chosen_elem)
        E_n.remove(chosen_elem)

        step += 1

    log("=== Все элементы размещены ===")
    log("")

    # Пункт 8: все модули размещены — считаем глобальный fitness
    final_metrics = compute_fitness(grid, elements, nets, placement)

    if verbose:
        log("Итоговые метрики:")
        for k in sorted(final_metrics.keys()):
            log(f"  {k}: {final_metrics[k]}")
        log("")

    return placement, final_metrics
