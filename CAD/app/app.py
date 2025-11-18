import math
import random
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional

from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# -----------------------
# Модель данных
# -----------------------

BOARD_COLS = 10
BOARD_ROWS = 6
CELL_SIZE = 50

# Позиции на плате
positions: List[Dict] = []
for r in range(BOARD_ROWS):
    for c in range(BOARD_COLS):
        idx = r * BOARD_COLS + c
        positions.append({
            "id": idx,
            "col": c,
            "row": r,
            "x": c * CELL_SIZE + CELL_SIZE / 2,
            "y": r * CELL_SIZE + CELL_SIZE / 2,
        })

# Классы компонентов (шаблоны фигур, которые рисует пользователь)
component_templates: List[Dict] = []
next_template_id = 0

# Экземпляры элементов (R1, R2, U1 и т.п.), которые размещаются на плате
elements: List[Dict] = []
next_element_id = 0

# Связи между элементами
connections: List[Dict] = []

DEFAULT_ALPHA = 0.5
DEFAULT_BETA = 0.5


# -----------------------
# Вспомогательная логика
# -----------------------

def board_diagonal() -> float:
    """Максимальная диагональ платы (для нормировки)."""
    if not positions:
        return 1.0
    xs = [p["x"] for p in positions]
    ys = [p["y"] for p in positions]
    dx = max(xs) - min(xs)
    dy = max(ys) - min(ys)
    d = math.hypot(dx, dy)
    return d if d > 0 else 1.0


def find_template(tid: int) -> Optional[Dict]:
    for t in component_templates:
        if t["id"] == tid:
            return t
    return None


def element_size(elem: Dict) -> int:
    """Размер элемента в количестве позиций (cells_x * cells_y)."""
    tmpl = find_template(elem["template_id"])
    if tmpl is None:
        return 1
    cx = max(1, int(tmpl.get("cells_x", 1)))
    cy = max(1, int(tmpl.get("cells_y", 1)))
    return cx * cy


def build_element_pool() -> List[int]:
    """
    Создаем пул id элементов, где каждый элемент повторяется
    столько раз, сколько позиций он "занимает" (cells_x * cells_y).
    """
    pool: List[int] = []
    for el in elements:
        size = max(1, element_size(el))
        pool.extend([el["id"]] * size)

    num_positions = len(positions)
    if not pool:
        pool = [0] * max(1, num_positions)

    # подгоняем под число позиций
    if len(pool) < num_positions:
        while len(pool) < num_positions:
            pool.append(random.choice(pool))
    elif len(pool) > num_positions:
        pool = pool[:num_positions]

    return pool


def chromosome_to_centers(chromosome: List[int]) -> Dict[int, Tuple[float, float]]:
    """
    По хромосоме считаем центры масс каждого элемента.
    """
    pts: Dict[int, List[Tuple[float, float]]] = {}
    for pos_idx, elem_id in enumerate(chromosome):
        pos = positions[pos_idx]
        pts.setdefault(elem_id, []).append((pos["x"], pos["y"]))

    centers: Dict[int, Tuple[float, float]] = {}
    for eid, ps in pts.items():
        sx = sum(p[0] for p in ps) / len(ps)
        sy = sum(p[1] for p in ps) / len(ps)
        centers[eid] = (sx, sy)
    return centers


def evaluate_chromosome_core(chromosome: List[int],
                             alpha: float,
                             beta: float) -> Tuple[float, float, float]:
    """
    Оценка одной конфигурации:
    - суммарная длина связей,
    - максимальная длина связи,
    - аддитивный нормированный критерий J и fitness = 1/(1+J).
    """
    if not connections:
        return 0.0, 0.0, 0.0

    centers = chromosome_to_centers(chromosome)
    d_max = board_diagonal()

    total_len = 0.0
    max_len = 0.0

    for conn in connections:
        a = conn["from_id"]
        b = conn["to_id"]
        if a not in centers or b not in centers:
            continue
        x1, y1 = centers[a]
        x2, y2 = centers[b]
        dist = math.hypot(x1 - x2, y1 - y2)
        total_len += dist
        if dist > max_len:
            max_len = dist

    if d_max == 0 or (total_len == 0 and max_len == 0):
        return 0.0, total_len, max_len

    num_conns = len(connections)
    total_norm = total_len / (d_max * num_conns)
    max_norm = max_len / d_max
    J = alpha * total_norm + beta * max_norm
    fitness = 1.0 / (1.0 + J)
    return fitness, total_len, max_len


def evaluate_chromosome_parallel(args):
    chromosome, alpha, beta = args
    return evaluate_chromosome_core(chromosome, alpha, beta)


# -----------------------
# Алгоритмы оптимизации
# -----------------------

@dataclass
class GAConfig:
    population_size: int = 40
    generations: int = 50
    crossover_prob: float = 0.8
    mutation_prob: float = 0.05
    alpha: float = DEFAULT_ALPHA
    beta: float = DEFAULT_BETA


@dataclass
class SeqConfig:
    steps: int = 1000
    alpha: float = DEFAULT_ALPHA
    beta: float = DEFAULT_BETA


def random_chromosome(element_pool: List[int]) -> List[int]:
    genes = element_pool[:]
    random.shuffle(genes)
    return genes


def tournament_select(population: List[List[int]],
                      fitnesses: List[float],
                      k: int = 3) -> List[int]:
    best = None
    best_fit = -1e9
    for _ in range(k):
        i = random.randrange(len(population))
        if fitnesses[i] > best_fit:
            best_fit = fitnesses[i]
            best = population[i]
    return best[:]


def one_point_crossover(p1: List[int],
                        p2: List[int],
                        prob: float):
    if random.random() > prob or len(p1) <= 1:
        return p1[:], p2[:]
    point = random.randint(1, len(p1) - 1)
    c1 = p1[:point] + p2[point:]
    c2 = p2[:point] + p1[point:]
    return c1, c2


def mutate(chromosome: List[int],
           element_ids: List[int],
           prob: float) -> List[int]:
    for i in range(len(chromosome)):
        if random.random() < prob:
            if random.random() < 0.5:
                chromosome[i] = random.choice(element_ids)
            else:
                j = random.randrange(len(chromosome))
                chromosome[i], chromosome[j] = chromosome[j], chromosome[i]
    return chromosome


def run_ga(config: GAConfig) -> Dict:
    """
    Параллельный генетический алгоритм (через ProcessPoolExecutor).
    """
    if not elements or not positions or not connections:
        raise RuntimeError("Недостаточно данных (элементы/позиции/связи) для запуска ГА")

    element_pool = build_element_pool()
    element_ids = [el["id"] for el in elements]

    # начальная популяция
    population: List[List[int]] = [
        random_chromosome(element_pool) for _ in range(config.population_size)
    ]

    # первая оценка
    with ProcessPoolExecutor() as ex:
        fitness_info = list(ex.map(
            evaluate_chromosome_parallel,
            [(chrom, config.alpha, config.beta) for chrom in population]
        ))
    fitnesses = [fi[0] for fi in fitness_info]

    best_chrom = population[0][:]
    best_fit, best_total, best_max = fitness_info[0]

    for _ in range(config.generations):
        new_pop: List[List[int]] = []
        # элитизм
        new_pop.append(best_chrom[:])

        while len(new_pop) < config.population_size:
            p1 = tournament_select(population, fitnesses)
            p2 = tournament_select(population, fitnesses)
            c1, c2 = one_point_crossover(p1, p2, config.crossover_prob)
            c1 = mutate(c1, element_ids, config.mutation_prob)
            c2 = mutate(c2, element_ids, config.mutation_prob)
            new_pop.append(c1)
            if len(new_pop) < config.population_size:
                new_pop.append(c2)

        population = new_pop

        with ProcessPoolExecutor() as ex:
            fitness_info = list(ex.map(
                evaluate_chromosome_parallel,
                [(chrom, config.alpha, config.beta) for chrom in population]
            ))
        fitnesses = [fi[0] for fi in fitness_info]

        for chrom, (fit, total_len, max_len) in zip(population, fitness_info):
            if fit > best_fit:
                best_fit = fit
                best_chrom = chrom[:]
                best_total = total_len
                best_max = max_len

    centers = chromosome_to_centers(best_chrom)

    return {
        "best_chromosome": best_chrom,
        "fitness": best_fit,
        "total_length": best_total,
        "max_length": best_max,
        "centers": centers,
    }


def run_sequential(config: SeqConfig) -> Dict:
    """
    Последовательный алгоритм (не ГА): рандомные обмены двух позиций
    с приёмом только улучшений (простое "hill-climbing").
    """
    if not elements or not positions or not connections:
        raise RuntimeError("Недостаточно данных (элементы/позиции/связи) для запуска алгоритма")

    element_pool = build_element_pool()
    chrom = random_chromosome(element_pool)
    best_chrom = chrom[:]
    best_fit, best_total, best_max = evaluate_chromosome_core(chrom, config.alpha, config.beta)

    for _ in range(config.steps):
        i = random.randrange(len(chrom))
        j = random.randrange(len(chrom))
        if i == j:
            continue
        chrom[i], chrom[j] = chrom[j], chrom[i]
        fit, total_len, max_len = evaluate_chromosome_core(chrom, config.alpha, config.beta)
        if fit > best_fit:
            best_fit = fit
            best_chrom = chrom[:]
            best_total = total_len
            best_max = max_len
        else:
            # откат если не улучшилось
            chrom[i], chrom[j] = chrom[j], chrom[i]

    centers = chromosome_to_centers(best_chrom)
    return {
        "best_chromosome": best_chrom,
        "fitness": best_fit,
        "total_length": best_total,
        "max_length": best_max,
        "centers": centers,
    }


# -----------------------
# Flask endpoints
# -----------------------

@app.route("/")
def index():
    return render_template(
        "index.html",
        board_cols=BOARD_COLS,
        board_rows=BOARD_ROWS,
        cell_size=CELL_SIZE
    )


@app.get("/api/state")
def api_state():
    return jsonify({
        "positions": positions,
        "templates": component_templates,
        "elements": elements,
        "connections": connections,
        "board": {
            "cols": BOARD_COLS,
            "rows": BOARD_ROWS,
            "cellSize": CELL_SIZE,
        }
    })


@app.post("/api/templates")
def api_add_template():
    """Добавление нового класса компонента (шаблон)."""
    global next_template_id
    data = request.get_json(force=True)
    name = data.get("name", f"Template {next_template_id}")
    points = data.get("points", [])
    cells_x = int(data.get("cells_x", 1))
    cells_y = int(data.get("cells_y", 1))

    tmpl = {
        "id": next_template_id,
        "name": name,
        "polygon": points,
        "cells_x": max(1, cells_x),
        "cells_y": max(1, cells_y),
    }
    component_templates.append(tmpl)
    next_template_id += 1
    return jsonify(tmpl)


@app.post("/api/elements")
def api_add_element():
    """Добавление экземпляра элемента (R1, R2...) на основе класса."""
    global next_element_id
    data = request.get_json(force=True)
    name = data.get("name", f"E{next_element_id}")
    template_id = int(data["template_id"])

    if find_template(template_id) is None:
        return jsonify({"error": "Шаблон не найден"}), 400

    el = {
        "id": next_element_id,
        "name": name,
        "template_id": template_id,
    }
    elements.append(el)
    next_element_id += 1
    return jsonify(el)


@app.post("/api/connections")
def api_add_connection():
    data = request.get_json(force=True)
    from_id = int(data["from_id"])
    to_id = int(data["to_id"])
    if from_id == to_id:
        return jsonify({"error": "Нельзя соединять элемент с самим собой"}), 400

    connections.append({
        "from_id": from_id,
        "to_id": to_id,
    })
    return jsonify({"connections": connections})


@app.post("/api/run_ga")
def api_run_ga():
    data = request.get_json(force=True)
    cfg = GAConfig(
        population_size=int(data.get("population_size", 40)),
        generations=int(data.get("generations", 50)),
        crossover_prob=float(data.get("crossover_prob", 0.8)),
        mutation_prob=float(data.get("mutation_prob", 0.05)),
        alpha=float(data.get("alpha", DEFAULT_ALPHA)),
        beta=float(data.get("beta", DEFAULT_BETA)),
    )
    try:
        result = run_ga(cfg)
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 400

    result["positions"] = positions
    result["templates"] = component_templates
    result["elements"] = elements
    result["connections"] = connections
    return jsonify(result)


@app.post("/api/run_seq")
def api_run_seq():
    data = request.get_json(force=True)
    cfg = SeqConfig(
        steps=int(data.get("steps", 1000)),
        alpha=float(data.get("alpha", DEFAULT_ALPHA)),
        beta=float(data.get("beta", DEFAULT_BETA)),
    )
    try:
        result = run_sequential(cfg)
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 400

    result["positions"] = positions
    result["templates"] = component_templates
    result["elements"] = elements
    result["connections"] = connections
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)
