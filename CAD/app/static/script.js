class KiCadWebEditor {
    constructor() {
        this.canvas = document.getElementById('schemaCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.components = [];
        this.wires = [];
        this.selectedComponent = null;
        this.dragging = false;
        this.mode = 'select';
        this.currentWire = null;
        this.scale = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;

        // Настройки сетки
        this.gridSize = 20;
        this.gridEnabled = true;
        this.snapToGrid = true;

        this.libraries = {};
        this.customComponents = {};
        this.isPanning = false;
        this.lastPanX = 0;
        this.lastPanY = 0;

        this.statusInfo = document.getElementById('statusInfo');
        this.nextComponentId = 1;

        this.init();
    }

    async init() {
        await this.loadLibraries();
        this.setupEventListeners();
        this.render();
        this.updateStatusInfo();
    }

    async loadLibraries() {
    try {
        const response = await fetch('/api/get_libraries');
        const data = await response.json();
        this.libraries = data.kicad;
        this.customComponents = data.custom;

        console.log('Loaded libraries:', this.libraries); // Для отладки
        console.log('Loaded custom components:', this.customComponents); // Для отладки

        this.populateLibraries();
        this.populateCustomComponents();
    } catch (error) {
        console.error('Ошибка загрузки библиотек:', error);
        }
    }

    populateLibraries() {
        const container = document.getElementById('librariesList');
        container.innerHTML = '';

        for (const [libKey, library] of Object.entries(this.libraries)) {
            const section = document.createElement('div');
            section.className = 'library-section';

            const header = document.createElement('div');
            header.className = 'library-header';
            header.innerHTML = `
                <strong>${library.name}</strong>
                <span>▼</span>
            `;

            const content = document.createElement('div');
            content.className = 'library-content';
            content.style.display = 'none';

            header.addEventListener('click', () => {
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
                header.querySelector('span').textContent = content.style.display === 'none' ? '▼' : '▲';
            });

            for (const [compKey, component] of Object.entries(library.components)) {
                const compDiv = document.createElement('div');
                compDiv.className = 'component';
                compDiv.textContent = component.name;
                compDiv.setAttribute('data-library', libKey);
                compDiv.setAttribute('data-type', compKey);
                compDiv.addEventListener('click', () => this.addComponent(libKey, compKey));
                content.appendChild(compDiv);
            }

            section.appendChild(header);
            section.appendChild(content);
            container.appendChild(section);
        }
    }

    populateCustomComponents() {
    const container = document.getElementById('customComponentsList');
    container.innerHTML = '';

    if (Object.keys(this.customComponents).length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #bdc3c7; font-size: 12px; padding: 20px;">Пока нет пользовательских компонентов</div>';
        return;
    }



    for (const [compId, component] of Object.entries(this.customComponents)) {
        const compDiv = document.createElement('div');
        compDiv.className = 'component';
        compDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${component.name}</strong><br>
                    <small style="color: #bdc3c7;">${component.reference} • ${component.pins ? component.pins.length : 0} pins</small>
                </div>
                <button onclick="event.stopPropagation(); deleteCustomComponent('${compId}')"
                        style="background: var(--danger-color); border: none; color: white; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer;">
                    🗑
                </button>
            </div>
        `;
        compDiv.setAttribute('data-library', 'custom');
        compDiv.setAttribute('data-type', compId);
        compDiv.addEventListener('click', () => {
            console.log('Clicked custom component:', compId); // Для отладки
            this.addComponent('custom', compId);
        });
        container.appendChild(compDiv);
        }
    }

    addComponent(libraryKey, componentKey) {
        console.log('Adding component:', libraryKey, componentKey);

        let componentDef;

        if (libraryKey === 'custom') {
            // Для пользовательских компонентов - прямой доступ к объекту
            componentDef = this.customComponents[componentKey];
        } else {
            // Для базовых компонентов - доступ через библиотеку и components
            const library = this.libraries[libraryKey];
            if (library && library.components) {
                componentDef = library.components[componentKey];
            }
        }

        if (!componentDef) {
            console.error('Component not found:', componentKey, 'in library:', libraryKey);
            console.error('Available custom components:', Object.keys(this.customComponents));
            console.error('Available libraries:', Object.keys(this.libraries));
            return;
        }

        const gridCoords = this.getGridCoordinates(300, 300);

        const component = {
            id: `comp_${this.nextComponentId++}`,
            library: libraryKey,
            type: componentKey,
            x: gridCoords.x,
            y: gridCoords.y,
            rotation: 0,
            reference: this.generateNextReference(componentDef.reference),
            ...componentDef
        };

        console.log('Created component:', component);
        this.components.push(component);
        this.render();
    }

    generateNextReference(prefix) {
        const existing = this.components.filter(c => c.reference.startsWith(prefix));
        return `${prefix}${existing.length + 1}`;
    }

    snapToGridCoordinate(coord) {
        if (!this.snapToGrid) return coord;
        return Math.round(coord / this.gridSize) * this.gridSize;
    }

    getGridCoordinates(x, y) {
        if (this.snapToGrid) {
            return {
                x: this.snapToGridCoordinate(x),
                y: this.snapToGridCoordinate(y)
            };
        }
        return { x, y };
    }

    renderGrid() {
        if (!this.gridEnabled) return;

        this.ctx.save();

        // Вспомогательные линии
        this.ctx.strokeStyle = '#3a3a3a';
        this.ctx.lineWidth = 0.5;
        this.ctx.setLineDash([2, 2]);

        const scaledGridSize = this.gridSize * this.scale;
        const startX = (this.offsetX % scaledGridSize + scaledGridSize) % scaledGridSize;
        const startY = (this.offsetY % scaledGridSize + scaledGridSize) % scaledGridSize;

        for (let x = startX; x < this.canvas.width; x += scaledGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }



        for (let y = startY; y < this.canvas.height; y += scaledGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Основные линии
        this.ctx.strokeStyle = '#4a4a4a';
        this.ctx.setLineDash([]);
        this.ctx.lineWidth = 1;

        const majorGridSize = scaledGridSize * 5;
        const majorStartX = (this.offsetX % majorGridSize + majorGridSize) % majorGridSize;
        const majorStartY = (this.offsetY % majorGridSize + majorGridSize) % majorGridSize;

        for (let x = majorStartX; x < this.canvas.width; x += majorGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = majorStartY; y < this.canvas.height; y += majorGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    handleKeyDown(e) {
        if (e.key === 'Shift') {
            this.canvas.style.cursor = 'grab';
        } else if (e.key === 'Delete' && this.selectedComponent) {
            this.deleteSelectedComponent();
        } else if (e.key === 'Escape') {
            this.selectedComponent = null;
            this.currentWire = null;
            this.render();
        }
    }

    handleKeyUp(e) {
        if (e.key === 'Shift') {
            this.canvas.style.cursor = this.getCursorForMode();
            this.isPanning = false;
        }
    }

    getCursorForMode() {
        switch(this.mode) {
            case 'select': return 'default';
            case 'wire': return 'crosshair';
            case 'delete': return 'not-allowed';
            default: return 'default';
        }
    }

    deleteSelectedComponent() {
        if (this.selectedComponent) {
            this.components = this.components.filter(c => c !== this.selectedComponent);
            this.wires = this.wires.filter(w =>
                w.start.component !== this.selectedComponent && w.end.component !== this.selectedComponent
            );
            this.selectedComponent = null;
            this.render();
        }
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        let x = (e.clientX - rect.left - this.offsetX) / this.scale;
        let y = (e.clientY - rect.top - this.offsetY) / this.scale;

        const gridCoords = this.getGridCoordinates(x, y);
        x = gridCoords.x;
        y = gridCoords.y;

        if (e.shiftKey) {
            this.isPanning = true;
            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
            return;
        }



        if (this.mode === 'select') {
            this.selectedComponent = this.findComponentAt(x, y);
            if (this.selectedComponent) {
                this.dragging = true;
            }
        } else if (this.mode === 'wire') {
            const pin = this.findPinAt(x, y);
            if (pin) {
                this.currentWire = {
                    start: { component: pin.component, pinIndex: pin.pinIndex },
                    end: { x, y }
                };
            }
        } else if (this.mode === 'delete') {
            const component = this.findComponentAt(x, y);
            const wire = this.findWireAt(x, y); // ✅ добавим проверку провода

            if (component) {
                // Удаляем компонент и все связанные с ним провода
                this.components = this.components.filter(c => c !== component);
                this.wires = this.wires.filter(w =>
                    w.start.component !== component && w.end.component !== component
                );
                this.render();
            } else if (wire) {
                // ✅ Удаляем только провод
                this.wires = this.wires.filter(w => w !== wire);
                this.render();
            }
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        let x = (e.clientX - rect.left - this.offsetX) / this.scale;
        let y = (e.clientY - rect.top - this.offsetY) / this.scale;

        const gridCoords = this.getGridCoordinates(x, y);
        x = gridCoords.x;
        y = gridCoords.y;

        if (this.isPanning) {
            const dx = e.clientX - this.lastPanX;
            const dy = e.clientY - this.lastPanY;

            this.offsetX += dx;
            this.offsetY += dy;

            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;

            this.render();
            return;
        }

        if (this.dragging && this.selectedComponent) {
            this.selectedComponent.x = x;
            this.selectedComponent.y = y;
            this.render();
        } else if (this.currentWire) {
            this.currentWire.end = { x, y };
            this.render();
        }
    }

    handleMouseUp(e) {
        const rect = this.canvas.getBoundingClientRect();
        let x = (e.clientX - rect.left - this.offsetX) / this.scale;
        let y = (e.clientY - rect.top - this.offsetY) / this.scale;

        const gridCoords = this.getGridCoordinates(x, y);
        x = gridCoords.x;
        y = gridCoords.y;

        if (this.mode === 'wire' && this.currentWire) {
            const endPin = this.findPinAt(x, y);
            if (endPin && endPin.component !== this.currentWire.start.component) {
                this.wires.push({
                    start: this.currentWire.start,
                    end: { component: endPin.component, pinIndex: endPin.pinIndex }
                });
            }
            this.currentWire = null;
            this.render();
        }

        this.dragging = false;
        this.isPanning = false;
        this.canvas.style.cursor = this.getCursorForMode();
    }

    handleDoubleClick(e) {
        if (e.shiftKey) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offsetX) / this.scale;
        const y = (e.clientY - rect.top - this.offsetY) / this.scale;

        const component = this.findComponentAt(x, y);
        if (component) {
            this.showComponentProperties(component);
        }
    }

    showComponentProperties(component) {
        const newValue = prompt(`Свойства ${component.reference} (${component.name}):\n\nЗначение:`, component.fields?.Value || '');
        if (newValue !== null && component.fields) {
            component.fields.Value = newValue;
            this.render();
        }
    }

    handleWheel(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;



        const zoomIntensity = 0.1;
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoom = Math.exp(wheel * zoomIntensity);

        const worldMouseX = (mouseX - this.offsetX) / this.scale;
        const worldMouseY = (mouseY - this.offsetY) / this.scale;

        this.scale *= zoom;
        this.scale = Math.max(0.1, Math.min(5, this.scale));

        this.offsetX = mouseX - worldMouseX * this.scale;
        this.offsetY = mouseY - worldMouseY * this.scale;

        this.render();
        this.updateStatusInfo();
    }

    findComponentAt(x, y) {
        for (let i = this.components.length - 1; i >= 0; i--) {
            const comp = this.components[i];
            if (x >= comp.x - 50 && x <= comp.x + 50 &&
                y >= comp.y - 50 && y <= comp.y + 50) {
                return comp;
            }
        }
        return null;
    }

    findPinAt(x, y) {
        for (const comp of this.components) {
            for (let i = 0; i < comp.pins.length; i++) {
                const pin = comp.pins[i];
                const pinX = comp.x + pin.x;
                const pinY = comp.y + pin.y;
                const distance = Math.sqrt((x - pinX) ** 2 + (y - pinY) ** 2);
                if (distance < 8) {
                    return { component: comp, pinIndex: i };
                }
            }
        }
        return null;
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.renderGrid();

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        this.renderWires();
        this.renderComponents();

        this.ctx.restore();
    }

    findWireAt(x, y) {
        const tolerance = 6; // допустимое расстояние до линии для клика
        for (const wire of this.wires) {
            const startPin = this.getPinPosition(wire.start);
            const endPin = this.getPinPosition(wire.end);

            // Расстояние от точки (x,y) до отрезка
            const dist = this.pointToSegmentDistance(x, y, startPin, endPin);
            if (dist < tolerance) {
                return wire;
            }
        }
        return null;
    }

    // Вспомогательная функция для расчета расстояния от точки до отрезка
    pointToSegmentDistance(px, py, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) return Math.hypot(px - p1.x, py - p1.y);

        let t = ((px - p1.x) * dx + (py - p1.y) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));

        const projX = p1.x + t * dx;
        const projY = p1.y + t * dy;

        return Math.hypot(px - projX, py - projY);
    }


    renderWires() {
        this.ctx.strokeStyle = '#3498db';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([]);
        this.ctx.beginPath();

        for (const wire of this.wires) {
            const startPin = this.getPinPosition(wire.start);
            const endPin = this.getPinPosition(wire.end);

            this.ctx.moveTo(startPin.x, startPin.y);
            this.ctx.lineTo(endPin.x, endPin.y);
        }

        if (this.currentWire) {
            const startPin = this.getPinPosition(this.currentWire.start);
            this.ctx.moveTo(startPin.x, startPin.y);
            this.ctx.lineTo(this.currentWire.end.x, this.currentWire.end.y);
        }

        this.ctx.stroke();
    }

    renderComponents() {
        for (const comp of this.components) {
            this.renderComponent(comp);
        }
    }

    renderComponent(comp) {
        this.ctx.save();
        this.ctx.translate(comp.x, comp.y);
        this.ctx.rotate(comp.rotation * Math.PI / 180);

        // Рендерим символ
        this.ctx.strokeStyle = comp === this.selectedComponent ? '#e74c3c' : '#ecf0f1';
        this.ctx.lineWidth = comp === this.selectedComponent ? 2.5 : 1.5;
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = 'transparent';



        try {
            const path = new Path2D(comp.symbol);
            this.ctx.stroke(path);
        } catch (e) {
            console.error('Error rendering symbol:', e);
        }

        // Рендерим пины
        this.ctx.fillStyle = comp === this.selectedComponent ? '#e74c3c' : '#3498db';
        for (const pin of comp.pins) {
            this.ctx.beginPath();
            this.ctx.arc(pin.x, pin.y, 2, 0, 2 * Math.PI);
            this.ctx.fill();

            // Подписи пинов
            if (pin.name) {
                this.ctx.fillStyle = '#95a5a6';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(pin.name, pin.x, pin.y - 8);
            }
        }

        // ПРОСТОЙ И РАБОЧИЙ СПОСОБ:
        // Находим минимальную и максимальную Y-координаты среди всех пинов
        let minY = 0;
        let maxY = 0;

        if (comp.pins && comp.pins.length > 0) {
            const pinYs = comp.pins.map(pin => pin.y);
            minY = Math.min(...pinYs);
            maxY = Math.max(...pinYs);
        } else {
            // Если пинов нет, используем стандартные отступы
            minY = -20;
            maxY = 20;
        }

        // Референс (обозначение) - выше самого верхнего пина
        // Подписи в центре символа
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Reference (например U1) — чуть выше центра
        this.ctx.fillStyle = comp === this.selectedComponent ? '#e74c3c' : '#bdc3c7';
        this.ctx.font = '11px Arial';
        this.ctx.fillText(comp.reference, 0, -10);

        // Название — чуть ниже центра
        this.ctx.fillStyle = '#ecf0f1';
        this.ctx.font = '10px Arial';
        this.ctx.fillText(comp.fields?.Value || comp.name, 0, 10);

        this.ctx.restore();
    }

    getPinPosition(pinRef) {
        if (pinRef.component && pinRef.pinIndex !== undefined) {
            const comp = pinRef.component;
            const pin = comp.pins[pinRef.pinIndex];
            return {
                x: comp.x + pin.x,
                y: comp.y + pin.y
            };
        }
        return pinRef;
    }

    updateStatusInfo() {
        const modeNames = {
            'select': 'Выбор',
            'wire': 'Провод',
            'delete': 'Удаление'
        };

        const status = `Масштаб: ${Math.round(this.scale * 100)}% | Сетка: ${this.gridSize}px | Привязка: ${this.snapToGrid ? 'Вкл' : 'Выкл'} | Режим: ${modeNames[this.mode]}`;
        this.statusInfo.textContent = status;
    }

    toggleGrid() {
        this.gridEnabled = !this.gridEnabled;
        this.render();
    }

    toggleSnap() {
        this.snapToGrid = !this.snapToGrid;
        this.updateStatusInfo();
        this.render();
    }

    changeGridSize(size) {
        this.gridSize = parseInt(size);
        this.updateStatusInfo();
        this.render();
    }

    async saveSchema() {
        const schema = {
            id: 'current',
            components: this.components,
            wires: this.wires,
            view: {
                scale: this.scale,
                offsetX: this.offsetX,
                offsetY: this.offsetY
            }
        };

        try {
            const response = await fetch('/api/save_schema', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(schema)
            });

            if (response.ok) {
                alert('✅ Схема успешно сохранена!');
            }
        } catch (error) {
            alert('❌ Ошибка при сохранении схемы');
        }
    }

    async loadSchema() {
        try {
            const response = await fetch('/api/load_schema/current');
            const schema = await response.json();

            this.components = schema.components || [];
            this.wires = schema.wires || [];



            // ✅ Восстанавливаем связи проводов с реальными компонентами
            const componentMap = new Map(this.components.map(c => [c.id, c]));

            this.wires.forEach(wire => {
                if (wire.start?.component?.id) {
                    wire.start.component = componentMap.get(wire.start.component.id) || null;
                }
                if (wire.end?.component?.id) {
                    wire.end.component = componentMap.get(wire.end.component.id) || null;
                }
            });

            // ✅ Восстанавливаем состояние просмотра
            if (schema.view) {
                this.scale = schema.view.scale || 1.0;
                this.offsetX = schema.view.offsetX || 0;
                this.offsetY = schema.view.offsetY || 0;
            }

            // Обновляем ID для новых компонентов
            this.nextComponentId = this.components.length + 1;

            // ✅ Перерисовываем и обновляем интерфейс
            this.selectedComponent = null;
            this.render();
            this.updateStatusInfo();

            alert('✅ Схема успешно загружена!');
        } catch (error) {
            console.error('Ошибка загрузки схемы:', error);
            alert('❌ Ошибка при загрузке схемы');
        }
    }

    clearSchema() {
        if (confirm('Вы уверены, что хотите очистить схему?')) {
            this.components = [];
            this.wires = [];
            this.selectedComponent = null;
            this.scale = 1.0;
            this.offsetX = 0;
            this.offsetY = 0;
            this.nextComponentId = 1;
            this.render();
            this.updateStatusInfo();
        }
    }

    changeMode(newMode) {
        this.mode = newMode;
        this.currentWire = null;
        this.dragging = false;
        this.canvas.style.cursor = this.getCursorForMode();
        this.updateStatusInfo();
    }

    async saveCustomComponent(componentData) {
        try {
            const response = await fetch('/api/save_component', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(componentData)
            });

            if (response.ok) {
                const result = await response.json();
                await this.loadLibraries();
                return result;
            }
        } catch (error) {
            console.error('Ошибка сохранения компонента:', error);
        }
        return null;
    }

    async deleteCustomComponent(componentId) {
        if (confirm('Удалить этот компонент?')) {
            try {
                const response = await fetch(`/api/delete_component/${componentId}`);
                if (response.ok) {
                    await this.loadLibraries();
                }
            } catch (error) {
                console.error('Ошибка удаления компонента:', error);
            }
        }
    }
}

// Класс для графического редактора символов
// ---------- Замените текущий класс SymbolEditor на этот блок ----------
class SymbolEditor {
    constructor() {
        this.canvas = document.getElementById('symbolCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.previewCanvas = document.getElementById('previewCanvas');
        this.previewCtx = this.previewCanvas.getContext('2d');

        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        this.elements = []; // элементы (линии/прямоуг/круг) - координаты ОТНОСИТЕЛЬНО центра
        this.pins = [];     // пины - координаты ОТНОСИТЕЛЬНО центра
        this.currentTool = 'line';
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.currentElement = null;
        this.selectedElement = null;

        this.color = '#3498db';
        this.lineWidth = 2;

        this.history = [];
        this.historyIndex = -1;

        // Настройки сетки для редактора
        this.gridSize = 20;
        this.snapToGrid = true;

        this.setupEventListeners();
        this.render();
    }



    handleKeyDown(e) {
        // Ctrl + Z → Undo
        if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
        }
        // Ctrl + Shift + Z → Redo
        else if (e.ctrlKey && e.key.toLowerCase() === 'z' && e.shiftKey) {
            e.preventDefault();
            this.redo();
        }
        // Ctrl + Y → Redo (альтернатива)
        else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            this.redo();
        }
    }


    // вспомогательная: центр канваса
    getCenter() {
        return {
            cx: Math.floor(this.canvas.width / 2),
            cy: Math.floor(this.canvas.height / 2)
        };
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));

        document.getElementById('colorPicker').addEventListener('change', (e) => {
            this.color = e.target.value;
        });

        document.getElementById('lineWidth').addEventListener('change', (e) => {
            this.lineWidth = parseInt(e.target.value);
        });
    }

    snapToGridCoordinate(coord) {
        if (!this.snapToGrid) return coord;
        return Math.round(coord / this.gridSize) * this.gridSize;
    }

    // Преобразуем экранные координаты в координаты с центром (0,0 в центре canvas)
    screenToCenterCoords(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const { cx, cy } = this.getCenter();
        let x = clientX - rect.left - cx;
        let y = clientY - rect.top - cy;

        if (this.snapToGrid) {
            x = this.snapToGridCoordinate(x);
            y = this.snapToGridCoordinate(y);
        }

        return { x, y };
    }

    // И обратно для рендер-предпросмотра или других нужд
    centerToScreenCoords(x, y) {
        const { cx, cy } = this.getCenter();
        return { sx: x + cx, sy: y + cy };
    }

    handleMouseDown(e) {
        const { x, y } = this.screenToCenterCoords(e.clientX, e.clientY);

        this.isDrawing = true;
        this.startX = x;
        this.startY = y;

        if (this.currentTool === 'pin') {
            this.addPin(x, y);
        } else if (this.currentTool === 'select') {
            this.selectedElement = this.findElementAt(x, y);
        } else {
            this.currentElement = {
                type: this.currentTool,
                points: [{ x, y }],
                color: this.color,
                lineWidth: this.lineWidth
            };
        }
    }

    handleMouseMove(e) {
        if (!this.isDrawing) return;

        const { x, y } = this.screenToCenterCoords(e.clientX, e.clientY);

        if (this.currentTool === 'select' && this.selectedElement) {
            const dx = x - this.startX;
            const dy = y - this.startY;



            // перемещаем все точки выбранного элемента
            if (this.selectedElement.points && this.selectedElement.points.length) {
                for (let p of this.selectedElement.points) {
                    p.x += dx;
                    p.y += dy;
                }
            }
            this.startX = x;
            this.startY = y;
            this.render();
            this.saveToHistory();

        } else if (this.currentElement) {
            if (this.currentTool === 'line') {
                const dx = Math.abs(x - this.startX);
                const dy = Math.abs(y - this.startY);
                if (dx > dy) {
                    // горизонтальная
                    this.currentElement.points[1] = { x: x, y: this.startX === undefined ? this.startY : this.startY };
                    // Note: startY already set
                    this.currentElement.points[1].y = this.startY;
                } else {
                    // вертикальная
                    this.currentElement.points[1] = { x: this.startX, y: y };
                }
            } else if (this.currentTool === 'rectangle') {
                this.currentElement.points[1] = { x, y };
            } else if (this.currentTool === 'circle') {
                const r = Math.sqrt(Math.pow(x - this.startX, 2) + Math.pow(y - this.startY, 2));
                this.currentElement.radius = r;
            }
            this.render();
        }
    }

    handleMouseUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.currentElement && this.currentTool !== 'select' && this.currentTool !== 'pin') {
            if (this.currentTool === 'line' && this.currentElement.points[1]) {
                const p1 = this.currentElement.points[0];
                const p2 = this.currentElement.points[1];
                const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                if (distance < 5) {
                    this.currentElement = null;
                    this.render();
                    return;
                }
            }

            this.saveToHistory();
            this.elements.push(this.currentElement);
            this.currentElement = null;
            this.updateSVGPath();
            this.renderPreview();
            this.saveToHistory();
        }
    }

    addPin(x, y) {
        const pinNumber = this.pins.length + 1;
        this.pins.push({
            x: x,
            y: y,
            number: pinNumber.toString(),
            name: `Pin${pinNumber}`
        });

        this.saveToHistory();
        this.updatePinsList();
        this.render();
        this.renderPreview();
    }

    updatePinsList() {
        const container = document.getElementById('pinsContainer');
        container.innerHTML = '';

        this.pins.forEach((pin, index) => {
            const pinDiv = document.createElement('div');
            pinDiv.className = 'pin-item';
            pinDiv.innerHTML = `
                <div class="pin-info">
                    Pin ${pin.number}: (${pin.x}, ${pin.y}) - ${pin.name}
                </div>
                <div class="pin-actions">
                    <button class="pin-action" onclick="symbolEditor.editPin(${index})">✏️</button>
                    <button class="pin-action" onclick="symbolEditor.deletePin(${index})">🗑</button>
                </div>
            `;
            container.appendChild(pinDiv);
        });
    }

    editPin(index) {
        const pin = this.pins[index];
        const newName = prompt('Введите имя пина:', pin.name);
        if (newName !== null) {
            pin.name = newName;
            this.updatePinsList();
            this.renderPreview();
        }
    }

    deletePin(index) {
        this.pins.splice(index, 1);
        this.saveToHistory();
        this.updatePinsList();
        this.render();
        this.renderPreview();
    }



    findElementAt(x, y) {
        for (let i = this.elements.length - 1; i >= 0; i--) {
            const element = this.elements[i];
            if (this.isPointInElement(x, y, element)) {
                return element;
            }
        }
        return null;
    }

    isPointInElement(x, y, element) {
        if (element.type === 'line' && element.points[1]) {
            const p1 = element.points[0];
            const p2 = element.points[1];
            if (p1.y === p2.y) {
                const minX = Math.min(p1.x, p2.x);
                const maxX = Math.max(p1.x, p2.x);
                return x >= minX - 5 && x <= maxX + 5 && Math.abs(y - p1.y) < 5;
            } else if (p1.x === p2.x) {
                const minY = Math.min(p1.y, p2.y);
                const maxY = Math.max(p1.y, p2.y);
                return Math.abs(x - p1.x) < 5 && y >= minY - 5 && y <= maxY + 5;
            }
        }
        return false;
    }

    render() {
        // очистка
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Сохраняем и переводим систему координат в центр
        const { cx, cy } = this.getCenter();
        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Сетка и оси (рисуются с учетом центра)
        this.renderGrid();

        // Рендерим элементы
        this.elements.forEach(element => {
            this.renderElement(element);
        });

        // Текущий элемент (во время рисования)
        if (this.currentElement) {
            this.renderElement(this.currentElement);
        }

        // Рендерим пины
        this.renderPins();

        // Подсвечиваем выбранный элемент (если есть)
        if (this.selectedElement) {
            this.ctx.strokeStyle = '#e74c3c';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.renderElement(this.selectedElement);
            this.ctx.setLineDash([]);
        }

        // Подсказка для линий
        if (this.isDrawing && this.currentTool === 'line' && this.currentElement && this.currentElement.points[1]) {
            this.renderLineHelper();
        }

        this.ctx.restore();
    }

    renderGrid() {
        const { cx, cy } = this.getCenter();

        // Серая сетка (перебираем от -cx до +cx и -cy до +cy)
        this.ctx.strokeStyle = '#3a3a3a';
        this.ctx.lineWidth = 0.5;

        for (let x = -cx; x <= cx; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, -cy);
            this.ctx.lineTo(x, cy);
            this.ctx.stroke();
        }

        for (let y = -cy; y <= cy; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(-cx, y);
            this.ctx.lineTo(cx, y);
            this.ctx.stroke();
        }

        // Главные линии сетки
        this.ctx.strokeStyle = '#4a4a4a';
        this.ctx.lineWidth = 1;
        const majorGridSize = this.gridSize * 5;

        for (let x = -cx; x <= cx; x += majorGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, -cy);
            this.ctx.lineTo(x, cy);
            this.ctx.stroke();
        }

        for (let y = -cy; y <= cy; y += majorGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(-cx, y);
            this.ctx.lineTo(cx, y);
            this.ctx.stroke();
        }

        // Оси координат (красные)
        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 2;

        // X
        this.ctx.beginPath();
        this.ctx.moveTo(-cx, 0);
        this.ctx.lineTo(cx, 0);
        this.ctx.stroke();

        // Y
        this.ctx.beginPath();
        this.ctx.moveTo(0, -cy);
        this.ctx.lineTo(0, cy);
        this.ctx.stroke();

        // Подпись центра
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('0,0', 5, -5);
    }



    renderElement(element) {
        this.ctx.strokeStyle = element.color;
        this.ctx.lineWidth = element.lineWidth;
        this.ctx.fillStyle = 'transparent';

        switch (element.type) {
            case 'line':
                if (element.points[1]) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(element.points[0].x, element.points[0].y);
                    this.ctx.lineTo(element.points[1].x, element.points[1].y);
                    this.ctx.stroke();
                }
                break;

            case 'rectangle':
                if (element.points[1]) {
                    const x = element.points[0].x;
                    const y = element.points[0].y;
                    const width = element.points[1].x - x;
                    const height = element.points[1].y - y;
                    this.ctx.strokeRect(x, y, width, height);
                }
                break;

            case 'circle':
                if (element.radius) {
                    this.ctx.beginPath();
                    this.ctx.arc(element.points[0].x, element.points[0].y, element.radius, 0, 2 * Math.PI);
                    this.ctx.stroke();
                }
                break;
        }
    }

    renderLineHelper() {
        const p1 = this.currentElement.points[0];
        const p2 = this.currentElement.points[1];

        this.ctx.strokeStyle = '#95a5a6';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);

        if (p1.y === p2.y) {
            this.ctx.beginPath();
            this.ctx.moveTo(p1.x, -this.canvas.height);
            this.ctx.lineTo(p1.x, this.canvas.height);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(p2.x, -this.canvas.height);
            this.ctx.lineTo(p2.x, this.canvas.height);
            this.ctx.stroke();

            this.ctx.fillStyle = '#ecf0f1';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'left';
            const length = Math.abs(p2.x - p1.x);
            this.ctx.fillText(`Горизонтальная: ${length}px`, -this.canvas.width / 2 + 10, -this.canvas.height / 2 + 20);
        } else {
            this.ctx.beginPath();
            this.ctx.moveTo(-this.canvas.width, p1.y);
            this.ctx.lineTo(this.canvas.width, p1.y);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(-this.canvas.width, p2.y);
            this.ctx.lineTo(this.canvas.width, p2.y);
            this.ctx.stroke();

            this.ctx.fillStyle = '#ecf0f1';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'left';
            const length = Math.abs(p2.y - p1.y);
            this.ctx.fillText(`Вертикальная: ${length}px`, -this.canvas.width / 2 + 10, -this.canvas.height / 2 + 20);
        }

        this.ctx.setLineDash([]);
    }

    renderPins() {
        this.pins.forEach(pin => {
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.beginPath();
            this.ctx.arc(pin.x, pin.y, 4, 0, 2 * Math.PI);
            this.ctx.fill();

            this.ctx.fillStyle = '#ecf0f1';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(pin.number, pin.x, pin.y - 10);
        });
    }

    renderPreview() {
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);

        this.previewCtx.save();
        this.previewCtx.translate(this.previewCanvas.width / 2, this.previewCanvas.height / 2);

        // рисуем элементы с теми же координатами, но масштабируем если нужно
        // простой вариант — отобразить как есть
        this.elements.forEach(element => {
            this.previewCtx.strokeStyle = element.color;
            this.previewCtx.lineWidth = element.lineWidth;



            switch (element.type) {
                case 'line':
                    if (element.points[1]) {
                        this.previewCtx.beginPath();
                        this.previewCtx.moveTo(element.points[0].x, element.points[0].y);
                        this.previewCtx.lineTo(element.points[1].x, element.points[1].y);
                        this.previewCtx.stroke();
                    }
                    break;

                case 'rectangle':
                    if (element.points[1]) {
                        const x = element.points[0].x;
                        const y = element.points[0].y;
                        const width = element.points[1].x - x;
                        const height = element.points[1].y - y;
                        this.previewCtx.strokeRect(x, y, width, height);
                    }
                    break;

                case 'circle':
                    if (element.radius) {
                        this.previewCtx.beginPath();
                        this.previewCtx.arc(element.points[0].x, element.points[0].y, element.radius, 0, 2 * Math.PI);
                        this.previewCtx.stroke();
                    }
                    break;
            }
        });

        // пины
        this.pins.forEach(pin => {
            this.previewCtx.fillStyle = '#e74c3c';
            this.previewCtx.beginPath();
            this.previewCtx.arc(pin.x, pin.y, 3, 0, 2 * Math.PI);
            this.previewCtx.fill();
        });

        this.previewCtx.restore();
    }

    updateSVGPath() {
        let svgPath = '';

        this.elements.forEach(element => {
            switch (element.type) {
                case 'line':
                    if (element.points[1]) {
                        const p1 = element.points[0];
                        const p2 = element.points[1];
                        // используем координаты относительно центра
                        svgPath += `M ${p1.x},${p1.y} L ${p2.x},${p2.y} `;
                    }
                    break;

                case 'rectangle':
                    if (element.points[1]) {
                        const p1 = element.points[0];
                        const p2 = element.points[1];
                        svgPath += `M ${p1.x},${p1.y} L ${p2.x},${p1.y} L ${p2.x},${p2.y} L ${p1.x},${p2.y} Z `;
                    }
                    break;

                case 'circle':
                    if (element.radius) {
                        const c = element.points[0];
                        const r = element.radius;
                        svgPath += `M ${c.x - r},${c.y} A ${r},${r} 0 1,1 ${c.x + r},${c.y} A ${r},${r} 0 1,1 ${c.x - r},${c.y} `;
                    }
                    break;
            }
        });

        document.getElementById('svgPath').value = svgPath.trim();
    }

    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`tool-${tool}`).classList.add('active');
        this.selectedElement = null;
        this.render();

        const hint = document.getElementById('editorHint');
        if (tool === 'line') {
            hint.textContent = '📏 Линии рисуются только горизонтально или вертикально';
        } else if (tool === 'rectangle') {
            hint.textContent = '⬜️ Рисуйте прямоугольники для контуров компонентов';
        } else if (tool === 'circle') {
            hint.textContent = '⭕️ Рисуйте круги для специальных элементов';
        } else if (tool === 'pin') {
            hint.textContent = '📌 Добавляйте пины для подключения проводов';
        } else if (tool === 'select') {
            hint.textContent = '🔍 Выделяйте и перемещайте элементы';
        }
    }



    clearSymbol() {
        if (confirm('Очистить весь символ?')) {
            this.saveToHistory();
            this.elements = [];
            this.pins = [];
            this.updatePinsList();
            this.updateSVGPath();
            this.render();
            this.renderPreview();
        }
    }

    saveToHistory() {
        // Сравниваем с последним состоянием, чтобы не дублировать
        const current = {
            elements: JSON.stringify(this.elements),
            pins: JSON.stringify(this.pins)
        };

        const last = this.history[this.historyIndex];
        if (last && last.elements === current.elements && last.pins === current.pins) {
            return; // состояние не изменилось — не добавляем
        }

        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push({
            elements: JSON.parse(current.elements),
            pins: JSON.parse(current.pins)
        });
        this.historyIndex++;
    }


    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.elements = JSON.parse(JSON.stringify(state.elements));
            this.pins = JSON.parse(JSON.stringify(state.pins));
            this.updatePinsList();
            this.updateSVGPath();
            this.render();
            this.renderPreview();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.elements = JSON.parse(JSON.stringify(state.elements));
            this.pins = JSON.parse(JSON.stringify(state.pins));
            this.updatePinsList();
            this.updateSVGPath();
            this.render();
            this.renderPreview();
        }
    }

    getComponentData() {
        const name = document.getElementById('compName').value;
        const reference = document.getElementById('compReference').value;

        if (!name || !reference) {
            alert('Введите название и префикс компонента');
            return null;
        }

        if (this.pins.length === 0) {
            alert('Добавьте хотя бы один пин');
            return null;
        }

        return {
            name: name,
            reference: reference,
            symbol: document.getElementById('svgPath').value,
            pins: this.pins,
            footprint: '',
            fields: {
                Value: name,
                Footprint: '',
                Datasheet: '~'
            }
        };
    }
}
// ---------- конец класса SymbolEditor ----------


let editor;
let symbolEditor;

document.addEventListener('DOMContentLoaded', () => {
    editor = new KiCadWebEditor();
});

// Глобальные функции для основного редактора
function toggleGrid() {
    editor.toggleGrid();
}

function toggleSnap() {
    editor.toggleSnap();
}

function changeGridSize(size) {
    editor.changeGridSize(size);
}

function saveSchema() {
    editor.saveSchema();
}

function loadSchema() {
    editor.loadSchema();
}

function clearSchema() {
    editor.clearSchema();
}

function changeMode(mode) {
    editor.changeMode(mode);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`.tab:nth-child(${tabName === 'libraries' ? 1 : 2})`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Функции для графического редактора
function showSymbolEditor() {
    document.getElementById('symbolEditorModal').style.display = 'block';
    if (!symbolEditor) {
        symbolEditor = new SymbolEditor();
    } else {
        symbolEditor.render();
        symbolEditor.renderPreview();
    }
}

function closeSymbolEditor() {
    document.getElementById('symbolEditorModal').style.display = 'none';
}



function setTool(tool) {
    symbolEditor.setTool(tool);
}

function undo() {
    symbolEditor.undo();
}

function redo() {
    symbolEditor.redo();
}

function clearSymbol() {
    symbolEditor.clearSymbol();
}

function addPinManually() {
    const x = parseInt(prompt('X координата пина:', '100')) || 100;
    const y = parseInt(prompt('Y координата пина:', '100')) || 100;
    symbolEditor.addPin(x, y);
}

async function saveSymbolComponent() {
    const componentData = symbolEditor.getComponentData();
    if (!componentData) return;

    // Генерируем уникальный ID для компонента
    componentData.id = `custom_${Date.now()}`;

    console.log('Saving component:', componentData); // Для отладки

    const result = await editor.saveCustomComponent(componentData);
    if (result) {
        closeSymbolEditor();
        alert('✅ Компонент успешно создан!');

        // Перезагружаем библиотеки чтобы обновить список
        await editor.loadLibraries();

        // Сбрасываем редактор
        symbolEditor.elements = [];
        symbolEditor.pins = [];
        symbolEditor.updatePinsList();
        symbolEditor.updateSVGPath();
        symbolEditor.render();
        symbolEditor.renderPreview();
        document.getElementById('compName').value = '';
        document.getElementById('compReference').value = 'U';
    } else {
        alert('❌ Ошибка при создании компонента');
    }
}

function deleteCustomComponent(componentId) {
    editor.deleteCustomComponent(componentId);
}

function toggleEditorSnap() {
    if (symbolEditor) {
        symbolEditor.snapToGrid = !symbolEditor.snapToGrid;
        symbolEditor.render();
    }
}

// Закрытие модальных окон при клике вне их
window.addEventListener('click', (event) => {
    const modal = document.getElementById('symbolEditorModal');
    if (event.target === modal) {
        closeSymbolEditor();
    }
});