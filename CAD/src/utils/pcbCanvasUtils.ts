/**
 * Утилиты отрисовки PCB на canvas
 */

import {
  PCBBoard,
  PlacedComponent,
  Footprint,
  Pad,
  Trace,
  Via,
  PCBLayer,
  Point,
  Netlist
} from '../types/pcb'

// Масштаб: мм в пиксели (увеличен для лучшей видимости)
const MM_TO_PX = 5

// Цвета по умолчанию
const COLORS = {
  board: '#1a472a',
  boardOutline: '#2d5a3d',
  grid: '#2d5a3d',
  gridMajor: '#3d6a4d',
  padCopper: '#b87333',
  padHighlight: '#ffcc00',
  traceTop: '#ff4444',
  traceBottom: '#4444ff',
  silkscreen: '#ffffff',
  via: '#888888',
  courtyard: 'rgba(255, 255, 0, 0.3)',
  selection: '#00ffff',
  reference: '#ffff00',
  value: '#00ffff'
}

/**
 * Конвертирует мм в пиксели
 */
export function mmToPx(mm: number): number {
  return mm * MM_TO_PX
}

/**
 * Конвертирует пиксели в мм
 */
export function pxToMm(px: number): number {
  return px / MM_TO_PX
}

/**
 * Отрисовка сетки PCB
 */
export function drawPCBGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gridSize: number,
  zoom: number,
  pan: Point,
  boardWidth: number,
  boardHeight: number
) {
  // gridSize в мм, преобразуем в пиксели на холсте
  const gridPx = mmToPx(gridSize)
  
  // Границы платы в пикселях
  const boardWidthPx = mmToPx(boardWidth)
  const boardHeightPx = mmToPx(boardHeight)

  ctx.strokeStyle = COLORS.grid
  ctx.lineWidth = 0.5 / zoom

  // Вертикальные линии
  for (let x = 0; x <= boardWidthPx; x += gridPx) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, boardHeightPx)
    ctx.stroke()
  }

  // Горизонтальные линии
  for (let y = 0; y <= boardHeightPx; y += gridPx) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(boardWidthPx, y)
    ctx.stroke()
  }

  // Главные линии сетки (каждые 5 клеток для лучшей видимости)
  ctx.strokeStyle = COLORS.gridMajor
  ctx.lineWidth = 1 / zoom
  const majorGridPx = gridPx * 5

  // Вертикальные главные линии
  for (let x = 0; x <= boardWidthPx; x += majorGridPx) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, boardHeightPx)
    ctx.stroke()
  }

  // Горизонтальные главные линии
  for (let y = 0; y <= boardHeightPx; y += majorGridPx) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(boardWidthPx, y)
    ctx.stroke()
  }
}

/**
 * Отрисовка контура платы
 */
export function drawBoardOutline(
  ctx: CanvasRenderingContext2D,
  board: PCBBoard
) {
  const widthPx = mmToPx(board.width)
  const heightPx = mmToPx(board.height)

  // Заливка платы
  ctx.fillStyle = COLORS.board
  ctx.fillRect(0, 0, widthPx, heightPx)

  // Контур платы
  ctx.strokeStyle = COLORS.boardOutline
  ctx.lineWidth = 2
  ctx.strokeRect(0, 0, widthPx, heightPx)

  // Если есть кастомный контур
  if (board.outline && board.outline.length > 2) {
    ctx.beginPath()
    ctx.moveTo(mmToPx(board.outline[0].x), mmToPx(board.outline[0].y))
    for (let i = 1; i < board.outline.length; i++) {
      ctx.lineTo(mmToPx(board.outline[i].x), mmToPx(board.outline[i].y))
    }
    ctx.closePath()
    ctx.stroke()
  }
}

/**
 * Отрисовка площадки (pad)
 */
export function drawPad(
  ctx: CanvasRenderingContext2D,
  pad: Pad,
  offsetX: number,
  offsetY: number,
  rotation: number,
  highlight: boolean = false,
  scale: number = 1
) {
  const x = mmToPx(pad.position.x) * scale
  const y = mmToPx(pad.position.y) * scale
  const w = mmToPx(pad.width) * scale
  const h = mmToPx(pad.height) * scale

  ctx.save()
  ctx.translate(offsetX, offsetY)
  ctx.rotate((rotation * Math.PI) / 180)

  // Цвет площадки
  ctx.fillStyle = highlight ? COLORS.padHighlight : COLORS.padCopper
  ctx.strokeStyle = highlight ? '#ffffff' : '#996633'
  ctx.lineWidth = 1

  switch (pad.shape) {
    case 'circle':
      ctx.beginPath()
      ctx.arc(x, y, w / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      break

    case 'oval':
      ctx.beginPath()
      ctx.ellipse(x, y, w / 2, h / 2, (pad.rotation || 0) * Math.PI / 180, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      break

    case 'rect':
    default:
      ctx.fillRect(x - w / 2, y - h / 2, w, h)
      ctx.strokeRect(x - w / 2, y - h / 2, w, h)
      break
  }

  // Номер пина
  ctx.fillStyle = '#000000'
  ctx.font = `${Math.max(6, w * 0.4)}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(pad.number, x, y)

  ctx.restore()
}

/**
 * Отрисовка корпуса (footprint)
 */
export function drawFootprint(
  ctx: CanvasRenderingContext2D,
  footprint: Footprint,
  position: Point,
  rotation: number = 0,
  selected: boolean = false,
  highlightedPads: string[] = [],
  scale: number = 1
) {
  const x = mmToPx(position.x)
  const y = mmToPx(position.y)

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((rotation * Math.PI) / 180)

  // Отрисовка контура (silkscreen)
  if (footprint.outline && footprint.outline.length > 1) {
    ctx.strokeStyle = COLORS.silkscreen
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(mmToPx(footprint.outline[0].x) * scale, mmToPx(footprint.outline[0].y) * scale)
    for (let i = 1; i < footprint.outline.length; i++) {
      ctx.lineTo(mmToPx(footprint.outline[i].x) * scale, mmToPx(footprint.outline[i].y) * scale)
    }
    ctx.closePath()
    ctx.stroke()
  }

  // Отрисовка courtyard (зона запрета) если выбран
  if (selected && footprint.courtyard && footprint.courtyard.length > 1) {
    ctx.strokeStyle = COLORS.courtyard
    ctx.fillStyle = COLORS.courtyard
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(mmToPx(footprint.courtyard[0].x) * scale, mmToPx(footprint.courtyard[0].y) * scale)
    for (let i = 1; i < footprint.courtyard.length; i++) {
      ctx.lineTo(mmToPx(footprint.courtyard[i].x) * scale, mmToPx(footprint.courtyard[i].y) * scale)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Отрисовка площадок
  for (const pad of footprint.pads) {
    const isHighlighted = highlightedPads.includes(pad.id) || highlightedPads.includes(pad.number)
    drawPad(ctx, pad, 0, 0, 0, isHighlighted, scale)
  }

  // Выделение
  if (selected) {
    ctx.strokeStyle = COLORS.selection
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    const halfW = mmToPx(footprint.width / 2) * scale
    const halfH = mmToPx(footprint.height / 2) * scale
    ctx.strokeRect(-halfW - 5, -halfH - 5, halfW * 2 + 10, halfH * 2 + 10)
    ctx.setLineDash([])
  }

  ctx.restore()
}

/**
 * Отрисовка размещенного компонента
 */
export function drawPlacedComponent(
  ctx: CanvasRenderingContext2D,
  component: PlacedComponent,
  selected: boolean = false,
  highlightedPads: string[] = []
) {
  const { position, rotation, footprint, reference, value } = component

  // Отрисовка корпуса
  drawFootprint(ctx, footprint, position, rotation, selected, highlightedPads)

  const x = mmToPx(position.x)
  const y = mmToPx(position.y)

  ctx.save()
  ctx.translate(x, y)

  // Обозначение (reference)
  if (reference) {
    ctx.fillStyle = COLORS.reference
    ctx.font = 'bold 7px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(reference, 0, -mmToPx(footprint.height / 2) - 3)
  }

  // Значение (value)
  if (value) {
    ctx.fillStyle = COLORS.value
    ctx.font = '6px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(value, 0, mmToPx(footprint.height / 2) + 3)
  }

  ctx.restore()
}

/**
 * Отрисовка дорожки (trace)
 */
export function drawTrace(
  ctx: CanvasRenderingContext2D,
  trace: Trace,
  selected: boolean = false
) {
  if (trace.points.length < 2) return

  // Цвет в зависимости от слоя
  const isBottom = trace.layer === 'bottom-copper' || trace.layer === 'bottom'
  ctx.strokeStyle = selected ? COLORS.selection : (isBottom ? COLORS.traceBottom : COLORS.traceTop)
  ctx.lineWidth = mmToPx(trace.width)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Нижний слой показываем пунктирной линией
  if (isBottom && !selected) {
    ctx.setLineDash([mmToPx(1), mmToPx(0.5)])
  }

  ctx.beginPath()
  ctx.moveTo(mmToPx(trace.points[0].x), mmToPx(trace.points[0].y))

  for (let i = 1; i < trace.points.length; i++) {
    ctx.lineTo(mmToPx(trace.points[i].x), mmToPx(trace.points[i].y))
  }

  ctx.stroke()
  
  // Сброс пунктира
  if (isBottom && !selected) {
    ctx.setLineDash([])
  }

  // Выделение
  if (selected) {
    ctx.strokeStyle = COLORS.selection
    ctx.lineWidth = mmToPx(trace.width) + 2
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])
  }
}

/**
 * Отрисовка переходного отверстия (via)
 */
export function drawVia(
  ctx: CanvasRenderingContext2D,
  via: Via,
  selected: boolean = false
) {
  const x = mmToPx(via.position.x)
  const y = mmToPx(via.position.y)
  const padRadius = mmToPx(via.padDiameter / 2)
  const holeRadius = mmToPx(via.diameter / 2)

  // Площадка
  ctx.fillStyle = selected ? COLORS.padHighlight : COLORS.padCopper
  ctx.beginPath()
  ctx.arc(x, y, padRadius, 0, Math.PI * 2)
  ctx.fill()

  // Отверстие
  ctx.fillStyle = COLORS.board
  ctx.beginPath()
  ctx.arc(x, y, holeRadius, 0, Math.PI * 2)
  ctx.fill()

  // Контур
  ctx.strokeStyle = selected ? COLORS.selection : '#666666'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(x, y, padRadius, 0, Math.PI * 2)
  ctx.stroke()
}

/**
 * Получает глобальную позицию площадки компонента
 */
export function getPadGlobalPosition(component: PlacedComponent, pad: Pad): Point {
  const rad = (component.rotation * Math.PI) / 180
  const rotX = pad.position.x * Math.cos(rad) - pad.position.y * Math.sin(rad)
  const rotY = pad.position.x * Math.sin(rad) + pad.position.y * Math.cos(rad)
  return {
    x: component.position.x + rotX,
    y: component.position.y + rotY
  }
}

/**
 * Отрисовка воздушных линий (ratsnest) - связей между пинами в одной цепи
 */
export function drawRatsnest(
  ctx: CanvasRenderingContext2D,
  board: PCBBoard,
  showRatsnest: boolean = true
) {
  if (!showRatsnest || !board.netlist || board.netlist.nets.length === 0) {
    return
  }

  ctx.save()
  ctx.strokeStyle = '#ffff00' // Желтый цвет для ratsnest
  ctx.lineWidth = 0.5
  ctx.setLineDash([2, 2])
  ctx.globalAlpha = 0.7

  // Для каждой цепи рисуем линии между пинами
  for (const net of board.netlist.nets) {
    if (net.pins.length < 2) continue

    // Собираем глобальные позиции всех пинов цепи
    const pinPositions: Point[] = []
    
    for (const pin of net.pins) {
      const component = board.components.find(c => c.reference === pin.componentRef)
      if (!component) continue
      
      const pad = component.footprint.pads.find(p => p.number === pin.pinNumber)
      if (!pad) continue
      
      const pos = getPadGlobalPosition(component, pad)
      pinPositions.push(pos)
    }

    // Рисуем минимальное остовное дерево (упрощенно - звезда от первого пина)
    if (pinPositions.length >= 2) {
      // Используем алгоритм минимального остовного дерева для красивого отображения
      const connected = new Set<number>([0])
      const edges: Array<[number, number]> = []
      
      while (connected.size < pinPositions.length) {
        let minDist = Infinity
        let bestFrom = 0
        let bestTo = 0
        
        for (const from of connected) {
          for (let to = 0; to < pinPositions.length; to++) {
            if (connected.has(to)) continue
            
            const dx = pinPositions[to].x - pinPositions[from].x
            const dy = pinPositions[to].y - pinPositions[from].y
            const dist = dx * dx + dy * dy
            
            if (dist < minDist) {
              minDist = dist
              bestFrom = from
              bestTo = to
            }
          }
        }
        
        if (bestTo !== 0 || !connected.has(bestTo)) {
          connected.add(bestTo)
          edges.push([bestFrom, bestTo])
        }
      }
      
      // Рисуем ребра
      for (const [from, to] of edges) {
        const p1 = pinPositions[from]
        const p2 = pinPositions[to]
        
        ctx.beginPath()
        ctx.moveTo(mmToPx(p1.x), mmToPx(p1.y))
        ctx.lineTo(mmToPx(p2.x), mmToPx(p2.y))
        ctx.stroke()
      }
    }
  }

  ctx.restore()
}

/**
 * Отрисовка всей платы
 */
export function drawBoard(
  ctx: CanvasRenderingContext2D,
  board: PCBBoard,
  selectedComponents: string[] = [],
  selectedTraces: string[] = [],
  highlightedPads: string[] = [],
  showRatsnest: boolean = true
) {
  // Контур платы
  drawBoardOutline(ctx, board)

  // Ratsnest (воздушные линии) - рисуем под дорожками
  drawRatsnest(ctx, board, showRatsnest)

  // Дорожки нижнего слоя
  const bottomTraces = board.traces.filter(t => 
    t.layer === 'bottom-copper' || t.layer === 'bottom'
  )
  bottomTraces.forEach(trace => {
    drawTrace(ctx, trace, selectedTraces.includes(trace.id))
  })

  // Дорожки верхнего слоя
  const topTraces = board.traces.filter(t => 
    t.layer === 'top-copper' || t.layer === 'top' || !t.layer.includes('bottom')
  )
  topTraces.forEach(trace => {
    drawTrace(ctx, trace, selectedTraces.includes(trace.id))
  })

  // Переходные отверстия
  board.vias.forEach(via => {
    drawVia(ctx, via)
  })

  // Компоненты
  board.components.forEach(component => {
    const isSelected = selectedComponents.includes(component.id)
    drawPlacedComponent(ctx, component, isSelected, highlightedPads)
  })
}

/**
 * Проверка попадания точки в компонент
 */
export function isPointInComponent(
  point: Point,
  component: PlacedComponent
): boolean {
  const { position, footprint, rotation } = component
  
  // Преобразуем точку в локальную систему координат компонента
  const dx = point.x - position.x
  const dy = point.y - position.y
  
  // Учитываем поворот
  const rad = (-rotation * Math.PI) / 180
  const localX = dx * Math.cos(rad) - dy * Math.sin(rad)
  const localY = dx * Math.sin(rad) + dy * Math.cos(rad)
  
  const halfW = footprint.width / 2
  const halfH = footprint.height / 2
  
  return Math.abs(localX) <= halfW && Math.abs(localY) <= halfH
}

/**
 * Проверка попадания точки в площадку
 */
export function isPointInPad(
  point: Point,
  pad: Pad,
  componentPosition: Point,
  componentRotation: number
): boolean {
  // Преобразуем точку в локальную систему координат
  const dx = point.x - componentPosition.x
  const dy = point.y - componentPosition.y
  
  const rad = (-componentRotation * Math.PI) / 180
  const localX = dx * Math.cos(rad) - dy * Math.sin(rad)
  const localY = dx * Math.sin(rad) + dy * Math.cos(rad)
  
  // Проверяем попадание в площадку
  const padX = pad.position.x
  const padY = pad.position.y
  const halfW = pad.width / 2
  const halfH = pad.height / 2
  
  const relX = localX - padX
  const relY = localY - padY
  
  if (pad.shape === 'circle') {
    return Math.sqrt(relX * relX + relY * relY) <= halfW
  }
  
  return Math.abs(relX) <= halfW && Math.abs(relY) <= halfH
}

/**
 * Проверка попадания точки в дорожку
 */
export function isPointNearTrace(
  point: Point,
  trace: Trace,
  threshold: number = 0.5
): boolean {
  if (trace.points.length < 2) return false

  for (let i = 0; i < trace.points.length - 1; i++) {
    const p1 = trace.points[i]
    const p2 = trace.points[i + 1]

    const dist = distanceToSegment(point, p1, p2)
    if (dist <= threshold + trace.width / 2) {
      return true
    }
  }

  return false
}

/**
 * Расстояние от точки до отрезка
 */
function distanceToSegment(point: Point, p1: Point, p2: Point): number {
  const A = point.x - p1.x
  const B = point.y - p1.y
  const C = p2.x - p1.x
  const D = p2.y - p1.y

  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1

  if (lenSq !== 0) {
    param = dot / lenSq
  }

  let xx: number, yy: number

  if (param < 0) {
    xx = p1.x
    yy = p1.y
  } else if (param > 1) {
    xx = p2.x
    yy = p2.y
  } else {
    xx = p1.x + param * C
    yy = p1.y + param * D
  }

  const dx = point.x - xx
  const dy = point.y - yy

  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Привязка координат к сетке
 */
export function snapToGrid(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize
  }
}

/**
 * Поиск компонента по позиции
 */
export function findComponentAt(
  point: Point,
  components: PlacedComponent[]
): PlacedComponent | null {
  // Ищем с конца (верхние компоненты)
  for (let i = components.length - 1; i >= 0; i--) {
    if (isPointInComponent(point, components[i])) {
      return components[i]
    }
  }
  return null
}

/**
 * Поиск дорожки по позиции
 */
export function findTraceAt(
  point: Point,
  traces: Trace[]
): Trace | null {
  for (let i = traces.length - 1; i >= 0; i--) {
    if (isPointNearTrace(point, traces[i])) {
      return traces[i]
    }
  }
  return null
}

/**
 * Отрисовка предпросмотра корпуса
 */
export function drawFootprintPreview(
  ctx: CanvasRenderingContext2D,
  footprint: Footprint,
  canvasWidth: number,
  canvasHeight: number
) {
  // Очистка canvas
  ctx.fillStyle = '#2d2d2d'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Вычисляем масштаб для отображения
  const padding = 20
  const maxWidth = canvasWidth - padding * 2
  const maxHeight = canvasHeight - padding * 2
  const footprintWidth = mmToPx(footprint.width)
  const footprintHeight = mmToPx(footprint.height)

  const scale = Math.min(
    maxWidth / footprintWidth,
    maxHeight / footprintHeight,
    2 // Максимальный масштаб
  )

  ctx.save()
  ctx.translate(canvasWidth / 2, canvasHeight / 2)
  ctx.scale(scale, scale)

  // Рисуем footprint в центре
  drawFootprint(ctx, footprint, { x: 0, y: 0 }, 0, false, [], 1)

  ctx.restore()

  // Название
  ctx.fillStyle = '#ffffff'
  ctx.font = '12px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(footprint.name, canvasWidth / 2, canvasHeight - 10)
}

/**
 * Отрисовка временной дорожки (при рисовании)
 */
export function drawTempTrace(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  layer: string
) {
  if (points.length < 1) return

  const isBottom = layer.includes('bottom')
  ctx.strokeStyle = isBottom ? COLORS.traceBottom : COLORS.traceTop
  ctx.lineWidth = mmToPx(width)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash([5, 5])

  ctx.beginPath()
  ctx.moveTo(mmToPx(points[0].x), mmToPx(points[0].y))

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(mmToPx(points[i].x), mmToPx(points[i].y))
  }

  ctx.stroke()
  ctx.setLineDash([])

  // Точки
  ctx.fillStyle = isBottom ? COLORS.traceBottom : COLORS.traceTop
  points.forEach(point => {
    ctx.beginPath()
    ctx.arc(mmToPx(point.x), mmToPx(point.y), 3, 0, Math.PI * 2)
    ctx.fill()
  })
}
