# Grid, Position, GOST-сетка
from dataclasses import dataclass, field

@dataclass
class Grid:
    """
    Прямоугольная сетка N x M.
    Позиция = индекс 0..N-1.

    - width_cells, height_cells — размер поля в клетках.
    - allowed[idx] — можно ли использовать позицию idx.
    """
    width_cells: int
    height_cells: int
    allowed: list[bool] = field(default_factory=list)

    def __post_init__(self):
        if self.width_cells <= 0 or self.height_cells <= 0:
            raise ValueError("Размеры сетки должны быть положительными целыми числами")

        total = self.num_positions
        if not self.allowed:
            # По умолчанию все позиции разрешены
            self.allowed = [True] * total
        else:
            if len(self.allowed) != total:
                raise ValueError(
                    f"Длина allowed ({len(self.allowed)}) не совпадает "
                    f"с количеством позиций ({total})"
                )

    @property
    def num_positions(self) -> int:
        """Общее количество позиций на сетке = ширина * высота."""
        return self.width_cells * self.height_cells

    def idx_to_xy(self, idx: int) -> tuple[int, int]:
        """
        Индекс -> координаты (x, y).
        id = y * width + x
        """
        if not (0 <= idx < self.num_positions):
            raise IndexError(f"Индекс {idx} вне диапазона [0, {self.num_positions})")
        x = idx % self.width_cells
        y = idx // self.width_cells
        return x, y

    def xy_to_idx(self, x: int, y: int) -> int:
        """
        Координаты (x, y) -> индекс.
        id = y * width + x
        """
        if not (0 <= x < self.width_cells and 0 <= y < self.height_cells):
            raise IndexError(
                f"Координаты ({x},{y}) вне сетки "
                f"[0,{self.width_cells}) x [0,{self.height_cells})"
            )
        return y * self.width_cells + x