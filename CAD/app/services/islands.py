from __future__ import annotations
import multiprocessing as mp
import random
from typing import Dict, List, Tuple, Optional
import numpy as np
import signal

from app.schemas.design import Design
from app.services.ga import init_genes, decode_genes, repair, fitness, uniform_crossover, mutate

def _init_worker():
    try:
        signal.signal(signal.SIGINT, signal.SIG_IGN)
    except Exception:
        pass

def run_ga_island(
    design: Design,
    positions: List[Tuple[float, float]],
    comp_order: List[str],
    pop_size: int,
    generations: int,
    mut_rate: float,
    elite: int,
    migration_interval: int,
    migrants_out: Optional[mp.Queue],
    migrants_in: Optional[mp.Queue],
    seed: int,
    w_pair: float,
    w_longest: float,
) -> Tuple[List[int], float]:
    rng = random.Random(seed)
    M = len(positions)
    K = len(comp_order)

    pop = [init_genes(M, K, rng) for _ in range(pop_size)]
    for ind in pop:
        repair(ind, K, rng)
    scores = [fitness(design, ind, comp_order, positions, w_pair, w_longest) for ind in pop]

    for gen in range(1, generations + 1):
        def tournament_idx():
            i, j, k = rng.sample(range(pop_size), 3)
            best = min([(scores[i], i), (scores[j], j), (scores[k], k)])
            return best[1]

        new_pop: List[List[int]] = []
        # элита
        for idx in np.argsort(scores)[:elite]:
            new_pop.append(pop[idx][:])

        # репродукция
        while len(new_pop) < pop_size:
            p1 = pop[tournament_idx()]
            p2 = pop[tournament_idx()]
            c1, c2 = uniform_crossover(p1, p2, rng)
            mutate(c1, rng, mut_rate); mutate(c2, rng, mut_rate)
            repair(c1, K, rng); repair(c2, K, rng)
            new_pop.append(c1)
            if len(new_pop) < pop_size:
                new_pop.append(c2)

        pop = new_pop
        scores = [fitness(design, ind, comp_order, positions, w_pair, w_longest) for ind in pop]

        # миграции
        if migration_interval > 0 and gen % migration_interval == 0:
            if migrants_out is not None:
                best_idx = int(np.argmin(scores))
                migrants_out.put((scores[best_idx], pop[best_idx]))
            if migrants_in is not None:
                try:
                    while True:
                        s, ind = migrants_in.get_nowait()
                        worst_idx = int(np.argmax(scores))
                        pop[worst_idx] = ind
                        scores[worst_idx] = s
                except Exception:
                    pass

    best_idx = int(np.argmin(scores))
    return pop[best_idx], scores[best_idx]

def parallel_ga(
    design: Design,
    positions: List[Tuple[float, float]],
    comp_order: List[str],
    pop_size: int = 100,
    generations: int = 500,
    mut_rate: float = 0.2,
    elite: int = 2,
    islands: int = 4,
    migration_interval: int = 25,
    seed: int = 0,
    w_pair: float = 1.0,
    w_longest: float = 0.3,
) -> Tuple[Dict[str, Tuple[float, float]], float]:
    """Островная модель с новой хромосомой (длина=M, gene=comp_id|-1)."""
    if islands <= 1:
        chrom, score = run_ga_island(
            design, positions, comp_order, pop_size, generations, mut_rate, elite,
            0, None, None, seed, w_pair, w_longest
        )
        return decode_genes(chrom, comp_order, positions), score

    ctx = mp.get_context("spawn")
    mgr = ctx.Manager()

    qs_out = [mgr.Queue() for _ in range(islands)]
    qs_in  = [qs_out[(i-1) % islands] for i in range(islands)]

    args_list = []
    for i in range(islands):
        args_list.append((
            design, positions, comp_order, pop_size, generations, mut_rate, elite,
            migration_interval, qs_out[i], qs_in[i], seed + 100*i, w_pair, w_longest
        ))

    pool = ctx.Pool(processes=islands, initializer=_init_worker)
    try:
        async_res = [pool.apply_async(run_ga_island, args=args) for args in args_list]
        results = [r.get() for r in async_res]
    except KeyboardInterrupt:
        pool.terminate(); pool.join(); raise
    else:
        pool.close(); pool.join()

    chrom, score = min(results, key=lambda x: x[1])
    return decode_genes(chrom, comp_order, positions), score
