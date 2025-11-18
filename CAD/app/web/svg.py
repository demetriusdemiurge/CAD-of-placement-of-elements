from __future__ import annotations
from typing import Dict, Tuple, List, Optional
from app.schemas.design import Design
from app.services.metrics import build_pair_weights

def render_svg(
    design: Design,
    placement: Dict[str, Tuple[float, float]],
    field: Optional[List[Tuple[float, float]]] = None,
) -> str:
    W, H = design.board.W, design.board.H
    scale, pad = 5.0, 20  # 1 мм = 5 px
    def px(v: float) -> float: return pad + v * scale

    colors = ["#5B8FF9","#61DDAA","#65789B","#F6BD16","#7262FD","#78D3F8","#9661BC","#F6903D","#008685"]
    out: List[str] = []
    # плата
    out.append(f'<rect x="{px(0)}" y="{px(0)}" width="{W*scale}" height="{H*scale}" fill="#111" stroke="#888" stroke-width="1" rx="8"/>')
    # поле позиций
    if field:
        for (x,y) in field:
            out.append(f'<circle cx="{px(x)}" cy="{px(y)}" r="2.5" fill="#2f8" fill-opacity="0.7"/>')
    # связи (прямые отрезки по парам)
    w = build_pair_weights(design)
    for idx, ((u,v), c) in enumerate(w.items()):
        if u in placement and v in placement:
            x1,y1 = placement[u]; x2,y2 = placement[v]
            out.append(f'<line x1="{px(x1)}" y1="{px(y1)}" x2="{px(x2)}" y2="{px(y2)}" stroke="{colors[idx%len(colors)]}" stroke-opacity="0.6" stroke-width="{1+0.4*min(c,5)}"/>')
    # компоненты
    for comp in design.components.values():
        if comp.name not in placement:
            continue
        cx, cy = placement[comp.name]
        if comp.geometry:
            # Рисуем произвольные примитивы в локальных координатах (мм), ось (0,0) = центр
            out.append(f'<g transform="translate({px(cx)},{px(cy)}) scale({scale})">')
            for shp in comp.geometry:
                t = shp.get("type","")
                if t == "rect":
                    x = shp.get("x", -comp.w/2); y = shp.get("y", -comp.h/2)
                    w_ = shp.get("w", comp.w); h_ = shp.get("h", comp.h)
                    rx = shp.get("rx", 0); ry = shp.get("ry", 0)
                    out.append(f'<rect x="{x}" y="{y}" width="{w_}" height="{h_}" rx="{rx}" ry="{ry}" fill="#1f2a3a" stroke="#9fb0c3" stroke-width="{1/scale}"/>')
                elif t == "circle":
                    cx0 = shp.get("cx", 0); cy0 = shp.get("cy", 0); r = shp.get("r", min(comp.w,comp.h)/2)
                    out.append(f'<circle cx="{cx0}" cy="{cy0}" r="{r}" fill="#1f2a3a" stroke="#9fb0c3" stroke-width="{1/scale}"/>')
                elif t == "polygon":
                    pts = shp.get("points", [])
                    pts_str = " ".join([f'{x},{y}' for x,y in pts])
                    out.append(f'<polygon points="{pts_str}" fill="#1f2a3a" stroke="#9fb0c3" stroke-width="{1/scale}"/>')
                elif t == "path":
                    d = shp.get("d","")
                    out.append(f'<path d="{d}" fill="#1f2a3a" stroke="#9fb0c3" stroke-width="{1/scale}"/>')
            out.append('</g>')
        else:
            # Фолбэк: простой прямоугольник по габаритам
            x0, y0 = px(cx - comp.w/2.0), px(cy - comp.h/2.0)
            out.append(f'<rect x="{x0}" y="{y0}" width="{comp.w*scale}" height="{comp.h*scale}" fill="#1f2a3a" stroke="#9fb0c3" stroke-width="1"/>')
        # подпись
        out.append(f'<text x="{px(cx)}" y="{px(cy)}" fill="#e8f1ff" font-size="10" text-anchor="middle" dominant-baseline="central">{comp.name}</text>')

    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{int(W*scale)+2*pad}" height="{int(H*scale)+2*pad}" viewBox="0 0 {int(W*scale)+2*pad} {int(H*scale)+2*pad}">\n' + "\n".join(out) + "\n</svg>"
