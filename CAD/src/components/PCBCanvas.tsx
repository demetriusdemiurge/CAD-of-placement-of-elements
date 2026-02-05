/**
 * PCB Canvas - холст для редактирования печатной платы
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { usePCBStore } from '../store/pcbStore'
import { Point, PlacedComponent, Trace, Footprint } from '../types/pcb'
import {
  drawBoard,
  drawPCBGrid,
  drawTempTrace,
  drawFootprint,
  mmToPx,
  pxToMm,
  snapToGrid,
  findComponentAt,
  findTraceAt,
  getPadGlobalPosition
} from '../utils/pcbCanvasUtils'

export default function PCBCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [isDraggingComponent, setIsDraggingComponent] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDrawingTrace, setIsDrawingTrace] = useState(false)
  const [currentTracePoints, setCurrentTracePoints] = useState<Point[]>([])
  const [tempPoint, setTempPoint] = useState<Point | null>(null)
  const [isPlacingComponent, setIsPlacingComponent] = useState(false)
  const [tempComponentPos, setTempComponentPos] = useState<Point>({ x: 0, y: 0 })

  const {
    board,
    zoom,
    pan,
    showGrid,
    showRatsnest,
    snapToGrid: snapEnabled,
    activeTool,
    activeLayer,
    selectedComponents,
    selectedTraces,
    selectedFootprint,
    routingOptions,
    setZoom,
    setPan,
    addComponent,
    removeComponent,
    updateComponent,
    moveComponent,
    rotateComponent,
    addTrace,
    removeTrace,
    setSelectedComponents,
    setSelectedTraces,
    setSelectedFootprint,
    deleteSelected,
    setCanvasSize,
    fitBoardToScreen
  } = usePCBStore()

  // Вычисление общей длины связей (ratsnest)
  const wirelengthInfo = useMemo(() => {
    if (!board.netlist || board.netlist.nets.length === 0) {
      return { totalLength: 0, netCount: 0, connectionCount: 0 }
    }

    let totalLength = 0
    let connectionCount = 0

    for (const net of board.netlist.nets) {
      if (net.pins.length < 2) continue

      // Собираем позиции пинов
      const pinPositions: Array<{ x: number; y: number }> = []
      
      for (const pin of net.pins) {
        const component = board.components.find(c => c.reference === pin.componentRef)
        if (!component) continue
        
        const pad = component.footprint.pads.find(p => p.number === pin.pinNumber)
        if (!pad) continue
        
        const pos = getPadGlobalPosition(component, pad)
        pinPositions.push(pos)
      }

      if (pinPositions.length < 2) continue

      // Строим MST и считаем длину
      const connected = new Set<number>([0])
      
      while (connected.size < pinPositions.length) {
        let minDist = Infinity
        let bestTo = 1
        
        for (const from of connected) {
          for (let to = 0; to < pinPositions.length; to++) {
            if (connected.has(to)) continue
            
            const dx = pinPositions[to].x - pinPositions[from].x
            const dy = pinPositions[to].y - pinPositions[from].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            
            if (dist < minDist) {
              minDist = dist
              bestTo = to
            }
          }
        }
        
        connected.add(bestTo)
        totalLength += minDist
        connectionCount++
      }
    }

    return {
      totalLength,
      netCount: board.netlist.nets.length,
      connectionCount
    }
  }, [board.netlist, board.components])

  // Отслеживание размера canvas и установка в store
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect()
      setCanvasSize(rect.width, rect.height)
    }

    // Установить начальный размер
    updateCanvasSize()

    // Подписка на изменение размера окна
    const resizeObserver = new ResizeObserver(updateCanvasSize)
    resizeObserver.observe(canvas)

    return () => resizeObserver.disconnect()
  }, [setCanvasSize])

  // Подгонка платы под экран при первой загрузке
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      setCanvasSize(rect.width, rect.height)
      // Небольшая задержка для обновления store
      setTimeout(() => fitBoardToScreen(), 50)
    }
  }, []) // Только при первом рендере

  // Отрисовка canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Установка размера canvas
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    // Очистка
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Применение трансформаций
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)

    // Сетка
    if (showGrid) {
      drawPCBGrid(
        ctx,
        canvas.width,
        canvas.height,
        board.gridSize,
        zoom,
        pan,
        board.width,
        board.height
      )
    }

    // Отрисовка платы
    drawBoard(ctx, board, selectedComponents, selectedTraces, [], showRatsnest)

    // Временная дорожка при рисовании
    if (isDrawingTrace && currentTracePoints.length > 0) {
      const allPoints = tempPoint 
        ? [...currentTracePoints, tempPoint]
        : currentTracePoints
      drawTempTrace(ctx, allPoints, routingOptions.traceWidth, activeLayer)
    }

    // Временный компонент при размещении
    if (isPlacingComponent && selectedFootprint) {
      ctx.globalAlpha = 0.6
      drawFootprint(ctx, selectedFootprint, tempComponentPos, 0, false, [], 1)
      ctx.globalAlpha = 1
    }

    ctx.restore()
  }, [
    board,
    zoom,
    pan,
    showGrid,
    showRatsnest,
    selectedComponents,
    selectedTraces,
    isDrawingTrace,
    currentTracePoints,
    tempPoint,
    isPlacingComponent,
    tempComponentPos,
    selectedFootprint,
    routingOptions,
    activeLayer
  ])

  // Получение координат на плате из координат мыши
  const getBoardCoordinates = useCallback((e: React.MouseEvent): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const px = (e.clientX - rect.left - pan.x) / zoom
    const py = (e.clientY - rect.top - pan.y) / zoom

    // Конвертируем пиксели в мм
    const x = pxToMm(px)
    const y = pxToMm(py)

    if (snapEnabled) {
      return snapToGrid({ x, y }, board.gridSize)
    }

    return { x, y }
  }, [pan, zoom, snapEnabled, board.gridSize])

  // Обработка нажатия мыши
  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getBoardCoordinates(e)

    // Средняя кнопка - панорамирование
    if (e.button === 1) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      return
    }

    // Левая кнопка
    if (e.button === 0) {
      if (activeTool === 'trace') {
        // Рисование дорожки
        if (!isDrawingTrace) {
          setIsDrawingTrace(true)
          setCurrentTracePoints([pos])
        } else {
          setCurrentTracePoints([...currentTracePoints, pos])
        }
      } else if (activeTool === 'place' && selectedFootprint) {
        // Размещение компонента
        setIsPlacingComponent(true)
        setTempComponentPos(pos)
      } else if (activeTool === 'select') {
        // Выбор компонента или дорожки
        const component = findComponentAt(pos, board.components)
        const trace = findTraceAt(pos, board.traces)

        if (component) {
          if (e.ctrlKey || e.metaKey) {
            // Множественный выбор
            if (selectedComponents.includes(component.id)) {
              setSelectedComponents(selectedComponents.filter(id => id !== component.id))
            } else {
              setSelectedComponents([...selectedComponents, component.id])
            }
          } else {
            setSelectedComponents([component.id])
            setSelectedTraces([])
          }
          // Начинаем перетаскивание
          setIsDraggingComponent(true)
          setDragOffset({
            x: pos.x - component.position.x,
            y: pos.y - component.position.y
          })
        } else if (trace) {
          if (e.ctrlKey || e.metaKey) {
            if (selectedTraces.includes(trace.id)) {
              setSelectedTraces(selectedTraces.filter(id => id !== trace.id))
            } else {
              setSelectedTraces([...selectedTraces, trace.id])
            }
          } else {
            setSelectedTraces([trace.id])
            setSelectedComponents([])
          }
        } else {
          // Клик на пустом месте
          if (!(e.ctrlKey || e.metaKey)) {
            setSelectedComponents([])
            setSelectedTraces([])
          }
        }
      } else if (activeTool === 'move') {
        // Панорамирование рабочего пространства
        setIsPanning(true)
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      } else if (activeTool === 'delete') {
        // Удаление
        const component = findComponentAt(pos, board.components)
        const trace = findTraceAt(pos, board.traces)

        if (component) {
          removeComponent(component.id)
        } else if (trace) {
          removeTrace(trace.id)
        }
      } else if (activeTool === 'rotate') {
        // Поворот компонента
        const component = findComponentAt(pos, board.components)
        if (component) {
          rotateComponent(component.id)
        }
      }
    }
  }

  // Обработка движения мыши
  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getBoardCoordinates(e)

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
    } else if (isDrawingTrace) {
      setTempPoint(pos)
    } else if (isPlacingComponent) {
      setTempComponentPos(pos)
    } else if (isDraggingComponent && selectedComponents.length > 0) {
      // Перемещение выбранных компонентов
      selectedComponents.forEach(id => {
        moveComponent(id, {
          x: pos.x - dragOffset.x,
          y: pos.y - dragOffset.y
        })
      })
    }
  }

  // Обработка отпускания мыши
  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false)
    } else if (isPlacingComponent && selectedFootprint) {
      const pos = getBoardCoordinates(e)
      
      // Создаем новый компонент
      const newComponent: PlacedComponent = {
        id: `comp-${Date.now()}`,
        footprintId: selectedFootprint.id,
        footprint: { ...selectedFootprint },
        position: pos,
        rotation: 0,
        reference: `${selectedFootprint.name.charAt(0)}?`,
        value: '',
        layer: 'top',
        netConnections: {}
      }

      addComponent(newComponent)
      setIsPlacingComponent(false)
      setSelectedComponents([newComponent.id])
    } else if (isDraggingComponent) {
      setIsDraggingComponent(false)
    }
  }

  // Обработка клавиш
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsPlacingComponent(false)
      setSelectedFootprint(null)
      setSelectedComponents([])
      setSelectedTraces([])
      setIsDrawingTrace(false)
      setCurrentTracePoints([])
      setTempPoint(null)
    } else if (e.key === 'Enter' && isDrawingTrace && currentTracePoints.length >= 2) {
      // Завершаем дорожку
      const newTrace: Trace = {
        id: `trace-${Date.now()}`,
        netName: '',
        points: currentTracePoints,
        width: routingOptions.traceWidth,
        layer: activeLayer
      }
      addTrace(newTrace)
      setIsDrawingTrace(false)
      setCurrentTracePoints([])
      setTempPoint(null)
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isDrawingTrace) {
      deleteSelected()
    } else if (e.key === 'r' || e.key === 'R') {
      // Поворот выбранных компонентов
      selectedComponents.forEach(id => {
        rotateComponent(id)
      })
    }
  }, [
    setSelectedFootprint,
    isDrawingTrace,
    currentTracePoints,
    routingOptions.traceWidth,
    activeLayer,
    addTrace,
    deleteSelected,
    selectedComponents,
    rotateComponent
  ])

  // Подписка на события клавиатуры
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Обработка колесика мыши для зума
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom(zoom * delta)
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [zoom, setZoom])

  // Стиль курсора
  const getCursorClass = () => {
    if (isPanning) return 'cursor-grabbing'
    switch (activeTool) {
      case 'select': return 'cursor-pointer'
      case 'move': return 'cursor-grab'
      case 'delete': return 'cursor-not-allowed'
      case 'rotate': return 'cursor-alias'
      case 'trace': return 'cursor-crosshair'
      case 'place': return 'cursor-copy'
      default: return 'cursor-crosshair'
    }
  }

  return (
    <div className="flex-1 relative bg-dark-bg overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${getCursorClass()}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Индикатор масштаба */}
      <div className="absolute bottom-4 right-4 bg-dark-panel px-3 py-2 rounded border border-border-color text-sm">
        Масштаб: {(zoom * 100).toFixed(0)}%
      </div>

      {/* Информация о плате */}
      <div className="absolute bottom-4 left-4 bg-dark-panel px-3 py-2 rounded border border-border-color text-sm">
        Плата: {board.width}x{board.height}мм | Сетка: {board.gridSize}мм | Комп: {board.components.length}
      </div>

      {/* Подсказки по инструментам */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-none">
        {activeTool === 'place' && selectedFootprint && (
          <div className="bg-blue-600 px-4 py-2 rounded text-sm shadow-lg">
            Размещение: {selectedFootprint.name} • Нажмите для размещения • ESC - отмена
          </div>
        )}
        {activeTool === 'select' && (
          <div className="bg-gray-700 px-4 py-2 rounded text-sm shadow-lg">
            Кликните для выбора • Ctrl - множественный выбор • R - поворот
          </div>
        )}
        {activeTool === 'trace' && (
          <div className="bg-yellow-600 px-4 py-2 rounded text-sm shadow-lg">
            Рисование дорожки • Enter - завершить • ESC - отмена
          </div>
        )}
        {activeTool === 'move' && (
          <div className="bg-green-600 px-4 py-2 rounded text-sm shadow-lg">
            Перетащите для перемещения рабочего пространства
          </div>
        )}
        {activeTool === 'rotate' && (
          <div className="bg-purple-600 px-4 py-2 rounded text-sm shadow-lg">
            Кликните по компоненту для поворота на 90°
          </div>
        )}
        {activeTool === 'delete' && (
          <div className="bg-red-600 px-4 py-2 rounded text-sm shadow-lg">
            Кликните для удаления компонента или дорожки
          </div>
        )}
        {(selectedComponents.length > 0 || selectedTraces.length > 0) && (
          <div className="bg-cyan-600 px-4 py-2 rounded text-sm shadow-lg">
            Выбрано: {selectedComponents.length + selectedTraces.length} • Delete - удалить
          </div>
        )}
      </div>

      {/* Слой */}
      <div className="absolute top-4 right-4 bg-dark-panel px-3 py-2 rounded border border-border-color text-sm">
        Слой: {activeLayer === 'top-copper' ? 'Верхний' : 'Нижний'}
      </div>

      {/* Информация о связях (ratsnest) */}
      {showRatsnest && wirelengthInfo.netCount > 0 && (
        <div className="absolute top-4 left-4 bg-dark-panel px-3 py-2 rounded border border-border-color text-sm">
          <div className="text-yellow-400 font-medium">Связи (Ratsnest)</div>
          <div className="text-xs text-gray-400 mt-1">
            Цепей: {wirelengthInfo.netCount}
          </div>
          <div className="text-xs text-gray-400">
            Соединений: {wirelengthInfo.connectionCount}
          </div>
          <div className="text-xs text-green-400 mt-1">
            Длина: {wirelengthInfo.totalLength.toFixed(1)} мм
          </div>
        </div>
      )}
    </div>
  )
}
