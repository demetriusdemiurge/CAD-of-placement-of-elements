from collections import deque
from typing import List, Tuple, Optional, Dict


class WaveAlgorithm:
    def __init__(self, grid: List[List[int]]):
        """
        Инициализация алгоритма.

        Args:
            grid: Двумерный массив, где:
                  0 - свободная ячейка
                  1 - занятая ячейка (препятствие)
        """
        self.grid = grid
        self.rows = len(grid)
        self.cols = len(grid[0]) if self.rows > 0 else 0
        self.wave_grid = [[-1] * self.cols for _ in range(self.rows)]
        self.parent = [[None] * self.cols for _ in range(self.rows)]

    def is_valid_cell(self, row: int, col: int) -> bool:
        """Проверка, находится ли ячейка в пределах сетки."""
        return 0 <= row < self.rows and 0 <= col < self.cols

    def is_free_cell(self, row: int, col: int) -> bool:
        """Проверка, является ли ячейка свободной."""
        return self.is_valid_cell(row, col) and self.grid[row][col] == 0

    def get_neighbors(self, row: int, col: int) -> List[Tuple[int, int]]:
        """Получение соседних ячеек (по ребру)."""
        directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]  # вправо, вниз, влево, вверх
        neighbors = []

        for dr, dc in directions:
            new_row, new_col = row + dr, col + dc
            if self.is_free_cell(new_row, new_col):
                neighbors.append((new_row, new_col))

        return neighbors

    def propagate_wave(self, start: Tuple[int, int], end: Tuple[int, int]) -> bool:
        """
        Распространение волны от начальной точки до конечной.

        Args:
            start: Координаты начальной точки (row, col)
            end: Координаты конечной точки (row, col)

        Returns:
            True если путь найден, False в противном случае
        """
        start_row, start_col = start
        end_row, end_col = end

        # Проверка валидности начальной и конечной точек
        if not self.is_free_cell(start_row, start_col):
            print(f"Начальная точка {start} занята или вне сетки")
            return False
        if not self.is_free_cell(end_row, end_col):
            print(f"Конечная точка {end} занята или вне сетки")
            return False

        # Инициализация
        for i in range(self.rows):
            for j in range(self.cols):
                self.wave_grid[i][j] = -1
                self.parent[i][j] = None

        # Начальная точка
        self.wave_grid[start_row][start_col] = 0
        self.parent[start_row][start_col] = None

        # Очередь для BFS (распространения волны)
        queue = deque([(start_row, start_col)])
        current_front = 0
        fronts = {0: [(start_row, start_col)]}

        # Распространение волны
        while queue:
            row, col = queue.popleft()
            current_weight = self.wave_grid[row][col]

            # Если достигли конечной точки
            if (row, col) == (end_row, end_col):
                return True

            # Получаем соседей
            neighbors = self.get_neighbors(row, col)

            for neighbor_row, neighbor_col in neighbors:
                # Если ячейка еще не посещена
                if self.wave_grid[neighbor_row][neighbor_col] == -1:
                    # Присваиваем вес (k+1)
                    self.wave_grid[neighbor_row][neighbor_col] = current_weight + 1
                    # Сохраняем родительскую ячейку (путевая координата)
                    self.parent[neighbor_row][neighbor_col] = (row, col)
                    # Добавляем в очередь
                    queue.append((neighbor_row, neighbor_col))

        # Если вышли из цикла, значит конечная точка не достигнута
        return False

    def trace_path(self, start: Tuple[int, int], end: Tuple[int, int]) -> Optional[List[Tuple[int, int]]]:
        """
        Построение пути от конечной точки к начальной.

        Args:
            start: Координаты начальной точки (row, col)

            end: Координаты конечной точки (row, col)

        Returns:
            Список координат пути или None если путь не найден
        """
        # Распространяем волну
        if not self.propagate_wave(start, end):
            return None

        # Восстанавливаем путь от конца к началу
        path = []
        current_row, current_col = end

        while (current_row, current_col) != start:
            path.append((current_row, current_col))
            if self.parent[current_row][current_col] is None:
                break
            current_row, current_col = self.parent[current_row][current_col]

        path.append(start)
        path.reverse()

        return path

    def get_k_neighborhood(self, start: Tuple[int, int], k: int) -> List[Tuple[int, int]]:
        """
        Получение k-окрестности ячейки.

        Args:
            start: Координаты начальной точки
            k: Номер окрестности

        Returns:
            Список ячеек, входящих в k-окрестность
        """
        start_row, start_col = start
        if not self.is_free_cell(start_row, start_col):
            return []

        # Распространяем волну
        self.propagate_wave(start, start)  # передаем start как end тоже

        # Собираем все ячейки с весом <= k
        neighborhood = []
        for i in range(self.rows):
            for j in range(self.cols):
                if 0 <= self.wave_grid[i][j] <= k:
                    neighborhood.append((i, j))

        return neighborhood

    def print_wave_grid(self):
        """Вывод волновой сетки для отладки."""
        print("Волновая сетка:")
        for row in range(self.rows):
            for col in range(self.cols):
                if self.grid[row][col] == 1:
                    print("  X", end=" ")  # Препятствие
                elif self.wave_grid[row][col] == -1:
                    print("  .", end=" ")  # Недостижимая ячейка
                else:
                    print(f"{self.wave_grid[row][col]:3}", end=" ")
            print()
        print()


def main():
    # Пример использования

    # Создаем тестовую сетку (0 - свободно, 1 - препятствие)
    grid = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 0, 0],
        [0, 0, 0, 0, 1, 0, 0],
        [0, 0, 1, 1, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0]
    ]

    # Создаем экземпляр алгоритма
    wave_alg = WaveAlgorithm(grid)

    # Задаем начальную и конечную точки
    start_point = (0, 0)  # Верхний левый угол
    end_point = (6, 6)  # Нижний правый угол

    print("Исходная сетка:")
    for row in grid:
        print(" ".join("X" if cell == 1 else "." for cell in row))
    print()

    # Пытаемся найти путь
    path = wave_alg.trace_path(start_point, end_point)

    if path:
        print(f"Путь найден! Длина: {len(path) - 1} шагов")
        print(f"Путь: {path}")
        print()

        # Выводим путь на сетке
        print("Путь на сетке:")
        for i in range(wave_alg.rows):
            for j in range(wave_alg.cols):
                if (i, j) == start_point:
                    print(" A", end=" ")
                elif (i, j) == end_point:
                    print(" B", end=" ")
                elif (i, j) in path:
                    print(" *", end=" ")
                elif grid[i][j] == 1:
                    print(" X", end=" ")
                else:
                    print(" .", end=" ")
            print()
        print()

        # Показываем волновую сетку
        wave_alg.print_wave_grid()

        # Получаем 3-окрестность начальной точки
        print("3-окрестность точки A:")
        neighborhood = wave_alg.get_k_neighborhood(start_point, 3)
        print(neighborhood)

    else:
        print("Путь не найден!")


if __name__ == "__main__":
    main()
