/**
 * Волновой алгоритм Lee для трассировки дорожек на PCB
 */

import {
  PCBBoard,
  PlacedComponent,
  Trace,
  Net,
  Netlist,
  RoutingGrid,
  RoutingOptions,
  RoutingResult,
  Point
} from '../types/pcb'

// Константы для сетки
const CELL_EMPTY = 0
const CELL_OBSTACLE = -1
const CELL_TARGET = -2

/**
 * Создает сетку трассировки с препятствиями
 */
export function createRoutingGrid(
  board: PCBBoard,
  gridSize: number,
  clearance: number
): RoutingGrid {
  const gridWidth = Math.ceil(board.width / gridSize)
  const gridHeight = Math.ceil(board.height / gridSize)

  // Инициализируем пустую сетку
  const cells: number[][] = Array(gridHeight)
    .fill(null)
    .map(() => Array(gridWidth).fill(CELL_EMPTY))

  // Помечаем препятствия от компонентов
  for (const component of board.components) {
    markComponentAsObstacle(cells, component, gridSize, clearance)
  }

  // Помечаем препятствия от существующих дорожек
  for (const trace of board.traces) {
    markTraceAsObstacle(cells, trace, gridSize, clearance)
  }

  return {
    width: gridWidth,
    height: gridHeight,
    cellSize: gridSize,
    cells
  }
}

/**
 * Помечает компонент как препятствие на сетке
 */
function markComponentAsObstacle(
  cells: number[][],
  component: PlacedComponent,
  gridSize: number,
  clearance: number
): void {
  const { position, footprint, rotation } = component

  // Используем courtyard или размеры корпуса + clearance
  const halfW = footprint.width / 2 + clearance
  const halfH = footprint.height / 2 + clearance

  // Для повернутых компонентов используем большую границу
  const maxHalf = Math.max(halfW, halfH)

  const minGridX = Math.floor((position.x - maxHalf) / gridSize)
  const maxGridX = Math.ceil((position.x + maxHalf) / gridSize)
  const minGridY = Math.floor((position.y - maxHalf) / gridSize)
  const maxGridY = Math.ceil((position.y + maxHalf) / gridSize)

  for (let gy = minGridY; gy <= maxGridY; gy++) {
    for (let gx = minGridX; gx <= maxGridX; gx++) {
      if (gy >= 0 && gy < cells.length && gx >= 0 && gx < cells[0].length) {
        cells[gy][gx] = CELL_OBSTACLE
      }
    }
  }

  // Освобождаем ячейки площадок (к ним нужно подключаться)
  for (const pad of footprint.pads) {
    const padX = position.x + pad.position.x * Math.cos(rotation * Math.PI / 180) 
                           - pad.position.y * Math.sin(rotation * Math.PI / 180)
    const padY = position.y + pad.position.x * Math.sin(rotation * Math.PI / 180) 
                           + pad.position.y * Math.cos(rotation * Math.PI / 180)
    
    const gx = Math.round(padX / gridSize)
    const gy = Math.round(padY / gridSize)
    
    if (gy >= 0 && gy < cells.length && gx >= 0 && gx < cells[0].length) {
      cells[gy][gx] = CELL_EMPTY
    }
  }
}

/**
 * Помечает дорожку как препятствие на сетке
 */
function markTraceAsObstacle(
  cells: number[][],
  trace: Trace,
  gridSize: number,
  clearance: number
): void {
  if (trace.points.length < 2) return

  const halfWidth = trace.width / 2 + clearance

  for (let i = 0; i < trace.points.length - 1; i++) {
    const p1 = trace.points[i]
    const p2 = trace.points[i + 1]

    // Растеризуем линию на сетке
    const steps = Math.max(
      Math.abs(p2.x - p1.x) / gridSize,
      Math.abs(p2.y - p1.y) / gridSize
    ) * 2

    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const x = p1.x + (p2.x - p1.x) * t
      const y = p1.y + (p2.y - p1.y) * t

      // Помечаем область вокруг точки
      const minGx = Math.floor((x - halfWidth) / gridSize)
      const maxGx = Math.ceil((x + halfWidth) / gridSize)
      const minGy = Math.floor((y - halfWidth) / gridSize)
      const maxGy = Math.ceil((y + halfWidth) / gridSize)

      for (let gy = minGy; gy <= maxGy; gy++) {
        for (let gx = minGx; gx <= maxGx; gx++) {
          if (gy >= 0 && gy < cells.length && gx >= 0 && gx < cells[0].length) {
            if (cells[gy][gx] !== CELL_TARGET) {
              cells[gy][gx] = CELL_OBSTACLE
            }
          }
        }
      }
    }
  }
}

/**
 * Конвертирует координаты платы в координаты сетки
 */
function boardToGrid(point: Point, gridSize: number): { gx: number; gy: number } {
  return {
    gx: Math.round(point.x / gridSize),
    gy: Math.round(point.y / gridSize)
  }
}

/**
 * Конвертирует координаты сетки в координаты платы
 */
function gridToBoard(gx: number, gy: number, gridSize: number): Point {
  return {
    x: gx * gridSize,
    y: gy * gridSize
  }
}

/**
 * Волновой алгоритм Lee
 * Находит кратчайший путь от start до end на сетке
 */
export function leeAlgorithm(
  grid: RoutingGrid,
  start: Point,
  end: Point
): Point[] | null {
  const { width, height, cellSize, cells } = grid

  // Копируем сетку для работы
  const workCells = cells.map(row => [...row])

  // Конвертируем координаты
  const startGrid = boardToGrid(start, cellSize)
  const endGrid = boardToGrid(end, cellSize)

  // Проверяем границы
  if (
    startGrid.gx < 0 || startGrid.gx >= width ||
    startGrid.gy < 0 || startGrid.gy >= height ||
    endGrid.gx < 0 || endGrid.gx >= width ||
    endGrid.gy < 0 || endGrid.gy >= height
  ) {
    return null
  }

  // Проверяем, что начало и конец не заблокированы
  if (workCells[startGrid.gy][startGrid.gx] === CELL_OBSTACLE) {
    return null
  }
  if (workCells[endGrid.gy][endGrid.gx] === CELL_OBSTACLE) {
    return null
  }

  // Помечаем цель
  workCells[endGrid.gy][endGrid.gx] = CELL_TARGET

  // Очередь для BFS
  const queue: Array<{ gx: number; gy: number; wave: number }> = []
  queue.push({ gx: startGrid.gx, gy: startGrid.gy, wave: 1 })
  workCells[startGrid.gy][startGrid.gx] = 1

  // Направления движения (4-связность)
  const directions = [
    { dx: 0, dy: -1 },  // вверх
    { dx: 1, dy: 0 },   // вправо
    { dx: 0, dy: 1 },   // вниз
    { dx: -1, dy: 0 }   // влево
  ]

  // Расширение волны
  let found = false
  while (queue.length > 0 && !found) {
    const current = queue.shift()!
    const nextWave = current.wave + 1

    for (const dir of directions) {
      const nx = current.gx + dir.dx
      const ny = current.gy + dir.dy

      // Проверяем границы
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue

      // Проверяем, достигли ли цели
      if (workCells[ny][nx] === CELL_TARGET) {
        workCells[ny][nx] = nextWave
        found = true
        break
      }

      // Проверяем, можно ли перейти в ячейку
      if (workCells[ny][nx] === CELL_EMPTY) {
        workCells[ny][nx] = nextWave
        queue.push({ gx: nx, gy: ny, wave: nextWave })
      }
    }
  }

  if (!found) {
    return null
  }

  // Обратный проход - восстановление пути
  const path: Point[] = []
  let currentX = endGrid.gx
  let currentY = endGrid.gy
  let currentWave = workCells[currentY][currentX]

  path.unshift(gridToBoard(currentX, currentY, cellSize))

  while (currentWave > 1) {
    for (const dir of directions) {
      const nx = currentX + dir.dx
      const ny = currentY + dir.dy

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue

      if (workCells[ny][nx] === currentWave - 1) {
        currentX = nx
        currentY = ny
        currentWave--
        path.unshift(gridToBoard(currentX, currentY, cellSize))
        break
      }
    }
  }

  return path
}

/**
 * Получает позицию пина компонента
 */
function getPinPosition(
  componentRef: string,
  pinNumber: string,
  components: PlacedComponent[]
): Point | null {
  const component = components.find(c => c.reference === componentRef)
  if (!component) return null

  const pad = component.footprint.pads.find(p => p.number === pinNumber)
  if (!pad) return null

  const rad = (component.rotation * Math.PI) / 180
  const rotX = pad.position.x * Math.cos(rad) - pad.position.y * Math.sin(rad)
  const rotY = pad.position.x * Math.sin(rad) + pad.position.y * Math.cos(rad)

  return {
    x: component.position.x + rotX,
    y: component.position.y + rotY
  }
}

/**
 * Трассирует одну цепь
 */
export function routeNet(
  net: Net,
  board: PCBBoard,
  options: RoutingOptions,
  existingTraces: Trace[] = []
): Trace | null {
  if (net.pins.length < 2) return null

  // Создаем сетку с существующими препятствиями
  const tempBoard = { ...board, traces: [...board.traces, ...existingTraces] }
  const grid = createRoutingGrid(tempBoard, options.gridSize, options.clearance)

  // Получаем позиции всех пинов
  const pinPositions: Point[] = []
  for (const pin of net.pins) {
    const pos = getPinPosition(pin.componentRef, pin.pinNumber, board.components)
    if (pos) {
      pinPositions.push(pos)
    }
  }

  if (pinPositions.length < 2) return null

  // Трассируем от первого пина к остальным (минимальное остовное дерево)
  const allPoints: Point[] = []
  const connected = [pinPositions[0]]
  const remaining = pinPositions.slice(1)

  while (remaining.length > 0) {
    let bestPath: Point[] | null = null
    let bestLength = Infinity
    let bestRemainingIdx = -1

    // Находим ближайший несвязанный пин
    for (let i = 0; i < remaining.length; i++) {
      for (const connectedPin of connected) {
        const path = leeAlgorithm(grid, connectedPin, remaining[i])
        if (path && path.length < bestLength) {
          bestPath = path
          bestLength = path.length
          bestRemainingIdx = i
        }
      }
    }

    if (!bestPath || bestRemainingIdx === -1) {
      // Не удалось найти путь
      break
    }

    // Добавляем путь
    allPoints.push(...bestPath)
    
    // Помечаем путь как препятствие для следующих трасс
    markPathAsObstacle(grid.cells, bestPath, options.gridSize, options.traceWidth / 2 + options.clearance)

    // Перемещаем пин в connected
    connected.push(remaining[bestRemainingIdx])
    remaining.splice(bestRemainingIdx, 1)
  }

  if (allPoints.length < 2) return null

  // Оптимизируем путь (удаляем промежуточные точки на прямой)
  const optimizedPoints = optimizePath(allPoints)

  return {
    id: `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    netName: net.name,
    points: optimizedPoints,
    width: options.traceWidth,
    layer: options.preferredLayers[0] || 'top-copper'
  }
}

/**
 * Помечает путь как препятствие
 */
function markPathAsObstacle(
  cells: number[][],
  path: Point[],
  gridSize: number,
  halfWidth: number
): void {
  for (const point of path) {
    const minGx = Math.floor((point.x - halfWidth) / gridSize)
    const maxGx = Math.ceil((point.x + halfWidth) / gridSize)
    const minGy = Math.floor((point.y - halfWidth) / gridSize)
    const maxGy = Math.ceil((point.y + halfWidth) / gridSize)

    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        if (gy >= 0 && gy < cells.length && gx >= 0 && gx < cells[0].length) {
          cells[gy][gx] = CELL_OBSTACLE
        }
      }
    }
  }
}

/**
 * Оптимизирует путь, удаляя лишние точки на прямой линии
 */
function optimizePath(path: Point[]): Point[] {
  if (path.length <= 2) return path

  const optimized: Point[] = [path[0]]

  for (let i = 1; i < path.length - 1; i++) {
    const prev = optimized[optimized.length - 1]
    const curr = path[i]
    const next = path[i + 1]

    // Проверяем, лежит ли точка на прямой между prev и next
    const dx1 = curr.x - prev.x
    const dy1 = curr.y - prev.y
    const dx2 = next.x - curr.x
    const dy2 = next.y - curr.y

    // Если направления разные, добавляем точку
    if (Math.sign(dx1) !== Math.sign(dx2) || Math.sign(dy1) !== Math.sign(dy2) ||
        (dx1 === 0 && dx2 !== 0) || (dx1 !== 0 && dx2 === 0) ||
        (dy1 === 0 && dy2 !== 0) || (dy1 !== 0 && dy2 === 0)) {
      optimized.push(curr)
    }
  }

  optimized.push(path[path.length - 1])
  return optimized
}

/**
 * Сортирует цепи по важности (длинные и сложные сначала)
 */
function sortNetsByPriority(nets: Net[], components: PlacedComponent[]): Net[] {
  return [...nets].sort((a, b) => {
    // Питание и земля имеют высший приоритет
    if (a.name === 'VCC' || a.name === 'GND') return -1
    if (b.name === 'VCC' || b.name === 'GND') return 1

    // Цепи с большим количеством пинов имеют более высокий приоритет
    return b.pins.length - a.pins.length
  })
}

/**
 * Автоматическая трассировка всех цепей
 */
export function autoRoute(
  board: PCBBoard,
  netlist: Netlist,
  options: RoutingOptions = {
    traceWidth: 0.25,
    clearance: 0.2,
    viaDiameter: 0.6,
    gridSize: 0.25,
    allowVias: true,
    preferredLayers: ['top-copper']
  }
): RoutingResult {
  const traces: Trace[] = []
  const unrouted: Net[] = []

  // Сортируем цепи по приоритету
  const sortedNets = sortNetsByPriority(netlist.nets, board.components)

  for (const net of sortedNets) {
    const trace = routeNet(net, board, options, traces)
    
    if (trace) {
      traces.push(trace)
    } else {
      unrouted.push(net)
    }
  }

  const totalNets = netlist.nets.length
  const routedNets = traces.length
  const completionRate = totalNets > 0 ? (routedNets / totalNets) * 100 : 100

  return {
    traces,
    unrouted,
    success: unrouted.length === 0,
    completionRate,
    message: unrouted.length === 0
      ? `Трассировка завершена. ${routedNets} цепей.`
      : `Трассировка: ${routedNets}/${totalNets} цепей (${completionRate.toFixed(1)}%). Не удалось: ${unrouted.map(n => n.name).join(', ')}`
  }
}

/**
 * Проверка правил проектирования (DRC)
 */
export function checkDesignRules(
  board: PCBBoard,
  options: RoutingOptions
): Array<{ type: string; message: string; position?: Point }> {
  const violations: Array<{ type: string; message: string; position?: Point }> = []

  // Проверка зазоров между дорожками
  for (let i = 0; i < board.traces.length; i++) {
    for (let j = i + 1; j < board.traces.length; j++) {
      const trace1 = board.traces[i]
      const trace2 = board.traces[j]

      // Пропускаем дорожки одной цепи
      if (trace1.netName === trace2.netName) continue

      // Проверяем минимальное расстояние между дорожками
      for (const p1 of trace1.points) {
        for (const p2 of trace2.points) {
          const dist = Math.sqrt(
            Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)
          )
          const minDist = (trace1.width + trace2.width) / 2 + options.clearance

          if (dist < minDist) {
            violations.push({
              type: 'clearance',
              message: `Нарушение зазора между ${trace1.netName} и ${trace2.netName}`,
              position: p1
            })
          }
        }
      }
    }
  }

  // Проверка зазоров между дорожками и компонентами
  for (const trace of board.traces) {
    for (const component of board.components) {
      // Проверяем расстояние до корпуса
      for (const point of trace.points) {
        const dx = Math.abs(point.x - component.position.x)
        const dy = Math.abs(point.y - component.position.y)
        
        const halfW = component.footprint.width / 2
        const halfH = component.footprint.height / 2
        
        if (dx < halfW + options.clearance && dy < halfH + options.clearance) {
          // Проверяем, не является ли это подключением к пину
          let isConnection = false
          for (const pad of component.footprint.pads) {
            const padX = component.position.x + pad.position.x
            const padY = component.position.y + pad.position.y
            const dist = Math.sqrt(Math.pow(point.x - padX, 2) + Math.pow(point.y - padY, 2))
            if (dist < pad.width / 2 + trace.width / 2) {
              isConnection = true
              break
            }
          }

          if (!isConnection) {
            violations.push({
              type: 'clearance',
              message: `Дорожка ${trace.netName} слишком близко к ${component.reference}`,
              position: point
            })
          }
        }
      }
    }
  }

  return violations
}

/**
 * Упрощенная автоматическая трассировка
 * Соединяет площадки компонентов прямыми линиями
 */
export function autoRouteSimple(
  board: PCBBoard,
  options: RoutingOptions
): RoutingResult {
  const traces: Trace[] = []

  if (board.components.length < 2) {
    return {
      traces: [],
      unrouted: [],
      success: false,
      completionRate: 0,
      message: 'Нужно минимум 2 компонента'
    }
  }

  // Соединяем пары компонентов
  for (let i = 0; i < board.components.length; i++) {
    for (let j = i + 1; j < board.components.length; j++) {
      const comp1 = board.components[i]
      const comp2 = board.components[j]

      // Находим ближайшие площадки
      let minDist = Infinity
      let pad1Pos: Point | null = null
      let pad2Pos: Point | null = null

      for (const pad1 of comp1.footprint.pads) {
        const p1 = getPadGlobalPosition(comp1, pad1)
        
        for (const pad2 of comp2.footprint.pads) {
          const p2 = getPadGlobalPosition(comp2, pad2)
          
          const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
          if (dist < minDist) {
            minDist = dist
            pad1Pos = p1
            pad2Pos = p2
          }
        }
      }

      if (pad1Pos && pad2Pos) {
        // Создаем дорожку с ортогональными сегментами
        const midX = (pad1Pos.x + pad2Pos.x) / 2
        
        const tracePoints: Point[] = [
          pad1Pos,
          { x: midX, y: pad1Pos.y },
          { x: midX, y: pad2Pos.y },
          pad2Pos
        ]

        traces.push({
          id: `trace-${Date.now()}-${i}-${j}`,
          netName: `${comp1.reference}-${comp2.reference}`,
          points: tracePoints,
          width: options.traceWidth,
          layer: options.preferredLayers[0] || 'top-copper'
        })
      }
    }
  }

  return {
    traces,
    unrouted: [],
    success: true,
    completionRate: 100,
    message: `Создано ${traces.length} дорожек`
  }
}

/**
 * Получает глобальную позицию площадки с учетом поворота компонента
 */
function getPadGlobalPosition(component: PlacedComponent, pad: { position: Point }): Point {
  const rad = (component.rotation * Math.PI) / 180
  const rotX = pad.position.x * Math.cos(rad) - pad.position.y * Math.sin(rad)
  const rotY = pad.position.x * Math.sin(rad) + pad.position.y * Math.cos(rad)
  
  return {
    x: component.position.x + rotX,
    y: component.position.y + rotY
  }
}
