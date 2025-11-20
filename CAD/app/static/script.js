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

        // Новые свойства для сетки размещения
        this.placementGrid = [];
        this.showPlacementGrid = false;
        this.baseGridSize = 50; // Размер одной позиции в пикселях
        this.componentGridPositions = new Map(); // Хранит размеры в позициях

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
        componentDef = this.customComponents[componentKey];
    } else {
        const library = this.libraries[libraryKey];
        if (library && library.components) {
            componentDef = library.components[componentKey];
        }
    }

    if (!componentDef) {
        console.error('Component not found:', componentKey, 'in library:', libraryKey);
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

    // Если у компонента нет размеров, вычисляем их приблизительно
    if (!component.dimensions) {
        component.dimensions = this.estimateComponentDimensions(component);
    }

    console.log('Created component:', component);
    this.components.push(component);
    this.render();
}

// Оценочный расчет размеров для стандартных компонентов
estimateComponentDimensions(component) {
    // Более точные размеры для лучшего размещения
    const baseSizes = {
        'resistor': { width: 80, height: 30 },
        'capacitor': { width: 60, height: 40 },
        'capacitor_polarized': { width: 60, height: 50 },
        'diode': { width: 70, height: 40 },
        'led': { width: 50, height: 50 },
        'transistor_npn': { width: 80, height: 100 },
        'transistor_pnp': { width: 80, height: 100 },
        'vcc': { width: 40, height: 50 },
        'gnd': { width: 40, height: 50 }
    };

    const baseSize = baseSizes[component.type] || { width: 60, height: 60 };

    // Учитываем пины для более точного расчета
    if (component.pins && component.pins.length > 0) {
        let minX = 0, maxX = 0, minY = 0, maxY = 0;
        component.pins.forEach(pin => {
            minX = Math.min(minX, pin.x);
            maxX = Math.max(maxX, pin.x);
            minY = Math.min(minY, pin.y);
            maxY = Math.max(maxY, pin.y);
        });

        return {
            width: Math.max(baseSize.width, maxX - minX + 40),
            height: Math.max(baseSize.height, maxY - minY + 40)
        };
    }

    return baseSize;
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

        // Рендерим символ (уже с учетом вращения)
        this.ctx.strokeStyle = comp === this.selectedComponent ? '#e74c3c' : '#ecf0f1';
        this.ctx.lineWidth = comp === this.selectedComponent ? 2.5 : 1.5;

        try {
            const path = new Path2D(comp.symbol);
            this.ctx.stroke(path);
        } catch (e) {
            console.error('Error rendering symbol:', e);
        }

        // Рендерим пины (уже с правильными позициями после вращения)
        this.ctx.fillStyle = comp === this.selectedComponent ? '#e74c3c' : '#3498db';
        comp.pins.forEach((pin, index) => {
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
        });

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

            // Учитываем вращение компонента
            const orientation = comp.rotation || 0;
            const radians = orientation * Math.PI / 180;
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);

            // Вращаем координаты пина
            const rotatedX = pin.x * cos - pin.y * sin;
            const rotatedY = pin.x * sin + pin.y * cos;

            return {
                x: comp.x + rotatedX,
                y: comp.y + rotatedY
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

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.renderGrid();

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        this.renderWires();
        this.renderComponents();

        this.ctx.restore();

        // Рендерим сетку поверх всего
        this.renderPlacementGrid();
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

    // Основной метод оптимизации размещения
optimizePlacement() {
    if (this.placementGrid.length === 0) {
        alert('Сначала создайте сетку позиций');
        return;
    }

    console.log('=== ЗАПУСК ПОСЛЕДОВАТЕЛЬНОГО АЛГОРИТМА РАЗМЕЩЕНИЯ ===');

    // Замер времени выполнения
    const startTime = performance.now();

    // Запускаем последовательный алгоритм
    this.improvedSequentialPlacement();

    const endTime = performance.now();
    const executionTime = (endTime - startTime) / 1000;

    console.log(`Алгоритм выполнен за ${executionTime.toFixed(2)} секунд`);

    // Показываем результаты
    this.showPlacementResults();
}

// Показать результаты размещения
showPlacementResults() {
    const placedComponents = this.components.filter(comp => this.isComponentPlaced(comp));
    const unplacedComponents = this.getUnplacedComponents();
    const totalConnections = this.calculateTotalConnections();
    const totalWireLength = this.estimateTotalWireLength();

    let results = `Результаты размещения:\n\n`;
    results += `Размещено компонентов: ${placedComponents.length}/${this.components.length}\n`;
    results += `Общее количество связей: ${totalConnections}\n`;
    results += `Оценочная длина соединений: ${totalWireLength.toFixed(1)} усл.ед.\n\n`;

    if (unplacedComponents.length > 0) {
        results += `Не размещены:\n`;
        unplacedComponents.forEach(comp => {
            results += `• ${comp.name}\n`;
        });
    }

    alert(results);
}

// Расчет общей длины соединений (оценочно)
estimateTotalWireLength() {
    let totalLength = 0;
    const connectionMatrix = this.buildConnectionMatrix();

    for (let i = 0; i < this.components.length; i++) {
        for (let j = i + 1; j < this.components.length; j++) {
            const comp1 = this.components[i];
            const comp2 = this.components[j];
            const weight = connectionMatrix[comp1.id]?.[comp2.id] || 0;

            if (weight > 0 && this.isComponentPlaced(comp1) && this.isComponentPlaced(comp2)) {
                const pos1 = this.findComponentPosition(comp1);
                const pos2 = this.findComponentPosition(comp2);
                if (pos1 && pos2) {
                    const distance = this.calculateManhattanDistance(pos1, pos2);
                    totalLength += weight * distance;
                }
            }
        }
    }

    return totalLength;
}

// Расчет общего количества связей
calculateTotalConnections() {
    const connectionMatrix = this.buildConnectionMatrix();
    let total = 0;

    this.components.forEach(comp1 => {
        this.components.forEach(comp2 => {
            if (comp1.id !== comp2.id) {
                total += connectionMatrix[comp1.id]?.[comp2.id] || 0;
            }
        });
    });

    return total / 2; // Каждая связь учтена дважды
}

    // Построение матрицы связей
    buildConnectionMatrix() {
        const matrix = {};
        const compIds = this.components.map(c => c.id);

        // Инициализация матрицы
        compIds.forEach(id1 => {
            matrix[id1] = {};
            compIds.forEach(id2 => {
                matrix[id1][id2] = 0;
            });
        });

        // Заполнение матрицы на основе проводов
        this.wires.forEach(wire => {
            const startComp = wire.start.component;
            const endComp = wire.end.component;

            if (startComp && endComp && startComp.id !== endComp.id) {
                matrix[startComp.id][endComp.id]++;
                matrix[endComp.id][startComp.id]++;
            }
        });

        return matrix;
    }

    // Сортировка компонентов по количеству связей (в порядке убывания)
    sortComponentsByConnections(connectionMatrix) {
        return this.components.slice().sort((a, b) => {
            const connectionsA = this.getTotalConnections(a.id, connectionMatrix);
            const connectionsB = this.getTotalConnections(b.id, connectionMatrix);
            return connectionsB - connectionsA;
        });
    }

    // Получение общего количества связей компонента
    getTotalConnections(compId, connectionMatrix) {
        return Object.values(connectionMatrix[compId] || {}).reduce((sum, count) => sum + count, 0);
    }

    sequentialPlacement(sortedComponents, connectionMatrix) {
        // Очищаем сетку
        this.clearGrid();

        // Размещаем компоненты в порядке убывания связей
        for (const component of sortedComponents) {
            const bestPosition = this.findBestPositionForLargeComponent(component, connectionMatrix);
            if (bestPosition) {
                this.placeComponent(component, bestPosition);
            } else {
                console.warn(`Не удалось разместить компонент: ${component.name}`);
                // Размещаем в первой доступной позиции
                const anyPosition = this.findAnyFreePositionForComponent(component); // Используем переименованный метод
                if (anyPosition) {
                    this.placeComponent(component, anyPosition);
                }
            }
        }
    }

    // Поиск лучшей позиции для большого компонента
    findBestPositionForLargeComponent(component, connectionMatrix) {
        let bestScore = -Infinity;
        let bestPosition = null;
        const compConfig = this.componentGridPositions.get(component);

        // Перебираем все возможные стартовые позиции
        for (const position of this.placementGrid) {
            if (this.canPlaceComponent(component, position)) {
                const score = this.calculatePlacementScoreForLargeComponent(
                    component, position, connectionMatrix, compConfig
                );

                if (score > bestScore) {
                    bestScore = score;
                    bestPosition = position;
                }
            }
        }

        return bestPosition;
    }

    // Расчет оценки позиции для большого компонента
    calculatePlacementScoreForLargeComponent(component, position, connectionMatrix, compConfig) {
        let score = 0;

        // Учитываем связи с уже размещенными компонентами
        this.components.forEach(otherComp => {
            if (otherComp !== component && this.isComponentPlaced(otherComp)) {
                const connectionWeight = connectionMatrix[component.id][otherComp.id] || 0;
                if (connectionWeight > 0) {
                    const distance = this.calculateCenterToCenterDistance(component, position, otherComp, compConfig);
                    score += connectionWeight / (distance + 1);
                }
            }
        });

        // Штраф за близость к краю (для больших компонентов это важно)
        const edgePenalty = this.calculateEdgePenalty(position, compConfig);
        score -= edgePenalty;

        // Бонус за компактность размещения
        const compactnessBonus = this.calculateCompactnessBonus(position, connectionMatrix, component);
        score += compactnessBonus;

        return score;
    }

    // Расчет расстояния между центрами компонентов
    calculateCenterToCenterDistance(comp1, position1, comp2, comp1Config) {
        const pos2 = this.findComponentPosition(comp2);
        if (!pos2) return Infinity;

        const comp2Config = this.componentGridPositions.get(comp2);
        if (!comp2Config) return Infinity;

        // Центр первого компонента
        const center1 = {
            col: position1.col + comp1Config.width / 2,
            row: position1.row + comp1Config.height / 2
        };

        // Центр второго компонента
        const center2 = {
            col: pos2.col + comp2Config.width / 2,
            row: pos2.row + comp2Config.height / 2
        };

        // Евклидово расстояние между центрами
        return Math.sqrt(
            Math.pow(center1.col - center2.col, 2) +
            Math.pow(center1.row - center2.row, 2)
        );
    }

    // Штраф за близость к краю (для больших компонентов)
    calculateEdgePenalty(position, compConfig) {
        const gridCols = this.getGridColumns();
        const gridRows = this.getGridRows();

        const distanceToLeft = position.col;
        const distanceToRight = gridCols - (position.col + compConfig.width);
        const distanceToTop = position.row;
        const distanceToBottom = gridRows - (position.row + compConfig.height);

        const minDistanceToEdge = Math.min(
            distanceToLeft, distanceToRight, distanceToTop, distanceToBottom
        );

        // Больший штраф за близость к краю для больших компонентов
        return (compConfig.area * 0.1) / (minDistanceToEdge + 1);
    }

    // Бонус за компактность (размещение рядом с связанными компонентами)
    calculateCompactnessBonus(position, connectionMatrix, component) {
        let bonus = 0;
        const compConfig = this.componentGridPositions.get(component);

        this.components.forEach(otherComp => {
            if (otherComp !== component && this.isComponentPlaced(otherComp)) {
                const connectionWeight = connectionMatrix[component.id][otherComp.id] || 0;
                if (connectionWeight > 0) {
                    const otherPos = this.findComponentPosition(otherComp);
                    const otherConfig = this.componentGridPositions.get(otherComp);

                    if (otherPos && otherConfig) {
                        const distance = this.calculateCenterToCenterDistance(
                            component, position, otherComp, compConfig
                        );

                        // Бонус за близкое размещение
                        if (distance < 3) {
                            bonus += connectionWeight * 2;
                        } else if (distance < 6) {
                            bonus += connectionWeight;
                        }
                    }
                }
            }
        });

        return bonus;
    }

    // Генерация позиций для поиска по спирали от центра
    generateSpiralSearchOrder() {
        const centerCol = Math.floor(this.getGridColumns() / 2);
        const centerRow = Math.floor(this.getGridRows() / 2);

        const positions = [];
        const maxRadius = Math.max(this.getGridColumns(), this.getGridRows());

        for (let radius = 0; radius < maxRadius; radius++) {
            for (let angle = 0; angle < 360; angle += 45) {
                const rad = angle * Math.PI / 180;
                const col = Math.round(centerCol + radius * Math.cos(rad));
                const row = Math.round(centerRow + radius * Math.sin(rad));

                const position = this.findGridPosition(col, row);
                if (position) {
                    positions.push(position);
                }
            }
        }

        return positions;
    }

    // Поиск центральной позиции
    findCenterPosition() {
        const centerCol = Math.floor(this.getGridColumns() / 2);
        const centerRow = Math.floor(this.getGridRows() / 2);
        return this.findGridPosition(centerCol, centerRow);
    }

    // Поиск лучшей позиции для компонента
    findBestPosition(component, connectionMatrix) {
        let bestScore = -Infinity;
        let bestPosition = null;

        // Перебираем все свободные позиции
        for (const position of this.placementGrid) {
            if (this.canPlaceComponent(component, position)) {
                const score = this.calculatePlacementScore(component, position, connectionMatrix);

                if (score > bestScore) {
                    bestScore = score;
                    bestPosition = position;
                }
            }
        }

        // Если не нашли подходящую позицию, ищем любую свободную
        if (!bestPosition) {
            bestPosition = this.findAnyFreePosition(component);
        }

        return bestPosition;
    }

    // Расчет оценки позиции
    calculatePlacementScore(component, position, connectionMatrix) {
        let score = 0;
        const compSize = this.componentGridPositions.get(component);

        // Учитываем связи с уже размещенными компонентами
        this.components.forEach(otherComp => {
            if (otherComp !== component && this.isComponentPlaced(otherComp)) {
                const connectionWeight = connectionMatrix[component.id][otherComp.id] || 0;
                if (connectionWeight > 0) {
                    const distance = this.calculateGridDistance(component, position, otherComp);
                    score += connectionWeight / (distance + 1);
                }
            }
        });

        // Предпочтение центральным позициям
        const centerCol = Math.floor(this.getGridColumns() / 2);
        const centerRow = Math.floor(this.getGridRows() / 2);
        const distanceToCenter = Math.abs(position.col - centerCol) + Math.abs(position.row - centerRow);
        score -= distanceToCenter * 0.1;

        return score;
    }

    // Расчет расстояния между компонентами в сетке
    calculateGridDistance(comp1, position1, comp2) {
        const pos2 = this.findComponentPosition(comp2);
        if (!pos2) return Infinity;

        // Манхэттенское расстояние между центрами
        const comp1Size = this.componentGridPositions.get(comp1);
        const comp2Size = this.componentGridPositions.get(comp2);

        const center1 = {
            col: position1.col + comp1Size.width / 2,
            row: position1.row + comp1Size.height / 2
        };

        const center2 = {
            col: pos2.col + comp2Size.width / 2,
            row: pos2.row + comp2Size.height / 2
        };

        return Math.abs(center1.col - center2.col) + Math.abs(center1.row - center2.row);
    }

    // Итеративное улучшение размещения
    improvePlacement(connectionMatrix) {
        const maxIterations = 100;
        let improved = true;
        let iterations = 0;

        while (improved && iterations < maxIterations) {
            improved = false;

            for (const component of this.components) {
                const currentPosition = this.findComponentPosition(component);
                if (!currentPosition) continue;

                const currentScore = this.calculateTotalScore(connectionMatrix);

                // Временно убираем компонент
                this.removeComponentFromGrid(component);

                // Ищем лучшее положение
                const newPosition = this.findBestPosition(component, connectionMatrix);
                this.placeComponent(component, newPosition);

                const newScore = this.calculateTotalScore(connectionMatrix);

                // Если не улучшилось, возвращаем на место
                if (newScore <= currentScore) {
                    this.removeComponentFromGrid(component);
                    this.placeComponent(component, currentPosition);
                } else {
                    improved = true;
                    console.log(`Улучшение на итерации ${iterations}: ${newScore - currentScore}`);
                }
            }

            iterations++;
        }

        console.log(`Оптимизация завершена за ${iterations} итераций`);
    }

    // Расчет общей оценки размещения
    calculateTotalScore(connectionMatrix) {
        let totalScore = 0;

        for (let i = 0; i < this.components.length; i++) {
            for (let j = i + 1; j < this.components.length; j++) {
                const comp1 = this.components[i];
                const comp2 = this.components[j];

                const connectionWeight = connectionMatrix[comp1.id][comp2.id] || 0;
                if (connectionWeight > 0) {
                    const distance = this.calculateGridDistance(comp1, this.findComponentPosition(comp1), comp2);
                    totalScore += connectionWeight / (distance + 1);
                }
            }
        }

        return totalScore;
    }

    // Вспомогательные методы
    findGridPosition(col, row) {
        return this.placementGrid.find(pos => pos.col === col && pos.row === row);
    }

    findComponentPosition(component) {
        return this.placementGrid.find(pos => pos.component === component);
    }

    isComponentPlaced(component) {
        return this.findComponentPosition(component) !== undefined;
    }


    clearGrid() {
        this.placementGrid.forEach(pos => {
            pos.occupied = false;
            pos.component = null;
        });
        // Сбрасываем позиции компонентов
        this.components.forEach(comp => {
            comp.x = 100;
            comp.y = 100;
        });
    }

    getGridColumns() {
        const maxCol = Math.max(...this.placementGrid.map(pos => pos.col));
        return maxCol + 1;
    }

    getGridRows() {
        const maxRow = Math.max(...this.placementGrid.map(pos => pos.row));
        return maxRow + 1;
    }

    // Переименуем этот метод
    findAnyFreePositionForComponent(component) {
        // Сначала ищем в центре
        const centerPosition = this.findCenterPosition();
        if (this.canPlaceComponent(component, centerPosition)) {
            return centerPosition;
        }

        // Затем ищем по спирали от центра
        const spiralPositions = this.generateSpiralSearchOrder();
        for (const position of spiralPositions) {
            if (this.canPlaceComponent(component, position)) {
                return position;
            }
        }

        // Если ничего не нашли, возвращаем null
        return null;
    }

    // А этот метод оставим как есть (используется в другом месте)
    findAnyFreePosition(component) {
        for (const position of this.placementGrid) {
            if (this.canPlaceComponent(component, position)) {
                return position;
            }
        }
        return this.placementGrid[0]; // fallback
    }

    // Переключение отображения сетки
    togglePlacementGrid() {
        this.showPlacementGrid = !this.showPlacementGrid;
        this.render();
    }

    // Поиск связанных групп компонентов
    findConnectedGroups() {
        const visited = new Set();
        const groups = [];

        this.components.forEach(comp => {
            if (!visited.has(comp)) {
                const group = {
                    components: [],
                    connectionCount: 0
                };

                this.traverseConnections(comp, visited, group);

                if (group.components.length > 0) {
                    groups.push(group);
                }
            }
        });

        return groups;
    }

    // Обход связей компонента
    traverseConnections(component, visited, group) {
        if (visited.has(component)) return;

        visited.add(component);
        group.components.push({
            component: component,
            positions: this.calculateGridPositions(component)
        });

        // Находим все компоненты, связанные с текущим
        const connectedComponents = this.findConnectedComponents(component);

        group.connectionCount += connectedComponents.length;

        connectedComponents.forEach(connectedComp => {
            if (!visited.has(connectedComp)) {
                this.traverseConnections(connectedComp, visited, group);
            }
        });
    }

    // Поиск компонентов, связанных с данным
    findConnectedComponents(component) {
        const connected = new Set();

        this.wires.forEach(wire => {
            const startComp = wire.start.component;
            const endComp = wire.end.component;

            if (startComp === component && endComp && endComp !== component) {
                connected.add(endComp);
            }
            if (endComp === component && startComp && startComp !== component) {
                connected.add(startComp);
            }
        });

        return Array.from(connected);
    }

    // Вычисление количества позиций для компонента
    calculateGridPositions(component) {
        if (!component.dimensions) return 1;

        // Находим самый маленький компонент для базового размера
        let minSize = Infinity;
        this.components.forEach(comp => {
            if (comp.dimensions) {
                const largerSide = Math.max(comp.dimensions.width, comp.dimensions.height);
                if (largerSide < minSize) {
                    minSize = largerSide;
                }
            }
        });

        if (minSize === Infinity) return 1;

        const largerSide = Math.max(component.dimensions.width, component.dimensions.height);
        return Math.max(1, Math.round(largerSide / minSize));
    }

    // Применение размещения к компонентам
    applyPlacement(placement, baseGridSize) {
        placement.forEach(item => {
            const comp = item.component;
            comp.x = item.x;
            comp.y = item.y;
        });

        this.render();
    }

    // Создание сетки позиций
    createPlacementGrid() {
        if (this.components.length === 0) {
            alert('Нет компонентов для размещения');
            return;
        }

        console.log('=== СОЗДАНИЕ СЕТКИ ПОЗИЦИЙ ===');
        console.log(`Компонентов: ${this.components.length}`);

        // 1. Определяем базовый размер позиции
        this.calculateBaseGridSize();

        // 2. Создаем сетку позиций на основе суммарного размера всех компонентов
        this.generateGridPositions();

        // 3. Визуализируем сетку
        this.showPlacementGrid = true;
        this.render();

        // Показываем подробную статистику
        this.showGridStats();
    }

    // Расчет базового размера позиции
    calculateBaseGridSize() {
        if (this.components.length === 0) {
            this.baseGridSize = 50;
            return;
        }

        // Находим самый маленький компонент
        let minComponent = null;
        let minSize = Infinity;

        this.components.forEach(comp => {
            const dimensions = this.getComponentDimensions(comp);
            const largerSide = Math.max(dimensions.width, dimensions.height);
            if (largerSide < minSize) {
                minSize = largerSide;
                minComponent = comp;
            }
        });

        // Базовый размер = размер самого маленького компонента + отступы
        this.baseGridSize = Math.max(40, minSize + 20);
    }

    // Генерация позиций сетки на основе суммарного размера всех компонентов
generateGridPositions() {
    this.placementGrid = [];
    this.componentGridPositions = new Map();

    // 1. Находим самый маленький компонент для базовой единицы
    let minComponent = null;
    let minSize = Infinity;

    this.components.forEach(comp => {
        const dimensions = this.getComponentDimensions(comp);
        const largerSide = Math.max(dimensions.width, dimensions.height);
        if (largerSide < minSize) {
            minSize = largerSide;
            minComponent = comp;
        }
    });

    // Базовый размер = размер самого маленького компонента + отступы
    this.baseGridSize = Math.max(40, minSize + 20);
    console.log(`Базовый элемент: ${minComponent.name}, размер: ${minSize}px, размер позиции: ${this.baseGridSize}px`);

    // 2. Вычисляем общее количество позиций = сумме размеров всех компонентов в базовых единицах
    let totalPositionsNeeded = 0;

    // Сначала вычисляем размеры всех компонентов в позициях и суммируем
    this.components.forEach(comp => {
        const dimensions = this.getComponentDimensions(comp);
        const widthInPositions = Math.max(1, Math.ceil(dimensions.width / this.baseGridSize));
        const heightInPositions = Math.max(1, Math.ceil(dimensions.height / this.baseGridSize));
        const areaInPositions = widthInPositions * heightInPositions;

        totalPositionsNeeded += areaInPositions;

        // Сохраняем конфигурацию позиций для компонента
        const positionConfigs = this.generatePositionConfigurations(widthInPositions, heightInPositions);

        this.componentGridPositions.set(comp, {
            width: widthInPositions,
            height: heightInPositions,
            area: areaInPositions,
            positionConfigs: positionConfigs
        });

        console.log(`${comp.name}: ${dimensions.width}×${dimensions.height}px → ${widthInPositions}×${heightInPositions} = ${areaInPositions} позиций`);
    });

    console.log(`Всего нужно позиций: ${totalPositionsNeeded}`);

    // 3. Создаем квадратную сетку, чтобы общее количество позиций было >= totalPositionsNeeded
    const gridSide = Math.ceil(Math.sqrt(totalPositionsNeeded * 1.2)); // +20% для свободного места
    const gridCols = Math.max(8, gridSide); // минимум 8 колонок
    const gridRows = Math.max(6, gridSide); // минимум 6 строк

    console.log(`Создаем сетку: ${gridCols}×${gridRows} = ${gridCols * gridRows} позиций`);

    // 4. Создаем позиции сетки
    const startX = 100;
    const startY = 100;

    for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
            this.placementGrid.push({
                x: startX + col * this.baseGridSize,
                y: startY + row * this.baseGridSize,
                col: col,
                row: row,
                occupied: false,
                component: null,
                positionId: `${col},${row}`
            });
        }
    }

    console.log(`Создано ${this.placementGrid.length} позиций для ${this.components.length} компонентов`);
}

    // Генерация всех возможных конфигураций позиций для компонента
    generatePositionConfigurations(width, height) {
        const configs = [];

        // Для прямоугольного компонента только одна конфигурация - прямоугольник
        configs.push({
            type: 'rectangle',
            positions: this.generateRectanglePositions(width, height),
            width: width,
            height: height
        });

        return configs;
    }

    // Генерация позиций для прямоугольной области
    generateRectanglePositions(width, height) {
        const positions = [];
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                positions.push({ col, row });
            }
        }
        return positions;
    }

    // Проверка возможности размещения компонента в конкретной позиции
    canPlaceComponent(component, startPosition) {
        const compConfig = this.componentGridPositions.get(component);
        if (!compConfig) return false;

        // Проверяем основную конфигурацию (прямоугольник)
        const mainConfig = compConfig.positionConfigs[0];

        for (const relativePos of mainConfig.positions) {
            const targetCol = startPosition.col + relativePos.col;
            const targetRow = startPosition.row + relativePos.row;

            const gridPos = this.findGridPosition(targetCol, targetRow);
            if (!gridPos || gridPos.occupied) {
                return false;
            }
        }
        return true;
    }

    // Размещение компонента с учетом его размеров
    placeComponent(component, startPosition) {
        const compConfig = this.componentGridPositions.get(component);
        if (!compConfig || !startPosition) return false;

        const mainConfig = compConfig.positionConfigs[0];

        // Занимаем все позиции компонента
        for (const relativePos of mainConfig.positions) {
            const targetCol = startPosition.col + relativePos.col;
            const targetRow = startPosition.row + relativePos.row;

            const gridPos = this.findGridPosition(targetCol, targetRow);
            if (gridPos) {
                gridPos.occupied = true;
                gridPos.component = component;
            }
        }

        // Устанавливаем координаты компонента (центрируем)
        component.x = startPosition.x + (compConfig.width * this.baseGridSize) / 2;
        component.y = startPosition.y + (compConfig.height * this.baseGridSize) / 2;

        // Сохраняем информацию о занятых позициях
        component.gridPosition = {
            startCol: startPosition.col,
            startRow: startPosition.row,
            width: compConfig.width,
            height: compConfig.height
        };

        return true;
    }

    // Удаление компонента из сетки
    removeComponentFromGrid(component) {
        if (!component.gridPosition) return;

        const { startCol, startRow, width, height } = component.gridPosition;

        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const gridPos = this.findGridPosition(startCol + col, startRow + row);
                if (gridPos && gridPos.component === component) {
                    gridPos.occupied = false;
                    gridPos.component = null;
                }
            }
        }

        delete component.gridPosition;
    }

    // Получение размеров компонента
    getComponentDimensions(component) {
        if (component.dimensions) {
            return component.dimensions;
        }

        // Расчет размеров по умолчанию
        return this.estimateComponentDimensions(component);
    }

    // Визуализация сетки - более видная и красивая
    renderPlacementGrid() {
        if (!this.showPlacementGrid) return;

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Фон сетки
        this.ctx.fillStyle = 'rgba(30, 30, 30, 0.3)';
        this.ctx.fillRect(
            this.placementGrid[0]?.x || 100,
            this.placementGrid[0]?.y || 100,
            this.getGridColumns() * this.baseGridSize,
            this.getGridRows() * this.baseGridSize
        );

        // Рисуем все позиции сетки
        this.placementGrid.forEach(position => {
            // Яркие цвета для занятых/свободных позиций
            if (position.occupied) {
                // Занятые позиции - красный с градиентом
                const gradient = this.ctx.createRadialGradient(
                    position.x + this.baseGridSize / 2,
                    position.y + this.baseGridSize / 2,
                    0,
                    position.x + this.baseGridSize / 2,
                    position.y + this.baseGridSize / 2,
                    this.baseGridSize / 2
                );
                gradient.addColorStop(0, 'rgba(231, 76, 60, 0.8)');
                gradient.addColorStop(1, 'rgba(192, 57, 43, 0.4)');
                this.ctx.fillStyle = gradient;
            } else {
                // Свободные позиции - зеленый с градиентом
                const gradient = this.ctx.createLinearGradient(
                    position.x, position.y,
                    position.x + this.baseGridSize, position.y + this.baseGridSize
                );
                gradient.addColorStop(0, 'rgba(46, 204, 113, 0.3)');
                gradient.addColorStop(1, 'rgba(39, 174, 96, 0.1)');
                this.ctx.fillStyle = gradient;
            }

            // Заливка позиции
            this.ctx.fillRect(position.x, position.y, this.baseGridSize, this.baseGridSize);

            // Границы позиций - более толстые и контрастные
            this.ctx.strokeStyle = position.occupied ? 'rgba(231, 76, 60, 0.9)' : 'rgba(46, 204, 113, 0.7)';
            this.ctx.lineWidth = position.occupied ? 2.5 : 1.5;
            this.ctx.setLineDash([]); // Сплошные линии

            this.ctx.strokeRect(position.x, position.y, this.baseGridSize, this.baseGridSize);

            // Подсветка углов для лучшей видимости
            this.ctx.strokeStyle = position.occupied ? 'rgba(231, 76, 60, 0.6)' : 'rgba(46, 204, 113, 0.4)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            // Левый верхний угол
            this.ctx.moveTo(position.x, position.y);
            this.ctx.lineTo(position.x + 8, position.y);
            this.ctx.moveTo(position.x, position.y);
            this.ctx.lineTo(position.x, position.y + 8);
            // Правый верхний угол
            this.ctx.moveTo(position.x + this.baseGridSize, position.y);
            this.ctx.lineTo(position.x + this.baseGridSize - 8, position.y);
            this.ctx.moveTo(position.x + this.baseGridSize, position.y);
            this.ctx.lineTo(position.x + this.baseGridSize, position.y + 8);
            // Левый нижний угол
            this.ctx.moveTo(position.x, position.y + this.baseGridSize);
            this.ctx.lineTo(position.x + 8, position.y + this.baseGridSize);
            this.ctx.moveTo(position.x, position.y + this.baseGridSize);
            this.ctx.lineTo(position.x, position.y + this.baseGridSize - 8);
            // Правый нижний угол
            this.ctx.moveTo(position.x + this.baseGridSize, position.y + this.baseGridSize);
            this.ctx.lineTo(position.x + this.baseGridSize - 8, position.y + this.baseGridSize);
            this.ctx.moveTo(position.x + this.baseGridSize, position.y + this.baseGridSize);
            this.ctx.lineTo(position.x + this.baseGridSize, position.y + this.baseGridSize - 8);
            this.ctx.stroke();

            // Номера позиций - более крупные и читаемые
            if (this.scale > 0.3) {
                this.ctx.fillStyle = position.occupied ? '#ffffff' : '#ecf0f1';
                this.ctx.font = this.scale > 0.7 ? 'bold 11px Arial' : 'bold 9px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                this.ctx.shadowBlur = 3;
                this.ctx.shadowOffsetX = 1;
                this.ctx.shadowOffsetY = 1;

                this.ctx.fillText(
                    `${position.col},${position.row}`,
                    position.x + this.baseGridSize / 2,
                    position.y + this.baseGridSize / 2
                );

                // Сбрасываем тень
                this.ctx.shadowColor = 'transparent';
                this.ctx.shadowBlur = 0;
                this.ctx.shadowOffsetX = 0;
                this.ctx.shadowOffsetY = 0;
            }
        });

        // Рисуем главные линии сетки (каждые 5 позиций)
        this.drawMajorGridLines();

        this.ctx.restore();

        // Подсветка связей между компонентами (опционально)
    if (this.scale > 0.3) {
        this.highlightConnections();
    }

    this.ctx.restore();
}

// Подсветка связей между компонентами
highlightConnections() {
    const connectionMatrix = this.buildConnectionMatrix();

    this.ctx.strokeStyle = 'rgba(155, 89, 182, 0.4)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([2, 2]);

    for (let i = 0; i < this.components.length; i++) {
        for (let j = i + 1; j < this.components.length; j++) {
            const comp1 = this.components[i];
            const comp2 = this.components[j];
            const weight = connectionMatrix[comp1.id]?.[comp2.id] || 0;

            if (weight > 0 && this.isComponentPlaced(comp1) && this.isComponentPlaced(comp2)) {
                const pos1 = this.findComponentPosition(comp1);
                const pos2 = this.findComponentPosition(comp2);

                if (pos1 && pos2) {
                    const center1 = {
                        x: pos1.x + this.baseGridSize / 2,
                        y: pos1.y + this.baseGridSize / 2
                    };
                    const center2 = {
                        x: pos2.x + this.baseGridSize / 2,
                        y: pos2.y + this.baseGridSize / 2
                    };

                    this.ctx.beginPath();
                    this.ctx.moveTo(center1.x, center1.y);
                    this.ctx.lineTo(center2.x, center2.y);
                    this.ctx.stroke();

                    // Подпись веса связи
                    if (this.scale > 0.7) {
                        this.ctx.fillStyle = 'rgba(155, 89, 182, 0.8)';
                        this.ctx.font = '10px Arial';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText(
                            weight.toString(),
                            (center1.x + center2.x) / 2,
                            (center1.y + center2.y) / 2 - 5
                        );
                    }
                }
            }
        }
    }

    this.ctx.setLineDash([]);

    }

    // Рисуем главные линии сетки
    drawMajorGridLines() {
        if (this.placementGrid.length === 0) return;

        const gridCols = this.getGridColumns();
        const gridRows = this.getGridRows();
        const firstPos = this.placementGrid[0];

        if (!firstPos) return;

        this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.4)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([8, 4]);

        // Вертикальные главные линии
        for (let col = 0; col <= gridCols; col += 5) {
            const x = firstPos.x + col * this.baseGridSize;
            this.ctx.beginPath();
            this.ctx.moveTo(x, firstPos.y);
            this.ctx.lineTo(x, firstPos.y + gridRows * this.baseGridSize);
            this.ctx.stroke();
        }

        // Горизонтальные главные линии
        for (let row = 0; row <= gridRows; row += 5) {
            const y = firstPos.y + row * this.baseGridSize;
            this.ctx.beginPath();
            this.ctx.moveTo(firstPos.x, y);
            this.ctx.lineTo(firstPos.x + gridCols * this.baseGridSize, y);
            this.ctx.stroke();
        }

        this.ctx.setLineDash([]);
    }

    // Проверка, является ли позиция начальной для компонента
    isStartPosition(position) {
        if (!position.component || !position.component.gridPosition) return false;

        const gridPos = position.component.gridPosition;
        return position.col === gridPos.startCol && position.row === gridPos.startRow;
    }

    // Подсветка области большого компонента
    highlightComponentArea(startPosition) {
        const component = startPosition.component;
        const compConfig = this.componentGridPositions.get(component);
        if (!compConfig) return;

        this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.5)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([]);

        this.ctx.strokeRect(
            startPosition.x,
            startPosition.y,
            compConfig.width * this.baseGridSize,
            compConfig.height * this.baseGridSize
        );

        // Подпись с размерами
        if (this.scale > 0.5) {
            this.ctx.fillStyle = 'rgba(52, 152, 219, 0.8)';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                `${compConfig.width}×${compConfig.height}`,
                startPosition.x + (compConfig.width * this.baseGridSize) / 2,
                startPosition.y + (compConfig.height * this.baseGridSize) / 2
            );
        }
    }

    // Вспомогательные методы для алгоритма

    // Получение неразмещенных компонентов
    getUnplacedComponents() {
        return this.components.filter(comp => !this.isComponentPlaced(comp));
    }

    // Выбор модуля с максимальной оценкой J
    selectComponentByMaxJ(jScores) {
        let maxScore = -Infinity;
        let bestComponent = null;

        jScores.forEach(score => {
            if (score.score > maxScore) {
                maxScore = score.score;
                bestComponent = score.component;
            }
        });

        return bestComponent;
    }

        // Выбор позиции с минимальной оценкой F
        selectPositionByMinF(fScores) {
            let minScore = Infinity;
            let bestPosition = null;

            fScores.forEach(score => {
                if (score.score < minScore) {
                    minScore = score.score;
                    bestPosition = score.position;
                }
            });

            return bestPosition;
        }

        // Расчет манхэттенского расстояния между позициями
        calculateManhattanDistance(pos1, pos2) {
            if (!pos1 || !pos2) return Infinity;
            return Math.abs(pos1.col - pos2.col) + Math.abs(pos1.row - pos2.row);
        }

        calculateFScoreWithIntersectionPenalty(component, position, orientation, connectionMatrix, placedComponents) {
        let baseScore = this.calculateFScoreForOrientation(component, position, orientation, connectionMatrix, placedComponents);

        // Штраф за пересечения с существующими проводами
        const intersectionPenalty = this.calculateIntersectionPenalty(component, position, orientation);
        baseScore += intersectionPenalty * 10; // Увеличиваем вес штрафа

        return baseScore;
    }

    calculateIntersectionPenalty(component, position, orientation) {
        let intersections = 0;
        const compCenter = this.calculateComponentCenter(component, position, orientation);

        // Проверяем пересечения с существующими проводами
        this.wires.forEach(wire => {
            if (this.doesWireIntersectComponent(wire, compCenter, component)) {
                intersections++;
            }
        });

        return intersections;
    }

    // Улучшенный последовательный алгоритм размещения по связности
improvedSequentialPlacement() {
    if (this.placementGrid.length === 0) {
        alert('Сначала создайте сетку позиций');
        return;
    }

    console.log('=== УЛУЧШЕННЫЙ ПОСЛЕДОВАТЕЛЬНЫЙ АЛГОРИТМ РАЗМЕЩЕНИЯ ===');

    // Очищаем предыдущее размещение
    this.clearGrid();

    // Пункт 1. Размещение директивных модулей (выбираем компонент с максимальными связями)
    const firstComponent = this.selectComponentWithMaxConnections();
    if (firstComponent) {
        const centerPosition = this.findCenterPosition();
        if (centerPosition && this.canPlaceComponent(firstComponent, centerPosition)) {
            this.placeComponent(firstComponent, centerPosition);
            console.log(`Директивный модуль размещен: ${firstComponent.name} (макс. связи) в позиции (${centerPosition.col},${centerPosition.row})`);
        }
    }

    // Основной цикл алгоритма
    let step = 1;
    const maxSteps = this.components.length * 3;

    while (this.getUnplacedComponents().length > 0 && step <= maxSteps) {
        console.log(`\n--- Шаг ${step} ---`);
        console.log(`Неразмещено: ${this.getUnplacedComponents().length} компонентов`);

        // Пункт 2. Формирование массива позиций, соседних с занятыми
        const neighborPositions = this.getExtendedNeighborPositions();
        console.log(`Соседние позиции: ${neighborPositions.length}`);

        if (neighborPositions.length === 0) {
            console.log('Нет соседних позиций, размещаем оставшиеся компоненты');
            this.placeRemainingComponentsWithOptimization();
            break;
        }

        // Пункт 3. Расчет оценки J для всех неразмещенных модулей
        const unplacedComponents = this.getUnplacedComponents();
        const jScores = this.calculateImprovedJScores(unplacedComponents);

        if (jScores.length === 0) break;

        // Пункт 4. Выбор модуля с максимальным значением оценки J
        const bestComponent = this.selectComponentByMaxJ(jScores);
        const bestJScore = jScores.find(score => score.component === bestComponent)?.score || 0;
        console.log(`Выбран модуль: ${bestComponent.name} (J=${bestJScore.toFixed(2)})`);

        // Пункт 5. Расчет оценки F для каждой позиции с учетом ориентации
        const fScores = this.calculateImprovedFScores(bestComponent, neighborPositions);

        if (fScores.length === 0) {
            console.log('Нет подходящих позиций для модуля, ищем любую свободную');
            const anyPosition = this.findAnyFreePositionForLargeComponent(bestComponent);
            if (anyPosition) {
                this.placeComponent(bestComponent, anyPosition);
            }
            continue;
        }

        // Пункт 6. Выбор позиции с минимальным значением оценки F
        const bestPlacement = this.selectPlacementByMinF(fScores);
        console.log(`Выбрана позиция: (${bestPlacement.position.col},${bestPlacement.position.row}) (F=${bestPlacement.score.toFixed(2)})`);

        // Пункт 7. Размещение выбранного модуля
        if (this.placeComponentWithOrientation(bestComponent, bestPlacement.position, bestPlacement.orientation)) {
            console.log(`Модуль ${bestComponent.name} размещен в позиции (${bestPlacement.position.col},${bestPlacement.position.row}) ориентация: ${bestPlacement.orientation}`);

            // Визуализируем шаг
            this.highlightCurrentPlacement(bestComponent, step);
        } else {
            console.log('Не удалось разместить модуль в выбранной позиции');
            const fallbackPosition = this.findAnyFreePositionForLargeComponent(bestComponent);
            if (fallbackPosition) {
                this.placeComponent(bestComponent, fallbackPosition);
            }
        }

        step++;
    }

    // Пункт 8. Завершение алгоритма
    console.log('=== АЛГОРИТМ ЗАВЕРШЕН ===');
    this.finalizePlacement();
}

// 1. Выбор компонента с максимальным количеством связей
selectComponentWithMaxConnections() {
    const connectionMatrix = this.buildConnectionMatrix();
    let maxConnections = -1;
    let bestComponent = null;

    this.components.forEach(component => {
        const connections = this.getTotalConnections(component.id, connectionMatrix);
        if (connections > maxConnections) {
            maxConnections = connections;
            bestComponent = component;
        }
    });

    console.log(`Выбран компонент с максимальными связями: ${bestComponent?.name} (${maxConnections} связей)`);
    return bestComponent || this.components[0];
}

// 2. Поддержка больших элементов (уже есть в вашем коде, но улучшим)
findAnyFreePositionForLargeComponent(component) {
    const compConfig = this.componentGridPositions.get(component);
    if (!compConfig) return null;

    // Сначала ищем в центре
    const centerPosition = this.findCenterPosition();
    if (centerPosition && this.canPlaceComponent(component, centerPosition)) {
        return centerPosition;
    }

    // Затем ищем по спирали от центра
    const spiralPositions = this.generateSpiralSearchOrder();
    for (const position of spiralPositions) {
        if (this.canPlaceComponent(component, position)) {
            return position;
        }
    }

    // Ищем любую свободную позицию
    for (const position of this.placementGrid) {
        if (this.canPlaceComponent(component, position)) {
            return position;
        }
    }

    return null;
}

// 3. Улучшенный расчет оценки J с весами связей
calculateImprovedJScores(unplacedComponents) {
    const connectionMatrix = this.buildWeightedConnectionMatrix();
    const placedComponents = this.components.filter(comp => this.isComponentPlaced(comp));

    return unplacedComponents.map(component => {
        let sumConnectionsToPlaced = 0;
        let sumConnectionsToUnplaced = 0;

        // Сумма связей с размещенными модулями (с весами)
        placedComponents.forEach(placedComp => {
            const weight = connectionMatrix[component.id]?.[placedComp.id] || 0;
            sumConnectionsToPlaced += weight;
        });

        // Сумма связей с неразмещенными модулями (с весами)
        unplacedComponents.forEach(unplacedComp => {
            if (unplacedComp !== component) {
                const weight = connectionMatrix[component.id]?.[unplacedComp.id] || 0;
                sumConnectionsToUnplaced += weight;
            }
        });

        // J = sum(связи с размещенными) - sum(связи с неразмещенными)
        const jScore = sumConnectionsToPlaced - sumConnectionsToUnplaced;

        return {
            component: component,
            score: jScore,
            details: {
                toPlaced: sumConnectionsToPlaced,
                toUnplaced: sumConnectionsToUnplaced
            }
        };
    });
}

// 4. Матрица связей с весами
buildWeightedConnectionMatrix() {
    const matrix = {};
    const compIds = this.components.map(c => c.id);

    // Инициализация матрицы
    compIds.forEach(id1 => {
        matrix[id1] = {};
        compIds.forEach(id2 => {
            matrix[id1][id2] = 0;
        });
    });

    // Заполнение матрицы на основе проводов с весами
    this.wires.forEach(wire => {
        const startComp = wire.start.component;
        const endComp = wire.end.component;

        if (startComp && endComp && startComp.id !== endComp.id) {
            // Вес связи можно настроить (по умолчанию 1)
            let weight = 1;

            // Можно добавить логику для разных типов связей
            // Например, силовые связи имеют больший вес
            if (startComp.type?.includes('power') || endComp.type?.includes('power')) {
                weight = 2;
            }

            matrix[startComp.id][endComp.id] += weight;
            matrix[endComp.id][startComp.id] += weight;
        }
    });

    return matrix;
}

// Улучшенный расчет оценки F с учетом реальных позиций пинов после вращения
calculateImprovedFScores(component, neighborPositions) {
    const connectionMatrix = this.buildWeightedConnectionMatrix();
    const placedComponents = this.components.filter(comp => this.isComponentPlaced(comp));
    const fScores = [];

    // Проверяем все возможные ориентации
    const orientations = [0, 90, 180, 270];

    neighborPositions.forEach(position => {
        orientations.forEach(orientation => {
            if (this.canPlaceComponentWithOrientation(component, position, orientation)) {
                const score = this.calculateFScoreWithRealPinDistances(
                    component, position, orientation, connectionMatrix, placedComponents
                );

                if (score < Infinity) {
                    fScores.push({
                        position: position,
                        orientation: orientation,
                        score: score,
                        component: component.name,
                        positionLabel: `${position.col},${position.row}`
                    });
                }
            }
        });
    });

    return fScores;
}

// Расчет оценки F на основе реальных расстояний между пинами
calculateFScoreWithRealPinDistances(component, position, orientation, connectionMatrix, placedComponents) {
    let totalWireLength = 0;
    let connectionCount = 0;

    // Временное размещение для расчета позиций пинов
    const tempPinPositions = this.calculatePinPositionsAfterPlacement(component, position, orientation);

    placedComponents.forEach(placedComp => {
        const weight = connectionMatrix[component.id]?.[placedComp.id] || 0;
        if (weight > 0) {
            // Находим соответствующие пины для этой связи
            const pinPairs = this.findConnectedPinPairs(component, placedComp);

            pinPairs.forEach(pinPair => {
                const pin1Pos = tempPinPositions[pinPair.pin1Index];
                const pin2Pos = this.getActualPinPosition(placedComp, pinPair.pin2Index);

                if (pin1Pos && pin2Pos) {
                    const distance = this.calculateManhattanDistance(pin1Pos, pin2Pos);
                    totalWireLength += weight * distance;
                    connectionCount++;
                }
            });
        }
    });

    // Если нет связей, добавляем штраф
    if (connectionCount === 0) {
        return 1000;
    }

    // Нормализуем по количеству связей
    return totalWireLength / connectionCount;
}

// Расчет позиций пинов после размещения и вращения
calculatePinPositionsAfterPlacement(component, position, orientation) {
    const pinPositions = [];
    const centerX = position.x + (this.componentGridPositions.get(component)?.width * this.baseGridSize || 0) / 2;
    const centerY = position.y + (this.componentGridPositions.get(component)?.height * this.baseGridSize || 0) / 2;

    const radians = orientation * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    component.pins.forEach(pin => {
        // Вращаем координаты пина
        const rotatedX = pin.x * cos - pin.y * sin;
        const rotatedY = pin.x * sin + pin.y * cos;

        // Переводим в абсолютные координаты
        const absoluteX = centerX + rotatedX;
        const absoluteY = centerY + rotatedY;

        pinPositions.push({
            x: absoluteX,
            y: absoluteY,
            col: Math.round(position.col + rotatedX / this.baseGridSize),
            row: Math.round(position.row + rotatedY / this.baseGridSize)
        });
    });

    return pinPositions;
}

// Получение актуальной позиции пина размещенного компонента
getActualPinPosition(component, pinIndex) {
    if (!component.pins || !component.pins[pinIndex]) return null;

    const pin = component.pins[pinIndex];
    const centerX = component.x;
    const centerY = component.y;
    const orientation = component.rotation || 0;

    const radians = orientation * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    // Вращаем координаты пина
    const rotatedX = pin.x * cos - pin.y * sin;
    const rotatedY = pin.x * sin + pin.y * cos;

    return {
        x: centerX + rotatedX,
        y: centerY + rotatedY,
        col: Math.round((centerX + rotatedX) / this.baseGridSize),
        row: Math.round((centerY + rotatedY) / this.baseGridSize)
    };
}

// Поиск пар связанных пинов между компонентами
findConnectedPinPairs(comp1, comp2) {
    const pairs = [];

    // Ищем провода, связывающие эти два компонента
    this.wires.forEach(wire => {
        const startComp = wire.start.component;
        const endComp = wire.end.component;

        if ((startComp === comp1 && endComp === comp2) ||
            (startComp === comp2 && endComp === comp1)) {

            pairs.push({
                pin1Index: wire.start.pinIndex,
                pin2Index: wire.end.pinIndex,
                wire: wire
            });
        }
    });

    return pairs;
}

// Расчет оценки F для конкретной ориентации
calculateFScoreForOrientation(component, position, orientation, connectionMatrix, placedComponents) {
    let fScore = 0;
    let validConnections = 0;

    // Временное размещение для расчета расстояний
    const tempPosition = this.calculateComponentCenter(component, position, orientation);

    placedComponents.forEach(placedComp => {
        const weight = connectionMatrix[component.id]?.[placedComp.id] || 0;
        if (weight > 0) {
            const placedPos = this.findComponentPosition(placedComp);
            if (placedPos) {
                const placedCenter = this.calculateComponentCenter(placedComp, placedPos, placedComp.rotation || 0);
                const distance = this.calculateManhattanDistance(tempPosition, placedCenter);
                fScore += weight * distance;
                validConnections++;
            }
        }
    });

    // Если нет связей с размещенными компонентами, штрафуем
    if (validConnections === 0) {
        fScore += 1000; // Большой штраф за отсутствие связей
    }

    // Бонус за компактность
    const compactnessBonus = this.calculateCompactnessBonus(position, orientation);
    fScore -= compactnessBonus;

    return fScore;
}

// Расчет центра компонента с учетом ориентации
calculateComponentCenter(component, position, orientation) {
    const compConfig = this.componentGridPositions.get(component);
    if (!compConfig) return position;

    let width = compConfig.width;
    let height = compConfig.height;

    // Учитываем ориентацию
    if (orientation === 90 || orientation === 270) {
        [width, height] = [height, width]; // Меняем местами ширину и высоту
    }

    return {
        col: position.col + width / 2,
        row: position.row + height / 2,
        x: position.x + (width * this.baseGridSize) / 2,
        y: position.y + (height * this.baseGridSize) / 2
    };
}

// Выбор размещения с минимальной оценкой F
selectPlacementByMinF(fScores) {
    let minScore = Infinity;
    let bestPlacement = null;

    fScores.forEach(placement => {
        if (placement.score < minScore) {
            minScore = placement.score;
            bestPlacement = placement;
        }
    });

    return bestPlacement || fScores[0];
}

// Расширенный поиск соседних позиций для больших компонентов
getExtendedNeighborPositions() {
    const neighborPositions = new Set();
    const occupiedPositions = this.placementGrid.filter(pos => pos.occupied);

    occupiedPositions.forEach(occupiedPos => {
        // Расширяем область поиска для больших компонентов
        const searchRadius = 3;

        for (let row = -searchRadius; row <= searchRadius; row++) {
            for (let col = -searchRadius; col <= searchRadius; col++) {
                if (row === 0 && col === 0) continue;

                const neighborCol = occupiedPos.col + col;
                const neighborRow = occupiedPos.row + row;
                const neighborPos = this.findGridPosition(neighborCol, neighborRow);

                if (neighborPos && !neighborPos.occupied) {
                    neighborPositions.add(neighborPos);
                }
            }
        }
    });

    // Если нет соседних позиций, возвращаем все свободные
    if (neighborPositions.size === 0) {
        return this.placementGrid.filter(pos => !pos.occupied);
    }

    return Array.from(neighborPositions);
}

// Оптимизированное размещение оставшихся компонентов
placeRemainingComponentsWithOptimization() {
    const unplacedComponents = this.getUnplacedComponents();
    console.log(`Оптимизированное размещение оставшихся ${unplacedComponents.length} компонентов`);

    // Сортируем по количеству связей (от большего к меньшему)
    const connectionMatrix = this.buildWeightedConnectionMatrix();
    const sortedComponents = unplacedComponents.sort((a, b) => {
        const connectionsA = this.getTotalConnections(a.id, connectionMatrix);
        const connectionsB = this.getTotalConnections(b.id, connectionMatrix);
        return connectionsB - connectionsA;
    });

    sortedComponents.forEach(component => {
        const bestPosition = this.findBestPositionForRemaining(component, connectionMatrix);
        if (bestPosition) {
            this.placeComponent(component, bestPosition);
            console.log(`Размещен: ${component.name} в (${bestPosition.col},${bestPosition.row})`);
        }
    });
}

// Поиск лучшей позиции для оставшихся компонентов
findBestPositionForRemaining(component, connectionMatrix) {
    let bestScore = -Infinity;
    let bestPosition = null;

    for (const position of this.placementGrid) {
        if (this.canPlaceComponent(component, position)) {
            const score = this.calculatePlacementScoreForRemaining(component, position, connectionMatrix);
            if (score > bestScore) {
                bestScore = score;
                bestPosition = position;
            }
        }
    }

    return bestPosition;
}

// Финальная оптимизация размещения
finalizePlacement() {
    console.log('Финальная оптимизация размещения...');

    // Можно добавить итеративное улучшение
    this.render();
    this.showPlacementResults();

    alert('Размещение завершено! Проверьте результат и при необходимости выполните ручную корректировку.');
}

// Подсветка текущего размещения для визуализации
highlightCurrentPlacement(component, step) {
    // Временная подсветка размещенного компонента
    const position = this.findComponentPosition(component);
    if (position) {
        console.log(`Шаг ${step}: Размещен ${component.name} в (${position.col},${position.row})`);
    }

    this.render();
}

// === ДОБАВЬТЕ ЭТИ МЕТОДЫ ПОСЛЕ СУЩЕСТВУЮЩИХ МЕТОДОВ ===

// 1. Выбор компонента с максимальным количеством связей
selectComponentWithMaxConnections() {
    const connectionMatrix = this.buildConnectionMatrix();
    let maxConnections = -1;
    let bestComponent = null;

    this.components.forEach(component => {
        const connections = this.getTotalConnections(component.id, connectionMatrix);
        if (connections > maxConnections) {
            maxConnections = connections;
            bestComponent = component;c
        }
    });

    console.log(`Выбран компонент с максимальными связями: ${bestComponent?.name} (${maxConnections} связей)`);
    return bestComponent || this.components[0];
}

// 2. Матрица связей с весами
buildWeightedConnectionMatrix() {
    const matrix = {};
    const compIds = this.components.map(c => c.id);

    // Инициализация матрицы
    compIds.forEach(id1 => {
        matrix[id1] = {};
        compIds.forEach(id2 => {
            matrix[id1][id2] = 0;
        });
    });

    // Заполнение матрицы на основе проводов с весами
    this.wires.forEach(wire => {
        const startComp = wire.start.component;
        const endComp = wire.end.component;

        if (startComp && endComp && startComp.id !== endComp.id) {
            // Вес связи можно настроить (по умолчанию 1)
            let weight = 1;

            // Можно добавить логику для разных типов связей
            // Например, силовые связи имеют больший вес
            if (startComp.type?.includes('power') || endComp.type?.includes('power')) {
                weight = 2;
            }

            matrix[startComp.id][endComp.id] += weight;
            matrix[endComp.id][startComp.id] += weight;
        }
    });

    return matrix;
}

// 3. Расчет центра компонента с учетом ориентации
calculateComponentCenter(component, position, orientation) {
    const compConfig = this.componentGridPositions.get(component);
    if (!compConfig) return position;

    let width = compConfig.width;
    let height = compConfig.height;

    // Учитываем ориентацию
    if (orientation === 90 || orientation === 270) {
        [width, height] = [height, width]; // Меняем местами ширину и высоту
    }

    return {
        col: position.col + width / 2,
        row: position.row + height / 2,
        x: position.x + (width * this.baseGridSize) / 2,
        y: position.y + (height * this.baseGridSize) / 2
    };
}

// Размещение компонента с ориентацией и обновлением позиций пинов
placeComponentWithOrientation(component, startPosition, orientation) {
    const compConfig = this.componentGridPositions.get(component);
    if (!compConfig || !startPosition) return false;

    let width = compConfig.width;
    let height = compConfig.height;

    // Сохраняем старую ориентацию для расчета дельты вращения
    const oldOrientation = component.rotation || 0;
    const rotationDelta = orientation - oldOrientation;

    // Учитываем ориентацию
    if (orientation === 90 || orientation === 270) {
        [width, height] = [height, width];
    }

    // Занимаем позиции
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const targetCol = startPosition.col + col;
            const targetRow = startPosition.row + row;

            const gridPos = this.findGridPosition(targetCol, targetRow);
            if (gridPos) {
                gridPos.occupied = true;
                gridPos.component = component;
            }
        }
    }

    // Устанавливаем координаты и ориентацию
    component.x = startPosition.x + (width * this.baseGridSize) / 2;
    component.y = startPosition.y + (height * this.baseGridSize) / 2;
    component.rotation = orientation;

    // ОБНОВЛЯЕМ ПОЗИЦИИ ПИНОВ ПРИ ВРАЩЕНИИ
    this.updatePinPositionsForRotation(component, rotationDelta);

    // Сохраняем информацию о размещении
    component.gridPosition = {
        startCol: startPosition.col,
        startRow: startPosition.row,
        width: width,
        height: height,
        orientation: orientation
    };

    return true;
}

// Обновление позиций пинов при вращении
updatePinPositionsForRotation(component, rotationDelta) {
    if (!component.pins || rotationDelta === 0) return;

    const radians = rotationDelta * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    component.pins.forEach(pin => {
        // Вращаем координаты пина относительно центра компонента
        const oldX = pin.x;
        const oldY = pin.y;

        pin.x = oldX * cos - oldY * sin;
        pin.y = oldX * sin + oldY * cos;

        // Округляем до целых для сетки
        pin.x = Math.round(pin.x);
        pin.y = Math.round(pin.y);
    });

    console.log(`Обновлены позиции пинов для ${component.name} после вращения на ${rotationDelta}°`);
}

// 6. Выбор размещения с минимальной оценкой F
selectPlacementByMinF(fScores) {
    let minScore = Infinity;
    let bestPlacement = null;

    fScores.forEach(placement => {
        if (placement.score < minScore) {
            minScore = placement.score;
            bestPlacement = placement;
        }
    });

    return bestPlacement || fScores[0];
}

// 7. Бонус за компактность
calculateCompactnessBonus(position, orientation) {
    // Бонус за размещение ближе к центру
    const centerCol = Math.floor(this.getGridColumns() / 2);
    const centerRow = Math.floor(this.getGridRows() / 2);
    const distanceToCenter = Math.abs(position.col - centerCol) + Math.abs(position.row - centerRow);

    return Math.max(0, 50 - distanceToCenter) * 0.1;
}

// 8. Поиск лучшей позиции для оставшихся компонентов
findBestPositionForRemaining(component, connectionMatrix) {
    let bestScore = -Infinity;
    let bestPosition = null;

    for (const position of this.placementGrid) {
        if (this.canPlaceComponent(component, position)) {
            const score = this.calculatePlacementScoreForRemaining(component, position, connectionMatrix);
            if (score > bestScore) {
                bestScore = score;
                bestPosition = position;
            }
        }
    }

    return bestPosition;
}

// 9. Расчет оценки для оставшихся компонентов
calculatePlacementScoreForRemaining(component, position, connectionMatrix) {
    let score = 0;
    const placedComponents = this.components.filter(comp => this.isComponentPlaced(comp));

    placedComponents.forEach(placedComp => {
        const weight = connectionMatrix[component.id]?.[placedComp.id] || 0;
        if (weight > 0) {
            const distance = this.calculateGridDistance(component, position, placedComp);
            score += weight / (distance + 1);
        }
    });

    return score;
}

// 10. Финальная оптимизация размещения
finalizePlacement() {
    console.log('Финальная оптимизация размещения...');
    this.render();
    this.showPlacementResults();
    alert('Размещение завершено! Проверьте результат и при необходимости выполните ручную корректировку.');
}

// 11. Подсветка текущего размещения
highlightCurrentPlacement(component, step) {
    console.log(`Шаг ${step}: Размещен ${component.name}`);
    this.render();
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

        // Свойства для трансформации (добавляем их)
        this.scale = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;

        this.setupEventListeners();
        this.render();

        // Добавляем обработчик для выбора шага сетки
        const gridStepSelect = document.getElementById('compGridStep');
        if (gridStepSelect) {
            gridStepSelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    document.getElementById('customGridStep').style.display = 'block';
                } else {
                    document.getElementById('customGridStep').style.display = 'none';
                }
            });
        }
    }

    // Метод для расчета размеров компонента
    calculateDimensions() {
        if (this.elements.length === 0 && this.pins.length === 0) {
            return { width: 0, height: 0 };
        }

        // Находим границы всех элементов и пинов
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        // Обрабатываем элементы
        this.elements.forEach(element => {
            if (element.points) {
                element.points.forEach(point => {
                    minX = Math.min(minX, point.x);
                    maxX = Math.max(maxX, point.x);
                    minY = Math.min(minY, point.y);
                    maxY = Math.max(maxY, point.y);
                });
            }
            if (element.type === 'circle' && element.radius) {
                const center = element.points[0];
                minX = Math.min(minX, center.x - element.radius);
                maxX = Math.max(maxX, center.x + element.radius);
                minY = Math.min(minY, center.y - element.radius);
                maxY = Math.max(maxY, center.y + element.radius);
            }
        });

        // Обрабатываем пины
        this.pins.forEach(pin => {
            minX = Math.min(minX, pin.x - 5); // + отступ для пина
            maxX = Math.max(maxX, pin.x + 5);
            minY = Math.min(minY, pin.y - 5);
            maxY = Math.max(maxY, pin.y + 5);
        });

        // Если нет элементов, используем границы пинов
        if (minX === Infinity && this.pins.length > 0) {
            this.pins.forEach(pin => {
                minX = Math.min(minX, pin.x);
                maxX = Math.max(maxX, pin.x);
                minY = Math.min(minY, pin.y);
                maxY = Math.max(maxY, pin.y);
            });
        }

        // Добавляем отступы
        const padding = 10;
        const width = Math.max(0, maxX - minX) + padding * 2;
        const height = Math.max(0, maxY - minY) + padding * 2;

        return { width, height };
    }

    getComponentData() {
        const name = document.getElementById('compName').value;
        const reference = document.getElementById('compReference').value;
        const gridStepSelect = document.getElementById('compGridStep');
        let gridStep = gridStepSelect.value;

        if (gridStep === 'custom') {
            gridStep = document.getElementById('customGridStep').value;
        }

        if (!name || !reference) {
            alert('Введите название и префикс компонента');
            return null;
        }

        if (this.pins.length === 0) {
            alert('Добавьте хотя бы один пин');
            return null;
        }

        if (!gridStep || isNaN(parseFloat(gridStep))) {
            alert('Укажите корректный шаг сетки');
            return null;
        }

        // Рассчитываем и показываем размеры
        const dimensions = this.calculateDimensions();
        const gridStepNum = parseFloat(gridStep);

        alert(`Компонент создан!\nРазмеры: ${dimensions.width}×${dimensions.height}px\nЗанимает позиций: ${Math.ceil(dimensions.width/50)}×${Math.ceil(dimensions.height/50)}`);

        return {
            name: name,
            reference: reference,
            symbol: document.getElementById('svgPath').value,
            pins: this.pins,
            gridStep: gridStepNum,
            dimensions: dimensions,
            footprint: '',
            fields: {
                Value: name,
                Footprint: '',
                Datasheet: '~'
            }
        };
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
        // Очистка canvas
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

function runSequentialPlacement() {
    editor.optimizePlacement();
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

function createPlacementGrid() {
    editor.createPlacementGrid();
}


function optimizePlacement() {
    editor.optimizePlacement();
}

function togglePlacementGrid() {
    editor.togglePlacementGrid();
}

// Закрытие модальных окон при клике вне их
window.addEventListener('click', (event) => {
    const modal = document.getElementById('symbolEditorModal');
    if (event.target === modal) {
        closeSymbolEditor();
    }
});