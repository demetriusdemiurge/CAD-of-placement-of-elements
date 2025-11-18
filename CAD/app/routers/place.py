from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.schemas.design import demo_design_dict, SeqReq, GAReq
from app.services.positions import generate_positions
from app.services.seq import sequential_place
from app.services.islands import parallel_ga
from app.services.metrics import objectives
from app.web.svg import render_svg

router = APIRouter()

@router.get("/design/demo")
def demo_design():
    return JSONResponse(demo_design_dict())

@router.post("/place/seq")
def place_seq(req: SeqReq):
    dsg = req.design.to_domain()
    # поле заранее: если передано в design.field — используем его, иначе сгенерим
    if dsg.field and len(dsg.field) >= len(dsg.components):
        positions = dsg.field
    else:
        positions = generate_positions(dsg.board, dsg.components, req.nx, req.ny)
    if len(positions) < len(dsg.components):
        return JSONResponse({"error": "Позиций меньше, чем элементов"}, status_code=400)

    placement = sequential_place(dsg, positions, seed=req.seed)
    obj = objectives(dsg, placement, w_pair=req.w_pair, w_longest=req.w_longest)
    svg = render_svg(dsg, placement, field=positions)
    return {"positions": placement, "metrics": obj, "svg": svg}

@router.post("/place/ga")
def place_ga(req: GAReq):
    dsg = req.design.to_domain()
    o = req.options
    if dsg.field and len(dsg.field) >= len(dsg.components):
        positions = dsg.field
    else:
        positions = generate_positions(dsg.board, dsg.components, o.nx, o.ny)
    if len(positions) < len(dsg.components):
        return JSONResponse({"error": "Позиций меньше, чем элементов"}, status_code=400)

    comp_order = list(dsg.components.keys())  # фиксированный порядок имён → индексы 0..K-1
    placement, score = parallel_ga(
        dsg, positions, comp_order,
        pop_size=o.pop_size, generations=o.generations,
        mut_rate=o.mut_rate, elite=o.elite,
        islands=o.islands, migration_interval=o.migration_interval,
        seed=o.seed, w_pair=o.w_pair, w_longest=o.w_longest
    )
    obj = objectives(dsg, placement, w_pair=o.w_pair, w_longest=o.w_longest)
    svg = render_svg(dsg, placement, field=positions)
    return {"positions": placement, "metrics": obj, "svg": svg}
