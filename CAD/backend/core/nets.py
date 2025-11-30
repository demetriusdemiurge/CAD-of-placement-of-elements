# Net, ConnectivityGraph/conn_count_ij

from dataclasses import dataclass
from collections import defaultdict


@dataclass
class Net:
    """
    Одна связь между двумя пинами.
    a_element, a_pin  -- первый конец
    b_element, b_pin  -- второй конец
    """
    id: int
    a_element: int
    a_pin: str
    b_element: int
    b_pin: str


def compute_connectivity(nets: list[Net]) -> dict[tuple[int, int], int]:
    """
    conn_count[(i,j)] = сколько связей между элементами i и j.
    Каждый Net соединяет ровно два элемента (или даже один и тот же,
    но такое обычно не нужно).
    """
    conn_count: dict[tuple[int, int], int] = defaultdict(int)

    for net in nets:
        i = net.a_element
        j = net.b_element
        if i == j:
            # Если связь внутри одного элемента — можно либо игнорировать,
            # либо обработать отдельно. Для размещения обычно неважно.
            continue

        key = (min(i, j), max(i, j))
        conn_count[key] += 1

    return conn_count
