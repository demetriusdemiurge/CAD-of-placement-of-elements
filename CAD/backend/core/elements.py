# Element, Pin

from dataclasses import dataclass


@dataclass
class Pin:
    """
    Пин относительно базовой ориентации (0°), в клетках.
    dx, dy — смещение от левого верхнего угла элемента.
    """
    id: str
    dx: int
    dy: int


@dataclass
class Element:
    """
    Элемент (компонент) на сетке.

    В базовой ориентации (0°):
    - ширина w_cells,
    - высота h_cells,
    - пины с координатами (dx, dy) в пределах [0..w_cells-1] x [0..h_cells-1].
    """
    id: int
    name: str
    w_cells: int
    h_cells: int
    pins: list[Pin]
    allowed_orientations: tuple[int, ...] = (0, 90, 180, 270)

    def size_for_orientation(self, orientation: int) -> tuple[int, int]:
        """
        Габариты (w, h) элемента для заданной ориентации.
        Для 90/270 — меняем местами ширину и высоту.
        """
        if orientation % 180 == 0:
            return self.w_cells, self.h_cells
        else:
            return self.h_cells, self.w_cells

    def rotated_pin_offset(self, pin: Pin, orientation: int) -> tuple[int, int]:
        """
        Возвращает (dx', dy') для пина в заданной ориентации.
        Вращаем вокруг левого верхнего угла bounding-box элемента.
        """
        w0, h0 = self.w_cells, self.h_cells

        if orientation == 0:
            return pin.dx, pin.dy
        elif orientation == 90:
            # (dx, dy) -> (h0 - 1 - dy, dx)
            return h0 - 1 - pin.dy, pin.dx
        elif orientation == 180:
            # (dx, dy) -> (w0 - 1 - dx, h0 - 1 - dy)
            return w0 - 1 - pin.dx, h0 - 1 - pin.dy
        elif orientation == 270:
            # (dx, dy) -> (dy, w0 - 1 - dx)
            return pin.dy, w0 - 1 - pin.dx
        else:
            raise ValueError(f"Неподдерживаемая ориентация: {orientation}")

    def rotated_pins(self, orientation: int) -> list[tuple[Pin, int, int]]:
        """
        Удобный helper: для заданной ориентации возвращает список
        (pin, dx', dy') для всех пинов.
        """
        result: list[tuple[Pin, int, int]] = []
        for p in self.pins:
            dx, dy = self.rotated_pin_offset(p, orientation)
            result.append((p, dx, dy))
        return result
