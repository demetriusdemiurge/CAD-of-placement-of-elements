# backend/tests/test_seq_placement.py

from backend.core.grid import Grid
from backend.core.elements import Element, Pin
from backend.core.nets import Net
from backend.algorithms.seq_placement import place_sequential


def test_place_sequential_two_elements():
    grid = Grid(width_cells=4, height_cells=2)

    # два простых элемента 1x1 с одним пином в (0,0)
    e1 = Element(id=1, name="E1", w_cells=1, h_cells=1,
                 pins=[Pin(id="1", dx=0, dy=0)])
    e2 = Element(id=2, name="E2", w_cells=1, h_cells=1,
                 pins=[Pin(id="1", dx=0, dy=0)])
    elements = {1: e1, 2: e2}

    # одна связь между E1.1 и E2.1
    nets = [Net(id=1, a_element=1, a_pin="1", b_element=2, b_pin="1")]

    placement, metrics = place_sequential(grid, elements, nets)

    # оба элемента должны быть размещены
    assert 1 in placement and 2 in placement

    # восстановим координаты
    pos_idx1, _ = placement[1]
    pos_idx2, _ = placement[2]
    x1, y1 = grid.idx_to_xy(pos_idx1)
    x2, y2 = grid.idx_to_xy(pos_idx2)

    # расстояние между ними должно быть минимальным: 1 (по клеткам) или, как минимум, < max_dist
    manhattan = abs(x1 - x2) + abs(y1 - y2)
    assert manhattan <= 1, f"Элементы расположены слишком далеко: d={manhattan}"

    # на всякий случай: F существует и конечен
    assert "F" in metrics
    assert metrics["F"] >= 0.0
