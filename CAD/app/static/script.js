function formatMatrix(matrix) {
    console.log('Матрица связей:');
    Object.keys(matrix).forEach(comp1 => {
        const row = [];
        Object.keys(matrix[comp1]).forEach(comp2 => {
            row.push(matrix[comp1][comp2]);
        });
        console.log(`  ${comp1}: [${row.join(', ')}]`);
    });
}

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
        this.baseGridSize = 50;
        this.componentGridPositions = new Map();

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
                this.addComponent('custom', compId);
            });
            container.appendChild(compDiv);
        }
    }

    addComponent(libraryKey, componentKey) {
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

        if (!component.dimensions) {
            component.dimensions = this.estimateComponentDimensions(component);
        }

        this.components.push(component);
        this.render();
    }

    estimateComponentDimensions(component) {
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
            const wire = this.findWireAt(x, y);

            if (component) {
                this.components = this.components.filter(c => c !== component);
                this.wires = this.wires.filter(w =>
                    w.start.component !== component && w.end.component !== component
                );
                this.render();
            } else if (wire) {
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
        const tolerance = 6;
        for (const wire of this.wires) {
            const startPin = this.getPinPosition(wire.start);
            const endPin = this.getPinPosition(wire.end);
            const dist = this.pointToSegmentDistance(x, y, startPin, endPin);
            if (dist < tolerance) {
                return wire;
            }
        }
        return null;
    }

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

        this.ctx.strokeStyle = comp === this.selectedComponent ? '#e74c3c' : '#ecf0f1';
        this.ctx.lineWidth = comp === this.selectedComponent ? 2.5 : 1.5;

        try {
            const path = new Path2D(comp.symbol);
            this.ctx.stroke(path);
        } catch (e) {
            console.error('Error rendering symbol:', e);
        }

        this.ctx.fillStyle = comp === this.selectedComponent ? '#e74c3c' : '#3498db';
        comp.pins.forEach((pin, index) => {
            this.ctx.beginPath();
            this.ctx.arc(pin.x, pin.y, 2, 0, 2 * Math.PI);
            this.ctx.fill();

            if (pin.name) {
                this.ctx.fillStyle = '#95a5a6';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(pin.name, pin.x, pin.y - 8);
            }
        });

        let minY = 0;
        let maxY = 0;

        if (comp.pins && comp.pins.length > 0) {
            const pinYs = comp.pins.map(pin => pin.y);
            minY = Math.min(...pinYs);
            maxY = Math.max(...pinYs);
        } else {
            minY = -20;
            maxY = 20;
        }

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        this.ctx.fillStyle = comp === this.selectedComponent ? '#e74c3c' : '#bdc3c7';
        this.ctx.font = '11px Arial';
        this.ctx.fillText(comp.reference, 0, -10);

        this.ctx.fillStyle = '#ecf0f1';
        this.ctx.font = '10px Arial';
        this.ctx.fillText(comp.fields?.Value || comp.name, 0, 10);

        this.ctx.restore();
    }

    getPinPosition(pinRef) {
        if (pinRef.component && pinRef.pinIndex !== undefined) {
            const comp = pinRef.component;
            const pin = comp.pins[pinRef.pinIndex];

            const orientation = comp.rotation || 0;
            const radians = orientation * Math.PI / 180;
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);

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

            const componentMap = new Map(this.components.map(c => [c.id, c]));

            this.wires.forEach(wire => {
                if (wire.start?.component?.id) {
                    wire.start.component = componentMap.get(wire.start.component.id) || null;
                }
                if (wire.end?.component?.id) {
                    wire.end.component = componentMap.get(wire.end.component.id) || null;
                }
            });

            if (schema.view) {
                this.scale = schema.view.scale || 1.0;
                this.offsetX = schema.view.offsetX || 0;
                this.offsetY = schema.view.offsetY || 0;
            }

            this.nextComponentId = this.components.length + 1;
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

    // Алгоритмы размещения
    optimizePlacement() {
        if (this.placementGrid.length === 0) {
            alert('Сначала создайте сетку позиций');
            return;
        }

        console.log('=== ЗАПУСК ПОСЛЕДОВАТЕЛЬНОГО АЛГОРИТМА РАЗМЕЩЕНИЯ ===');
        const startTime = performance.now();

        this.improvedSequentialPlacement();

        const endTime = performance.now();
        const executionTime = (endTime - startTime) / 1000;
        console.log(`Алгоритм выполнен за ${executionTime.toFixed(2)} секунд`);

        this.showPlacementResults();
    }

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

        return total / 2;
    }

    buildConnectionMatrix() {
        const matrix = {};
        const compIds = this.components.map(c => c.id);

        compIds.forEach(id1 => {
            matrix[id1] = {};
            compIds.forEach(id2 => {
                matrix[id1][id2] = 0;
            });
        });

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

    buildWeightedConnectionMatrix() {
        const matrix = {};
        const compIds = this.components.map(c => c.id);

        compIds.forEach(id1 => {
            matrix[id1] = {};
            compIds.forEach(id2 => {
                matrix[id1][id2] = 0;
            });
        });

        this.wires.forEach(wire => {
            const startComp = wire.start.component;
            const endComp = wire.end.component;

            if (startComp && endComp && startComp.id !== endComp.id) {
                let weight = 1;
                if (startComp.type?.includes('power') || endComp.type?.includes('power')) {
                    weight = 2;
                }
                matrix[startComp.id][endComp.id] += weight;
                matrix[endComp.id][startComp.id] += weight;
            }
        });

        return matrix;
    }

    getTotalConnections(compId, connectionMatrix) {
        return Object.values(connectionMatrix[compId] || {}).reduce((sum, count) => sum + count, 0);
    }

    // Улучшенный алгоритм размещения
    improvedSequentialPlacement() {
        if (this.placementGrid.length === 0) {
            alert('Сначала создайте сетку позиций');
            return;
        }

        console.log('=== ЗАПУСК УЛУЧШЕННОГО ПОСЛЕДОВАТЕЛЬНОГО АЛГОРИТМА РАЗМЕЩЕНИЯ ===');
        console.log(`Всего компонентов: ${this.components.length}`);
        console.log(`Размер сетки: ${this.getGridColumns()}×${this.getGridRows()} позиций`);

        const startTime = performance.now();
        this.clearGrid();

        // Шаг 1: Размещение первого компонента
        const firstComponent = this.selectComponentWithMaxConnections();
        const centerPosition = this.findCenterPosition();

        console.log('\n🎯 ШАГ 1: РАЗМЕЩЕНИЕ ПЕРВОГО КОМПОНЕНТА');
        console.log(`Выбран компонент: ${firstComponent.name} (${firstComponent.reference})`);
        console.log(`Центральная позиция: (${centerPosition.col},${centerPosition.row})`);

        if (firstComponent && centerPosition && this.canPlaceComponent(firstComponent, centerPosition)) {
            this.placeComponent(firstComponent, centerPosition);
            console.log(`✅ Размещен: ${firstComponent.name} в позиции (${centerPosition.col},${centerPosition.row})`);
        } else {
            console.log('❌ Не удалось разместить первый компонент в центре');
            const fallbackPosition = this.findAnyFreePosition(firstComponent);
            if (fallbackPosition) {
                this.placeComponent(firstComponent, fallbackPosition);
                console.log(`✅ Размещен в резервной позиции: (${fallbackPosition.col},${fallbackPosition.row})`);
            }
        }

        let step = 1;
        const maxSteps = this.components.length * 3;

        while (this.getUnplacedComponents().length > 0 && step <= maxSteps) {
            console.log(`\n--- 🔄 ШАГ ${step} ---`);
            console.log(`Осталось разместить: ${this.getUnplacedComponents().length} компонентов`);

            // Шаг 2: Получение соседних позиций
            const neighborPositions = this.getExtendedNeighborPositions();
            console.log(`📍 Доступно соседних позиций: ${neighborPositions.length}`);
            if (neighborPositions.length > 0) {
                console.log('Соседние позиции:', neighborPositions.map(p => `(${p.col},${p.row})`).join(', '));
            }

            if (neighborPositions.length === 0) {
                console.log('⚠️ Нет соседних позиций, размещаем оставшиеся компоненты в свободные позиции');
                this.placeRemainingComponentsWithOptimization();
                break;
            }

            // Шаг 3: Расчет J-оценок
            const unplacedComponents = this.getUnplacedComponents();
            console.log(`Неразмещенные компоненты: ${unplacedComponents.map(c => c.name).join(', ')}`);

            const jScores = this.calculateImprovedJScores(unplacedComponents);
            console.log('\n📊 РАСЧЕТ J-ОЦЕНОК (связность):');
            jScores.forEach(score => {
                console.log(`  ${score.component.name}: J = ${score.score.toFixed(2)} (к размещенным: ${score.details.toPlaced}, к неразмещенным: ${score.details.toUnplaced})`);
            });

            if (jScores.length === 0) {
                console.log('❌ Нет компонентов для расчета J-оценок');
                break;
            }

            // Шаг 4: Выбор компонента с максимальной J-оценкой
            const bestComponent = this.selectComponentByMaxJ(jScores);
            const bestJScore = jScores.find(score => score.component === bestComponent)?.score || 0;
            console.log(`🎯 ВЫБРАН КОМПОНЕНТ: ${bestComponent.name} с J = ${bestJScore.toFixed(2)}`);

            // Шаг 5: Расчет F-оценок для всех позиций и ориентаций
            console.log('\n📊 РАСЧЕТ F-ОЦЕНОК (длина связей):');
            const fScores = this.calculateImprovedFScores(bestComponent, neighborPositions);

            if (fScores.length === 0) {
                console.log('❌ Нет подходящих позиций для компонента, ищем любую свободную');
                const anyPosition = this.findAnyFreePositionForLargeComponent(bestComponent);
                if (anyPosition) {
                    this.placeComponent(bestComponent, anyPosition);
                    console.log(`✅ Размещен в свободной позиции: (${anyPosition.col},${anyPosition.row})`);
                } else {
                    console.log('❌ Не найдено ни одной свободной позиции');
                }
                continue;
            }

            // Выводим топ-5 лучших позиций
            const sortedFScores = fScores.sort((a, b) => a.score - b.score);
            console.log('🏆 ТОП-5 ЛУЧШИХ ПОЗИЦИЙ:');
            sortedFScores.slice(0, 5).forEach((placement, index) => {
                console.log(`  ${index + 1}. Позиция (${placement.position.col},${placement.position.row}) ориентация ${placement.orientation}°: F = ${placement.score.toFixed(2)}`);
            });

            // Шаг 6: Выбор позиции с минимальной F-оценкой
            const bestPlacement = this.selectPlacementByMinF(fScores);
            console.log(`🎯 ВЫБРАНА ПОЗИЦИЯ: (${bestPlacement.position.col},${bestPlacement.position.row}) ориентация ${bestPlacement.orientation}° с F = ${bestPlacement.score.toFixed(2)}`);

            // Детализация расчета для выбранной позиции
            this.logPlacementDetails(bestComponent, bestPlacement);

            // Шаг 7: Размещение компонента
            if (this.placeComponentWithOrientation(bestComponent, bestPlacement.position, bestPlacement.orientation)) {
                console.log(`✅ УСПЕШНО РАЗМЕЩЕН: ${bestComponent.name} в позиции (${bestPlacement.position.col},${bestPlacement.position.row}) ориентация ${bestPlacement.orientation}°`);
                this.highlightCurrentPlacement(bestComponent, step);
            } else {
                console.log('❌ НЕ УДАЛОСЬ РАЗМЕСТИТЬ компонент в выбранной позиции');
                const fallbackPosition = this.findAnyFreePositionForLargeComponent(bestComponent);
                if (fallbackPosition) {
                    this.placeComponent(bestComponent, fallbackPosition);
                    console.log(`✅ Размещен в резервной позиции: (${fallbackPosition.col},${fallbackPosition.row})`);
                }
            }

            step++;
        }

        const endTime = performance.now();
        const executionTime = (endTime - startTime) / 1000;
        console.log(`\n=== ✅ АЛГОРИТМ ЗАВЕРШЕН ЗА ${executionTime.toFixed(2)} СЕКУНД ===`);

        this.finalizePlacement();
        this.showDetailedPlacementResults();
    }

    // О determining, с какой стороны компонента находится пин (Top, Bottom, Left, Right)
    getPinDirectionVector(component, pinIndex) {
        const pin = component.pins[pinIndex];
        // Размеры "коробки" пинов (bounding box самих пинов, не корпуса)
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        component.pins.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });

        // Определяем допуски (что считать "краем")
        const tolerance = 10;

        // Вектор нормали: x=-1 (влево), x=1 (вправо), y=-1 (вверх), y=1 (вниз)
        if (Math.abs(pin.x - minX) < tolerance) return { x: -1, y: 0 }; // Пин слева
        if (Math.abs(pin.x - maxX) < tolerance) return { x: 1, y: 0 };  // Пин справа
        if (Math.abs(pin.y - minY) < tolerance) return { x: 0, y: -1 }; // Пин сверху
        if (Math.abs(pin.y - maxY) < tolerance) return { x: 0, y: 1 };  // Пин снизу

        return { x: 0, y: 0 }; // Пин где-то внутри или сложная форма
    }

    // Новый метод для детального логирования размещения
    logPlacementDetails(component, placement) {
        console.log(`\n🔍 ДЕТАЛИ РАЗМЕЩЕНИЯ ${component.name}:`);

        const connectionMatrix = this.buildWeightedConnectionMatrix();
        const placedComponents = this.components.filter(comp => this.isComponentPlaced(comp) && comp !== component);

        const pinPositions = this.calculatePinPositionsAfterPlacement(component, placement.position, placement.orientation);
        console.log(`  Позиции пинов после размещения:`);
        component.pins.forEach((pin, index) => {
            const pos = pinPositions[index];
            console.log(`    Пин ${pin.number} (${pin.name}): (${pos.col},${pos.row})`);
        });

        let totalWireLength = 0;
        let connectionDetails = [];

        placedComponents.forEach(placedComp => {
            const weight = connectionMatrix[component.id]?.[placedComp.id] || 0;
            if (weight > 0) {
                const pinPairs = this.findConnectedPinPairs(component, placedComp);

                pinPairs.forEach(pinPair => {
                    const pin1Pos = pinPositions[pinPair.pin1Index];
                    const pin2Pos = this.getActualPinPosition(placedComp, pinPair.pin2Index);

                    if (pin1Pos && pin2Pos) {
                        const distance = this.calculateManhattanDistance(pin1Pos, pin2Pos);
                        const weightedDistance = weight * distance;
                        totalWireLength += weightedDistance;

                        connectionDetails.push({
                            target: placedComp.name,
                            pin1: component.pins[pinPair.pin1Index].name,
                            pin2: placedComp.pins[pinPair.pin2Index].name,
                            weight: weight,
                            distance: distance,
                            weightedDistance: weightedDistance
                        });
                    }
                });
            }
        });

        console.log(`  Соединения с размещенными компонентами:`);
        connectionDetails.forEach(detail => {
            console.log(`    → ${detail.target}: пин ${detail.pin1}-${detail.pin2}, вес=${detail.weight}, расстояние=${detail.distance}, взвешенное=${detail.weightedDistance.toFixed(1)}`);
        });

        console.log(`  Общая взвешенная длина: ${totalWireLength.toFixed(1)}`);
        console.log(`  Средняя F-оценка: ${placement.score.toFixed(2)}`);
    }

    // Улучшенный метод для отображения результатов
    showDetailedPlacementResults() {
        const placedComponents = this.components.filter(comp => this.isComponentPlaced(comp));
        const unplacedComponents = this.getUnplacedComponents();
        const totalConnections = this.calculateTotalConnections();
        const totalWireLength = this.estimateTotalWireLength();

        console.log('\n📈 ИТОГОВЫЕ РЕЗУЛЬТАТЫ РАЗМЕЩЕНИЯ:');
        console.log(`✅ Размещено компонентов: ${placedComponents.length}/${this.components.length}`);
        console.log(`❌ Не размещено: ${unplacedComponents.length}`);
        console.log(`🔗 Общее количество связей: ${totalConnections}`);
        console.log(`📏 Оценочная общая длина соединений: ${totalWireLength.toFixed(1)} усл. ед.`);

        if (unplacedComponents.length > 0) {
            console.log('\n⚠️ НЕ РАЗМЕЩЕННЫЕ КОМПОНЕНТЫ:');
            unplacedComponents.forEach(comp => {
                console.log(`   • ${comp.name} (${comp.reference})`);
            });
        }

        console.log('\n🗺️ РАЗМЕЩЕНИЕ КОМПОНЕНТОВ НА СЕТКЕ:');
        placedComponents.forEach(comp => {
            const pos = this.findComponentPosition(comp);
            if (pos && comp.gridPosition) {
                console.log(`   ${comp.name} (${comp.reference}): позиция (${pos.col},${pos.row}), размер ${comp.gridPosition.width}×${comp.gridPosition.height}, ориентация ${comp.rotation}°`);
            }
        });

        // Анализ качества размещения
        this.analyzePlacementQuality();
    }

    // Новый метод для анализа качества размещения
    analyzePlacementQuality() {
        console.log('\n📊 АНАЛИЗ КАЧЕСТВА РАЗМЕЩЕНИЯ:');

        const connectionMatrix = this.buildWeightedConnectionMatrix();
        let totalWeightedDistance = 0;
        let totalConnections = 0;
        let connectionStats = [];

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
                        const weightedDistance = weight * distance;
                        totalWeightedDistance += weightedDistance;
                        totalConnections += weight;

                        connectionStats.push({
                            comp1: comp1.name,
                            comp2: comp2.name,
                            weight: weight,
                            distance: distance,
                            weightedDistance: weightedDistance
                        });
                    }
                }
            }
        }

        const averageDistance = totalConnections > 0 ? totalWeightedDistance / totalConnections : 0;

        console.log(`   Средняя взвешенная длина соединения: ${averageDistance.toFixed(2)}`);
        console.log(`   Общая взвешенная длина: ${totalWeightedDistance.toFixed(1)}`);

        // Топ-5 самых длинных соединений
        const longestConnections = connectionStats.sort((a, b) => b.weightedDistance - a.weightedDistance).slice(0, 5);
        console.log('   🏆 ТОП-5 САМЫХ ДЛИННЫХ СОЕДИНЕНИЙ:');
        longestConnections.forEach((conn, index) => {
            console.log(`     ${index + 1}. ${conn.comp1} ↔ ${conn.comp2}: вес=${conn.weight}, расстояние=${conn.distance}, взвешенное=${conn.weightedDistance.toFixed(1)}`);
        });
    }

    // Обновляем метод расчета F-оценок с логированием
    calculateImprovedFScores(component, neighborPositions) {
        const connectionMatrix = this.buildWeightedConnectionMatrix();
        const placedComponents = this.components.filter(comp => this.isComponentPlaced(comp));
        const fScores = [];

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

    calculateImprovedJScores(unplacedComponents) {
        const connectionMatrix = this.buildWeightedConnectionMatrix();
        const placedComponents = this.components.filter(comp => this.isComponentPlaced(comp));

        return unplacedComponents.map(component => {
            let sumConnectionsToPlaced = 0;
            let sumConnectionsToUnplaced = 0;

            placedComponents.forEach(placedComp => {
                const weight = connectionMatrix[component.id]?.[placedComp.id] || 0;
                sumConnectionsToPlaced += weight;
            });

            unplacedComponents.forEach(unplacedComp => {
                if (unplacedComp !== component) {
                    const weight = connectionMatrix[component.id]?.[unplacedComp.id] || 0;
                    sumConnectionsToUnplaced += weight;
                }
            });

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

    calculateImprovedFScores(component, neighborPositions) {
        const connectionMatrix = this.buildWeightedConnectionMatrix();
        const placedComponents = this.components.filter(comp => this.isComponentPlaced(comp));
        const fScores = [];

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

    calculateFScoreWithRealPinDistances(component, position, orientation, connectionMatrix, placedComponents) {
        let score = 0;
        let connectionCount = 0;

        const tempPinPositions = this.calculatePinPositionsAfterPlacement(component, position, orientation);

        placedComponents.forEach(placedComp => {
            const weight = connectionMatrix[component.id]?.[placedComp.id] || 0;
            if (weight > 0) {
                const pinPairs = this.findConnectedPinPairs(component, placedComp);

                pinPairs.forEach(pinPair => {
                    // 1. Базовая длина провода (Манхэттен)
                    const pin1Pos = tempPinPositions[pinPair.pin1Index]; // Наш новый компонент
                    const pin2Pos = this.getActualPinPosition(placedComp, pinPair.pin2Index); // Куда подключаемся

                    if (pin1Pos && pin2Pos) {
                        let distance = this.calculateManhattanDistance(pin1Pos, pin2Pos);

                        // --- НОВАЯ ЛОГИКА: Учет направления пина ---

                        // Получаем вектор, куда "смотрит" пин размещенного компонента
                        // Учитываем вращение размещенного компонента!
                        const pinNormal = this.getRotatedPinDirection(placedComp, pinPair.pin2Index);

                        // Вектор от пина к новому компоненту
                        const dx = pin1Pos.x - pin2Pos.x;
                        const dy = pin1Pos.y - pin2Pos.y;

                        // Скалярное произведение: > 0 значит "перед пином", < 0 "за пином"
                        const dotProduct = (dx * pinNormal.x) + (dy * pinNormal.y);

                        if (dotProduct > 0) {
                            // ИДЕАЛЬНО: компонент находится там, куда смотрит пин
                            distance *= 0.5; // Бонус: уменьшаем "стоимость" расстояния в 2 раза
                        } else if (dotProduct < 0) {
                            // ПЛОХО: компонент "за спиной" у пина
                            distance *= 2.0; // Штраф
                        } else {
                            // СБОКУ
                            distance *= 1.2;
                        }

                        // --- НОВАЯ ЛОГИКА: Выравнивание (Alignment) ---
                        // Если это резистор (2 пина), он должен быть параллелен вектору связи

                        if (component.pins.length === 2) {
                            // Вектор связи
                            const linkDx = Math.abs(pin1Pos.x - pin2Pos.x);
                            const linkDy = Math.abs(pin1Pos.y - pin2Pos.y);

                            const isHorizontalLink = linkDx > linkDy;
                            const isVerticalLink = linkDy > linkDx;

                            const isHorizontalComp = (orientation === 0 || orientation === 180);
                            const isVerticalComp = (orientation === 90 || orientation === 270);

                            // Если связь горизонтальная, а компонент вертикальный -> штраф
                            if (isHorizontalLink && !isHorizontalComp) distance += 200; // Штраф в пикселях/единицах
                            // Если связь вертикальная, а компонент горизонтальный -> штраф
                            if (isVerticalLink && !isVerticalComp) distance += 200;
                        }

                        score += weight * distance;
                        connectionCount++;
                    }
                });
            }
        });

        if (connectionCount === 0) return 1000;
        return score / connectionCount;
    }

    // Вспомогательный метод для учета вращения вектора нормали
    getRotatedPinDirection(component, pinIndex) {
        const localDir = this.getPinDirectionVector(component, pinIndex);
        const rotation = component.rotation || 0;

        // Простое вращение вектора на 0, 90, 180, 270
        if (rotation === 0) return localDir;
        if (rotation === 90) return { x: -localDir.y, y: localDir.x };
        if (rotation === 180) return { x: -localDir.x, y: -localDir.y };
        if (rotation === 270) return { x: localDir.y, y: -localDir.x };
        return localDir;
    }

    calculatePinPositionsAfterPlacement(component, position, orientation) {
        const pinPositions = [];
        const centerX = position.x + (this.componentGridPositions.get(component)?.width * this.baseGridSize || 0) / 2;
        const centerY = position.y + (this.componentGridPositions.get(component)?.height * this.baseGridSize || 0) / 2;

        const radians = orientation * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);

        component.pins.forEach(pin => {
            const rotatedX = pin.x * cos - pin.y * sin;
            const rotatedY = pin.x * sin + pin.y * cos;

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

    getActualPinPosition(component, pinIndex) {
        if (!component.pins || !component.pins[pinIndex]) return null;

        const pin = component.pins[pinIndex];
        const centerX = component.x;
        const centerY = component.y;
        const orientation = component.rotation || 0;

        const radians = orientation * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);

        const rotatedX = pin.x * cos - pin.y * sin;
        const rotatedY = pin.x * sin + pin.y * cos;

        return {
            x: centerX + rotatedX,
            y: centerY + rotatedY,
            col: Math.round((centerX + rotatedX) / this.baseGridSize),
            row: Math.round((centerY + rotatedY) / this.baseGridSize)
        };
    }

    findConnectedPinPairs(comp1, comp2) {
        const pairs = [];

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

    canPlaceComponentWithOrientation(component, startPosition, orientation) {
        const compConfig = this.componentGridPositions.get(component);
        if (!compConfig) return false;

        let width = compConfig.width;
        let height = compConfig.height;

        if (orientation === 90 || orientation === 270) {
            [width, height] = [height, width];
        }

        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const targetCol = startPosition.col + col;
                const targetRow = startPosition.row + row;

                const gridPos = this.findGridPosition(targetCol, targetRow);
                if (!gridPos || gridPos.occupied) {
                    return false;
                }
            }
        }
        return true;
    }

    placeComponentWithOrientation(component, startPosition, orientation) {
        const compConfig = this.componentGridPositions.get(component);
        if (!compConfig || !startPosition) return false;

        let width = compConfig.width;
        let height = compConfig.height;

        const oldOrientation = component.rotation || 0;
        const rotationDelta = orientation - oldOrientation;

        if (orientation === 90 || orientation === 270) {
            [width, height] = [height, width];
        }

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

        component.x = startPosition.x + (width * this.baseGridSize) / 2;
        component.y = startPosition.y + (height * this.baseGridSize) / 2;
        component.rotation = orientation;

        this.updatePinPositionsForRotation(component, rotationDelta);

        component.gridPosition = {
            startCol: startPosition.col,
            startRow: startPosition.row,
            width: width,
            height: height,
            orientation: orientation
        };

        return true;
    }

    updatePinPositionsForRotation(component, rotationDelta) {
        if (!component.pins || rotationDelta === 0) return;

        const radians = rotationDelta * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);

        component.pins.forEach(pin => {
            const oldX = pin.x;
            const oldY = pin.y;

            pin.x = oldX * cos - oldY * sin;
            pin.y = oldX * sin + oldY * cos;

            pin.x = Math.round(pin.x);
            pin.y = Math.round(pin.y);
        });

        console.log(`Обновлены позиции пинов для ${component.name} после вращения на ${rotationDelta}°`);
    }

    getExtendedNeighborPositions() {
        const neighborPositions = new Set();
        const occupiedPositions = this.placementGrid.filter(pos => pos.occupied);

        occupiedPositions.forEach(occupiedPos => {
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

        if (neighborPositions.size === 0) {
            return this.placementGrid.filter(pos => !pos.occupied);
        }

        return Array.from(neighborPositions);
    }

    placeRemainingComponentsWithOptimization() {
        const unplacedComponents = this.getUnplacedComponents();
        console.log(`Оптимизированное размещение оставшихся ${unplacedComponents.length} компонентов`);

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

    finalizePlacement() {
        console.log('Финальная оптимизация размещения...');
        this.render();
        this.showPlacementResults();
        alert('Размещение завершено! Проверьте результат и при необходимости выполните ручную корректировку.');
    }

    highlightCurrentPlacement(component, step) {
        console.log(`Шаг ${step}: Размещен ${component.name}`);
        this.render();
    }

    // Вспомогательные методы для алгоритма
    getUnplacedComponents() {
        return this.components.filter(comp => !this.isComponentPlaced(comp));
    }

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

    calculateManhattanDistance(pos1, pos2) {
        if (!pos1 || !pos2) return Infinity;
        return Math.abs(pos1.col - pos2.col) + Math.abs(pos1.row - pos2.row);
    }

    // Методы для работы с сеткой размещения
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

    findAnyFreePositionForLargeComponent(component) {
        const centerPosition = this.findCenterPosition();
        if (centerPosition && this.canPlaceComponent(component, centerPosition)) {
            return centerPosition;
        }

        const spiralPositions = this.generateSpiralSearchOrder();
        for (const position of spiralPositions) {
            if (this.canPlaceComponent(component, position)) {
                return position;
            }
        }

        for (const position of this.placementGrid) {
            if (this.canPlaceComponent(component, position)) {
                return position;
            }
        }

        return null;
    }

    findAnyFreePosition(component) {
        for (const position of this.placementGrid) {
            if (this.canPlaceComponent(component, position)) {
                return position;
            }
        }
        return this.placementGrid[0];
    }

    togglePlacementGrid() {
        this.showPlacementGrid = !this.showPlacementGrid;
        this.render();
    }

    findCenterPosition() {
        const centerCol = Math.floor(this.getGridColumns() / 2);
        const centerRow = Math.floor(this.getGridRows() / 2);
        return this.findGridPosition(centerCol, centerRow);
    }

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

    calculateGridDistance(comp1, position1, comp2) {
        const pos2 = this.findComponentPosition(comp2);
        if (!pos2) return Infinity;

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

    // Создание и управление сеткой размещения
    createPlacementGrid() {
        if (this.components.length === 0) {
            alert('Нет компонентов для размещения');
            return;
        }

        console.log('=== СОЗДАНИЕ СЕТКИ ПОЗИЦИЙ ===');
        console.log(`Компонентов: ${this.components.length}`);

        this.calculateBaseGridSize();
        this.generateGridPositions();

        this.showPlacementGrid = true;
        this.render();
        this.showGridStats();
    }

    calculateBaseGridSize() {
        if (this.components.length === 0) {
            this.baseGridSize = 50;
            return;
        }

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

        this.baseGridSize = Math.max(40, minSize + 20);
    }

    generateGridPositions() {
        this.placementGrid = [];
        this.componentGridPositions = new Map();

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

        this.baseGridSize = Math.max(40, minSize + 20);
        console.log(`Базовый элемент: ${minComponent.name}, размер: ${minSize}px, размер позиции: ${this.baseGridSize}px`);

        let totalPositionsNeeded = 0;

        this.components.forEach(comp => {
            const dimensions = this.getComponentDimensions(comp);
            const widthInPositions = Math.max(1, Math.ceil(dimensions.width / this.baseGridSize));
            const heightInPositions = Math.max(1, Math.ceil(dimensions.height / this.baseGridSize));
            const areaInPositions = widthInPositions * heightInPositions;

            totalPositionsNeeded += areaInPositions;

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

        const gridSide = Math.ceil(Math.sqrt(totalPositionsNeeded * 1.2));
        const gridCols = Math.max(8, gridSide);
        const gridRows = Math.max(6, gridSide);

        console.log(`Создаем сетку: ${gridCols}×${gridRows} = ${gridCols * gridRows} позиций`);

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

    generatePositionConfigurations(width, height) {
        const configs = [];
        configs.push({
            type: 'rectangle',
            positions: this.generateRectanglePositions(width, height),
            width: width,
            height: height
        });
        return configs;
    }

    generateRectanglePositions(width, height) {
        const positions = [];
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                positions.push({ col, row });
            }
        }
        return positions;
    }

    canPlaceComponent(component, startPosition) {
        const compConfig = this.componentGridPositions.get(component);
        if (!compConfig) return false;

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

    placeComponent(component, startPosition) {
        const compConfig = this.componentGridPositions.get(component);
        if (!compConfig || !startPosition) return false;

        const mainConfig = compConfig.positionConfigs[0];

        for (const relativePos of mainConfig.positions) {
            const targetCol = startPosition.col + relativePos.col;
            const targetRow = startPosition.row + relativePos.row;

            const gridPos = this.findGridPosition(targetCol, targetRow);
            if (gridPos) {
                gridPos.occupied = true;
                gridPos.component = component;
            }
        }

        component.x = startPosition.x + (compConfig.width * this.baseGridSize) / 2;
        component.y = startPosition.y + (compConfig.height * this.baseGridSize) / 2;

        component.gridPosition = {
            startCol: startPosition.col,
            startRow: startPosition.row,
            width: compConfig.width,
            height: compConfig.height
        };

        return true;
    }

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

    getComponentDimensions(component) {
        if (component.dimensions) {
            return component.dimensions;
        }
        return this.estimateComponentDimensions(component);
    }

    showGridStats() {
        const totalPositions = this.placementGrid.length;
        const occupiedPositions = this.placementGrid.filter(pos => pos.occupied).length;
        const freePositions = totalPositions - occupiedPositions;

        console.log(`Статистика сетки: ${occupiedPositions} занято, ${freePositions} свободно из ${totalPositions} позиций`);
    }

    renderPlacementGrid() {
        if (!this.showPlacementGrid) return;

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        this.ctx.fillStyle = 'rgba(30, 30, 30, 0.3)';
        this.ctx.fillRect(
            this.placementGrid[0]?.x || 100,
            this.placementGrid[0]?.y || 100,
            this.getGridColumns() * this.baseGridSize,
            this.getGridRows() * this.baseGridSize
        );

        this.placementGrid.forEach(position => {
            if (position.occupied) {
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
                const gradient = this.ctx.createLinearGradient(
                    position.x, position.y,
                    position.x + this.baseGridSize, position.y + this.baseGridSize
                );
                gradient.addColorStop(0, 'rgba(46, 204, 113, 0.3)');
                gradient.addColorStop(1, 'rgba(39, 174, 96, 0.1)');
                this.ctx.fillStyle = gradient;
            }

            this.ctx.fillRect(position.x, position.y, this.baseGridSize, this.baseGridSize);

            this.ctx.strokeStyle = position.occupied ? 'rgba(231, 76, 60, 0.9)' : 'rgba(46, 204, 113, 0.7)';
            this.ctx.lineWidth = position.occupied ? 2.5 : 1.5;
            this.ctx.setLineDash([]);

            this.ctx.strokeRect(position.x, position.y, this.baseGridSize, this.baseGridSize);

            this.ctx.strokeStyle = position.occupied ? 'rgba(231, 76, 60, 0.6)' : 'rgba(46, 204, 113, 0.4)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(position.x, position.y);
            this.ctx.lineTo(position.x + 8, position.y);
            this.ctx.moveTo(position.x, position.y);
            this.ctx.lineTo(position.x, position.y + 8);
            this.ctx.moveTo(position.x + this.baseGridSize, position.y);
            this.ctx.lineTo(position.x + this.baseGridSize - 8, position.y);
            this.ctx.moveTo(position.x + this.baseGridSize, position.y);
            this.ctx.lineTo(position.x + this.baseGridSize, position.y + 8);
            this.ctx.moveTo(position.x, position.y + this.baseGridSize);
            this.ctx.lineTo(position.x + 8, position.y + this.baseGridSize);
            this.ctx.moveTo(position.x, position.y + this.baseGridSize);
            this.ctx.lineTo(position.x, position.y + this.baseGridSize - 8);
            this.ctx.moveTo(position.x + this.baseGridSize, position.y + this.baseGridSize);
            this.ctx.lineTo(position.x + this.baseGridSize - 8, position.y + this.baseGridSize);
            this.ctx.moveTo(position.x + this.baseGridSize, position.y + this.baseGridSize);
            this.ctx.lineTo(position.x + this.baseGridSize, position.y + this.baseGridSize - 8);
            this.ctx.stroke();

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

                this.ctx.shadowColor = 'transparent';
                this.ctx.shadowBlur = 0;
                this.ctx.shadowOffsetX = 0;
                this.ctx.shadowOffsetY = 0;
            }
        });

        this.drawMajorGridLines();
        this.ctx.restore();
    }

    drawMajorGridLines() {
        if (this.placementGrid.length === 0) return;

        const gridCols = this.getGridColumns();
        const gridRows = this.getGridRows();
        const firstPos = this.placementGrid[0];

        if (!firstPos) return;

        this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.4)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([8, 4]);

        for (let col = 0; col <= gridCols; col += 5) {
            const x = firstPos.x + col * this.baseGridSize;
            this.ctx.beginPath();
            this.ctx.moveTo(x, firstPos.y);
            this.ctx.lineTo(x, firstPos.y + gridRows * this.baseGridSize);
            this.ctx.stroke();
        }

        for (let row = 0; row <= gridRows; row += 5) {
            const y = firstPos.y + row * this.baseGridSize;
            this.ctx.beginPath();
            this.ctx.moveTo(firstPos.x, y);
            this.ctx.lineTo(firstPos.x + gridCols * this.baseGridSize, y);
            this.ctx.stroke();
        }

        this.ctx.setLineDash([]);
    }
}

// Класс для графического редактора символов
class SymbolEditor {
    constructor() {
        this.canvas = document.getElementById('symbolCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.previewCanvas = document.getElementById('previewCanvas');
        this.previewCtx = this.previewCanvas.getContext('2d');

        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        this.elements = [];
        this.pins = [];
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

        this.gridSize = 20;
        this.snapToGrid = true;

        this.scale = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;

        this.setupEventListeners();
        this.render();

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

    calculateDimensions() {
        if (this.elements.length === 0 && this.pins.length === 0) {
            return { width: 0, height: 0 };
        }

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

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

        this.pins.forEach(pin => {
            minX = Math.min(minX, pin.x - 5);
            maxX = Math.max(maxX, pin.x + 5);
            minY = Math.min(minY, pin.y - 5);
            maxY = Math.max(maxY, pin.y + 5);
        });

        if (minX === Infinity && this.pins.length > 0) {
            this.pins.forEach(pin => {
                minX = Math.min(minX, pin.x);
                maxX = Math.max(maxX, pin.x);
                minY = Math.min(minY, pin.y);
                maxY = Math.max(maxY, pin.y);
            });
        }

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
        if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
        }
        else if (e.ctrlKey && e.key.toLowerCase() === 'z' && e.shiftKey) {
            e.preventDefault();
            this.redo();
        }
        else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            this.redo();
        }
    }

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
                    this.currentElement.points[1] = { x: x, y: this.startY };
                } else {
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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const { cx, cy } = this.getCenter();
        this.ctx.save();
        this.ctx.translate(cx, cy);

        this.renderGrid();

        this.elements.forEach(element => {
            this.renderElement(element);
        });

        if (this.currentElement) {
            this.renderElement(this.currentElement);
        }

        this.renderPins();

        if (this.selectedElement) {
            this.ctx.strokeStyle = '#e74c3c';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.renderElement(this.selectedElement);
            this.ctx.setLineDash([]);
        }

        if (this.isDrawing && this.currentTool === 'line' && this.currentElement && this.currentElement.points[1]) {
            this.renderLineHelper();
        }

        this.ctx.restore();
    }

    renderGrid() {
        const { cx, cy } = this.getCenter();

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

        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 2;

        this.ctx.beginPath();
        this.ctx.moveTo(-cx, 0);
        this.ctx.lineTo(cx, 0);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(0, -cy);
        this.ctx.lineTo(0, cy);
        this.ctx.stroke();

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
        const current = {
            elements: JSON.stringify(this.elements),
            pins: JSON.stringify(this.pins)
        };

        const last = this.history[this.historyIndex];
        if (last && last.elements === current.elements && last.pins === current.pins) {
            return;
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

// Глобальные переменные и функции
let editor;
let symbolEditor;

document.addEventListener('DOMContentLoaded', () => {
    editor = new KiCadWebEditor();
});

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

    componentData.id = `custom_${Date.now()}`;

    console.log('Saving component:', componentData);

    const result = await editor.saveCustomComponent(componentData);
    if (result) {
        closeSymbolEditor();
        alert('✅ Компонент успешно создан!');

        await editor.loadLibraries();

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

window.addEventListener('click', (event) => {
    const modal = document.getElementById('symbolEditorModal');
    if (event.target === modal) {
        closeSymbolEditor();
    }
});