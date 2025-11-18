let state = {
    positions: [],
    templates: [],
    elements: [],
    connections: [],
    board: { cols: 0, rows: 0, cellSize: 50 },
    bestChromosome: null,
    centers: {},
};

let boardCanvas, boardCtx;
let compCanvas, compCtx;
let compPoints = [];
let compClosed = false;

// ----------------------
// Загрузка состояния
// ----------------------

async function loadState() {
    const res = await fetch("/api/state");
    const data = await res.json();
    state.positions = data.positions;
    state.templates = data.templates || [];
    state.elements = data.elements || [];
    state.connections = data.connections || [];
    state.board = data.board;

    initBoardCanvas();
    initComponentCanvas();
    updateTemplatesUI();
    updateElementsUI();
    updateConnectionsUI();
}

// ----------------------
// Поле платы
// ----------------------

function initBoardCanvas() {
    boardCanvas = document.getElementById("boardCanvas");
    boardCtx = boardCanvas.getContext("2d");

    boardCanvas.width = state.board.cols * state.board.cellSize;
    boardCanvas.height = state.board.rows * state.board.cellSize;

    drawBoard();
}

function drawBoard() {
    const { cols, rows, cellSize } = state.board;
    const ctx = boardCtx;

    ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

    // сетка
    ctx.strokeStyle = "#1f2933";
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * cellSize, 0);
        ctx.lineTo(c * cellSize, rows * cellSize);
        ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * cellSize);
        ctx.lineTo(cols * cellSize, r * cellSize);
        ctx.stroke();
    }

    if (state.bestChromosome && state.bestChromosome.length === state.positions.length) {
        drawPlacement();
        drawConnections();
    } else {
        // просто показываем позиции
        ctx.fillStyle = "#4b5563";
        for (const pos of state.positions) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, cellSize * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function colorForElement(id) {
    const colors = [
        "#ef4444", "#22c55e", "#3b82f6", "#eab308",
        "#a855f7", "#14b8a6", "#f97316", "#ec4899",
    ];
    return colors[id % colors.length];
}

function findTemplate(id) {
    return state.templates.find(t => t.id === id);
}

function drawPlacement() {
    const ctx = boardCtx;
    const { cellSize } = state.board;

    // Рисуем все элементы по их центрам
    for (const el of state.elements) {
        const center = state.centers[el.id];
        if (!center) continue;

        const tmpl = findTemplate(el.template_id);
        if (!tmpl || !tmpl.polygon || tmpl.polygon.length === 0) continue;

        const color = colorForElement(el.id);
        const poly = tmpl.polygon;

        // исходный bbox шаблона
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of poly) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }
        const w0 = maxX - minX || 1;
        const h0 = maxY - minY || 1;
        const cx0 = (minX + maxX) / 2;
        const cy0 = (minY + maxY) / 2;

        const cellsX = tmpl.cells_x || 1;
        const cellsY = tmpl.cells_y || 1;
        const targetW = cellsX * cellSize * 0.9;
        const targetH = cellsY * cellSize * 0.9;

        const scale = Math.min(targetW / w0, targetH / h0);

        // трансформируем точки: масштаб + перенос к центру элемента
        const transformed = poly.map(p => ({
            x: (p.x - cx0) * scale + center[0],
            y: (p.y - cy0) * scale + center[1],
        }));

        // заливка
        ctx.beginPath();
        ctx.moveTo(transformed[0].x, transformed[0].y);
        for (let i = 1; i < transformed.length; i++) {
            ctx.lineTo(transformed[i].x, transformed[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = color + "cc";
        ctx.fill();

        // контур
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // подпись
        ctx.fillStyle = "#e5e7eb";
        ctx.font = `${cellSize * 0.2}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(el.name, center[0], center[1]);
    }
}

function drawConnections() {
    const ctx = boardCtx;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#f97316";

    for (const conn of state.connections) {
        const ca = state.centers[conn.from_id];
        const cb = state.centers[conn.to_id];
        if (!ca || !cb) continue;

        ctx.beginPath();
        ctx.moveTo(ca[0], ca[1]);
        ctx.lineTo(cb[0], cb[1]);
        ctx.stroke();
    }
}

// ----------------------
// UI списков
// ----------------------

function updateTemplatesUI() {
    const list = document.getElementById("templatesList");
    const select = document.getElementById("templateSelect");
    list.innerHTML = "";
    select.innerHTML = "";

    for (const t of state.templates) {
        const li = document.createElement("li");
        li.textContent = `${t.id}: ${t.name} (${t.cells_x}x${t.cells_y} позиций)`;
        list.appendChild(li);

        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = `${t.id}: ${t.name}`;
        select.appendChild(opt);
    }
}

function updateElementsUI() {
    const list = document.getElementById("elementsList");
    const fromSel = document.getElementById("connFrom");
    const toSel = document.getElementById("connTo");

    list.innerHTML = "";
    fromSel.innerHTML = "";
    toSel.innerHTML = "";

    for (const el of state.elements) {
        const tmpl = findTemplate(el.template_id);
        const li = document.createElement("li");
        li.textContent = `${el.id}: ${el.name} [${tmpl ? tmpl.name : "?"}]`;
        list.appendChild(li);

        const opt1 = document.createElement("option");
        opt1.value = el.id;
        opt1.textContent = `${el.id}: ${el.name}`;
        fromSel.appendChild(opt1);

        const opt2 = document.createElement("option");
        opt2.value = el.id;
        opt2.textContent = `${el.id}: ${el.name}`;
        toSel.appendChild(opt2);
    }
}

function updateConnectionsUI() {
    const list = document.getElementById("connectionsList");
    list.innerHTML = "";
    for (const conn of state.connections) {
        const a = state.elements.find(e => e.id === conn.from_id);
        const b = state.elements.find(e => e.id === conn.to_id);
        const li = document.createElement("li");
        li.textContent = `${a ? a.name : conn.from_id} ↔ ${b ? b.name : conn.to_id}`;
        list.appendChild(li);
    }
}

// ----------------------
// Конструктор класса компонента
// ----------------------

function initComponentCanvas() {
    if (compCanvas) return; // уже инициализирован
    compCanvas = document.getElementById("componentCanvas");
    compCtx = compCanvas.getContext("2d");
    compCanvas.width = 600;
    compCanvas.height = 200;

    compCanvas.addEventListener("click", onComponentClick);
    redrawComponentCanvas();
}

function onComponentClick(event) {
    const rect = compCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (compClosed) return;

    compPoints.push({ x, y });
    document.getElementById("pointsCount").textContent = compPoints.length.toString();
    redrawComponentCanvas();
}

function redrawComponentCanvas() {
    const ctx = compCtx;
    ctx.clearRect(0, 0, compCanvas.width, compCanvas.height);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, compCanvas.width, compCanvas.height);

    // простая сетка
    ctx.strokeStyle = "#1f2933";
    ctx.lineWidth = 1;
    for (let x = 0; x <= compCanvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, compCanvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= compCanvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(compCanvas.width, y);
        ctx.stroke();
    }

    if (compPoints.length === 0) return;

    // соединяем точки прямыми линиями
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(compPoints[0].x, compPoints[0].y);
    for (let i = 1; i < compPoints.length; i++) {
        ctx.lineTo(compPoints[i].x, compPoints[i].y);
    }
    if (compClosed && compPoints.length > 2) {
        ctx.lineTo(compPoints[0].x, compPoints[0].y);
    }
    ctx.stroke();

    // точки
    ctx.fillStyle = "#ef4444";
    for (const p of compPoints) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function finishComponent() {
    if (compPoints.length < 3) {
        alert("Нужно минимум 3 точки для многоугольника.");
        return;
    }
    compClosed = true;
    redrawComponentCanvas();
}

function clearComponent() {
    compPoints = [];
    compClosed = false;
    document.getElementById("pointsCount").textContent = "0";
    redrawComponentCanvas();
}

async function saveTemplate() {
    const name = document.getElementById("compName").value.trim();
    const cellsX = parseInt(document.getElementById("compCellsX").value, 10) || 1;
    const cellsY = parseInt(document.getElementById("compCellsY").value, 10) || 1;

    if (!name) {
        alert("Введите имя класса.");
        return;
    }
    if (compPoints.length < 3) {
        alert("Нарисуйте класс (минимум 3 точки).");
        return;
    }

    const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: name,
            cells_x: cellsX,
            cells_y: cellsY,
            points: compPoints,
        }),
    });
    const data = await res.json();
    if (!res.ok) {
        alert(data.error || "Ошибка при сохранении класса");
        return;
    }

    state.templates.push(data);
    updateTemplatesUI();

    clearComponent();
    document.getElementById("compName").value = "";
}

// ----------------------
// Добавление элемента и связи
// ----------------------

async function addElement() {
    if (state.templates.length === 0) {
        alert("Сначала создайте хотя бы один класс компонента.");
        return;
    }
    const templateId = parseInt(document.getElementById("templateSelect").value, 10);
    const name = document.getElementById("elementName").value.trim();
    if (!name) {
        alert("Введите имя элемента (например, R1).");
        return;
    }

    const res = await fetch("/api/elements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId, name }),
    });
    const data = await res.json();
    if (!res.ok) {
        alert(data.error || "Ошибка при добавлении элемента");
        return;
    }

    state.elements.push(data);
    updateElementsUI();
    document.getElementById("elementName").value = "";
}

async function addConnection() {
    if (state.elements.length < 2) {
        alert("Нужно минимум два элемента.");
        return;
    }
    const from = document.getElementById("connFrom").value;
    const to = document.getElementById("connTo").value;

    const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_id: from, to_id: to }),
    });
    const data = await res.json();
    if (!res.ok) {
        alert(data.error || "Ошибка при добавлении связи");
        return;
    }

    state.connections = data.connections;
    updateConnectionsUI();
    drawBoard();
}

// ----------------------
// Алгоритмы: последовательный и ГА
// ----------------------

function applyResult(data) {
    state.bestChromosome = data.best_chromosome;
    state.centers = {};
    for (const [k, v] of Object.entries(data.centers)) {
        state.centers[parseInt(k, 10)] = v;
    }
    state.positions = data.positions;
    state.templates = data.templates;
    state.elements = data.elements;
    state.connections = data.connections;

    document.getElementById("fitnessValue").textContent = data.fitness.toFixed(4);
    document.getElementById("totalLengthValue").textContent = data.total_length.toFixed(2);
    document.getElementById("maxLengthValue").textContent = data.max_length.toFixed(2);

    updateTemplatesUI();
    updateElementsUI();
    updateConnectionsUI();
    drawBoard();
}

async function runSequential() {
    if (state.elements.length === 0) {
        alert("Нет элементов.");
        return;
    }
    if (state.connections.length === 0) {
        alert("Нет связей.");
        return;
    }
    const payload = {
        steps: parseInt(document.getElementById("steps").value, 10) || 1000,
        alpha: parseFloat(document.getElementById("alpha").value) || 0.5,
        beta: parseFloat(document.getElementById("beta").value) || 0.5,
    };

    const res = await fetch("/api/run_seq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
        alert(data.error || "Ошибка последовательного алгоритма");
        return;
    }
    applyResult(data);
}

async function runGA() {
    if (state.elements.length === 0) {
        alert("Нет элементов.");
        return;
    }
    if (state.connections.length === 0) {
        alert("Нет связей.");
        return;
    }

    const payload = {
        population_size: parseInt(document.getElementById("popSize").value, 10) || 40,
        generations: parseInt(document.getElementById("steps").value, 10) || 50,
        crossover_prob: parseFloat(document.getElementById("pcross").value) || 0.8,
        mutation_prob: parseFloat(document.getElementById("pmut").value) || 0.05,
        alpha: parseFloat(document.getElementById("alpha").value) || 0.5,
        beta: parseFloat(document.getElementById("beta").value) || 0.5,
    };

    const res = await fetch("/api/run_ga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
        alert(data.error || "Ошибка ГА");
        return;
    }
    applyResult(data);
}

// ----------------------
// Старт
// ----------------------

window.addEventListener("DOMContentLoaded", () => {
    loadState();

    document.getElementById("finishComponentBtn").addEventListener("click", finishComponent);
    document.getElementById("clearComponentBtn").addEventListener("click", clearComponent);
    document.getElementById("saveComponentBtn").addEventListener("click", saveTemplate);
    document.getElementById("addElementBtn").addEventListener("click", addElement);
    document.getElementById("addConnectionBtn").addEventListener("click", addConnection);
    document.getElementById("runSeqBtn").addEventListener("click", runSequential);
    document.getElementById("runGaBtn").addEventListener("click", runGA);
});
