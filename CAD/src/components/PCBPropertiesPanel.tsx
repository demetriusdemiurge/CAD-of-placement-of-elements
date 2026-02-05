/**
 * Панель свойств для PCB редактора
 */

import { useState, useRef } from 'react'
import { Settings, Cpu, Route, Wand2, Play, Upload, FolderOpen } from 'lucide-react'
import { usePCBStore } from '../store/pcbStore'
import { PlacedComponent, Trace, Point } from '../types/pcb'

export default function PCBPropertiesPanel() {
  const [activeTab, setActiveTab] = useState<'board' | 'component' | 'auto'>('board')
  const [placementMessage, setPlacementMessage] = useState<string>('')
  const [routingMessage, setRoutingMessage] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    board,
    setBoardSize,
    setBoardName,
    setGridSize,
    selectedComponents,
    updateComponent,
    placementOptions,
    routingOptions,
    setPlacementOptions,
    setRoutingOptions,
    setBoard,
    showRatsnest,
    toggleRatsnest
  } = usePCBStore()

  // Получаем выбранный компонент
  const selectedComponent = selectedComponents.length === 1
    ? board.components.find(c => c.id === selectedComponents[0])
    : null

  // Получает глобальную позицию площадки
  const getPadGlobalPosition = (component: PlacedComponent, padPosition: Point): Point => {
    const rad = (component.rotation * Math.PI) / 180
    const rotX = padPosition.x * Math.cos(rad) - padPosition.y * Math.sin(rad)
    const rotY = padPosition.x * Math.sin(rad) + padPosition.y * Math.cos(rad)
    return {
      x: component.position.x + rotX,
      y: component.position.y + rotY
    }
  }

  // Автоматическое размещение компонентов на плате (последовательный алгоритм)
  const handleAutoPlace = async () => {
    if (board.components.length === 0) {
      setPlacementMessage('На плате нет компонентов для размещения')
      return
    }

    setIsProcessing(true)
    setPlacementMessage('Последовательное размещение компонентов...')

    try {
      // Импортируем алгоритм размещения
      const { sequentialPlacement } = await import('../utils/placementAlgorithm')
      
      const result = sequentialPlacement(board, {
        boardMargin: placementOptions.boardMargin,
        componentSpacing: placementOptions.componentSpacing,
        preferredOrientation: placementOptions.preferredOrientation,
        sortBy: 'connectivity'
      })

      if (result.success) {
        setBoard({
          ...board,
          components: result.components
        }, false) // не делаем fitToScreen после размещения

        setPlacementMessage(result.message || `Размещено ${result.components.length} компонентов`)
      } else {
        setPlacementMessage(result.message || 'Ошибка размещения')
      }
    } catch (error) {
      setPlacementMessage(`Ошибка: ${error}`)
    }

    setIsProcessing(false)
  }

  // Проверка пересечения двух отрезков
  const segmentsIntersect = (p1: Point, p2: Point, p3: Point, p4: Point): boolean => {
    const d1 = direction(p3, p4, p1)
    const d2 = direction(p3, p4, p2)
    const d3 = direction(p1, p2, p3)
    const d4 = direction(p1, p2, p4)

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true
    }
    return false
  }

  const direction = (p1: Point, p2: Point, p3: Point): number => {
    return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y)
  }

  // Проверяет пересечение дорожки с существующими
  const traceIntersectsExisting = (newPoints: Point[], existingTraces: Trace[]): boolean => {
    for (let i = 0; i < newPoints.length - 1; i++) {
      const p1 = newPoints[i]
      const p2 = newPoints[i + 1]
      
      for (const trace of existingTraces) {
        for (let j = 0; j < trace.points.length - 1; j++) {
          const p3 = trace.points[j]
          const p4 = trace.points[j + 1]
          
          if (segmentsIntersect(p1, p2, p3, p4)) {
            return true
          }
        }
      }
    }
    return false
  }

  // Создает простой ортогональный путь между двумя точками
  const createSimpleOrthogonalPath = (start: Point, end: Point): Point[] => {
    // Простой Г-образный путь
    const midX = (start.x + end.x) / 2
    
    return [
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end
    ]
  }

  // Поиск ортогонального пути с избежанием препятствий
  const findOrthogonalPath = (start: Point, end: Point, existingTraces: Trace[], board: any): Point[] | null => {
    // Пробуем разные варианты ортогональных путей
    const variants: Point[][] = []
    
    // Вариант 1: Г-образный через горизонталь
    variants.push([
      start,
      { x: end.x, y: start.y },
      end
    ])
    
    // Вариант 2: Г-образный через вертикаль
    variants.push([
      start,
      { x: start.x, y: end.y },
      end
    ])
    
    // Вариант 3: П-образный через середину по X
    const midX = (start.x + end.x) / 2
    variants.push([
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end
    ])
    
    // Вариант 4: П-образный сверху
    const topY = Math.min(start.y, end.y) - 5
    if (topY >= 0) {
      variants.push([
        start,
        { x: start.x, y: topY },
        { x: end.x, y: topY },
        end
      ])
    }
    
    // Вариант 5: П-образный снизу
    const bottomY = Math.max(start.y, end.y) + 5
    if (bottomY <= board.height) {
      variants.push([
        start,
        { x: start.x, y: bottomY },
        { x: end.x, y: bottomY },
        end
      ])
    }
    
    // Вариант 6: П-образный слева
    const leftX = Math.min(start.x, end.x) - 5
    if (leftX >= 0) {
      variants.push([
        start,
        { x: leftX, y: start.y },
        { x: leftX, y: end.y },
        end
      ])
    }
    
    // Вариант 7: П-образный справа
    const rightX = Math.max(start.x, end.x) + 5
    if (rightX <= board.width) {
      variants.push([
        start,
        { x: rightX, y: start.y },
        { x: rightX, y: end.y },
        end
      ])
    }
    
    // Проверяем каждый вариант на пересечения
    for (const variant of variants) {
      if (!traceIntersectsExisting(variant, existingTraces)) {
        return variant
      }
    }
    
    return null
  }

  // Автотрассировка по netlist из файла
  const handleAutoRoute = () => {
    if (board.components.length < 2) {
      setRoutingMessage('Нужно минимум 2 компонента для трассировки')
      return
    }

    if (!board.netlist || board.netlist.nets.length === 0) {
      setRoutingMessage('Нет данных о связях. Импортируйте .brd файл с цепями.')
      return
    }

    setIsProcessing(true)
    setRoutingMessage('Трассировка по netlist...')

    try {
      const topTraces: Trace[] = []
      const bottomTraces: Trace[] = []
      const traceWidth = routingOptions.traceWidth || 0.5
      
      let routed = 0
      let failed = 0
      
      // Для каждой цепи создаем соединения
      for (const net of board.netlist.nets) {
        if (net.pins.length < 2) continue
        
        // Собираем пины с их позициями
        const pinPositions: Array<{
          componentRef: string;
          pinNumber: string;
          position: Point;
        }> = []
        
        for (const pin of net.pins) {
          const component = board.components.find(c => c.reference === pin.componentRef)
          if (!component) continue
          
          const pad = component.footprint.pads.find(p => p.number === pin.pinNumber)
          if (!pad) continue
          
          const pos = getPadGlobalPosition(component, pad.position)
          pinPositions.push({
            componentRef: pin.componentRef,
            pinNumber: pin.pinNumber,
            position: pos
          })
        }
        
        if (pinPositions.length < 2) continue
        
        // Строим MST (минимальное остовное дерево) для соединений
        const connected = new Set<number>([0])
        const edges: Array<[number, number]> = []
        
        while (connected.size < pinPositions.length) {
          let minDist = Infinity
          let bestFrom = 0
          let bestTo = 1
          
          for (const from of connected) {
            for (let to = 0; to < pinPositions.length; to++) {
              if (connected.has(to)) continue
              
              const dx = pinPositions[to].position.x - pinPositions[from].position.x
              const dy = pinPositions[to].position.y - pinPositions[from].position.y
              const dist = Math.sqrt(dx * dx + dy * dy)
              
              if (dist < minDist) {
                minDist = dist
                bestFrom = from
                bestTo = to
              }
            }
          }
          
          connected.add(bestTo)
          edges.push([bestFrom, bestTo])
        }
        
        // Трассируем каждое ребро MST
        for (const [fromIdx, toIdx] of edges) {
          const start = pinPositions[fromIdx].position
          const end = pinPositions[toIdx].position
          
          // Пытаемся найти ортогональный путь
          let path = findOrthogonalPath(start, end, topTraces, board)
          let useBottom = false
          
          if (!path) {
            path = findOrthogonalPath(start, end, bottomTraces, board)
            useBottom = true
          }
          
          if (!path) {
            path = createSimpleOrthogonalPath(start, end)
            useBottom = true
          }
          
          if (path) {
            const trace: Trace = {
              id: `trace-${Date.now()}-${routed}`,
              netName: net.name,
              points: path,
              width: traceWidth,
              layer: useBottom ? 'bottom-copper' : 'top-copper'
            }
            
            if (useBottom) {
              bottomTraces.push(trace)
            } else {
              topTraces.push(trace)
            }
            routed++
          } else {
            failed++
          }
        }
      }
      
      setBoard({
        ...board,
        traces: [...topTraces, ...bottomTraces]
      }, false)

      setRoutingMessage(`Трассировка: ${routed} соединений по ${board.netlist.nets.length} цепям`)
    } catch (error) {
      setRoutingMessage(`Ошибка: ${error}`)
    }

    setIsProcessing(false)
  }

  // Очистка дорожек
  const handleClearTraces = () => {
    setBoard({
      ...board,
      traces: []
    })
    setRoutingMessage('Дорожки удалены')
  }

  // Загрузка .brd файла
  const handleLoadBrd = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      
      // Импортируем парсер динамически
      const { parseBoardFile } = await import('../utils/kicadBoardParser')
      const parsedBoard = parseBoardFile(content, file.name)
      
      if (parsedBoard) {
        console.log('Parsed board:', parsedBoard)
        console.log('Components:', parsedBoard.components)
        console.log('Traces:', parsedBoard.traces)
        console.log('Board size:', parsedBoard.width, 'x', parsedBoard.height)
        
        setBoard(parsedBoard)
        
        let message = `Загружено: ${parsedBoard.components.length} компонентов`
        
        if (parsedBoard.traces.length > 0) {
          message += `, ${parsedBoard.traces.length} дорожек`
        } else {
          message += `. ⚠️ Дорожки не найдены в файле`
        }
        
        message += `. Плата: ${parsedBoard.width.toFixed(1)}x${parsedBoard.height.toFixed(1)}мм`
        
        setPlacementMessage(message)
      } else {
        setPlacementMessage('Не удалось распознать формат файла')
      }
    } catch (error) {
      console.error('Board load error:', error)
      setPlacementMessage(`Ошибка загрузки: ${error}`)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Табы */}
      <div className="flex border-b border-border-color">
        <button
          onClick={() => setActiveTab('board')}
          className={`flex-1 px-4 py-2 text-sm ${
            activeTab === 'board'
              ? 'bg-dark-hover border-b-2 border-blue-500'
              : 'hover:bg-dark-hover'
          }`}
        >
          <Settings size={14} className="inline mr-1" />
          Плата
        </button>
        <button
          onClick={() => setActiveTab('component')}
          className={`flex-1 px-4 py-2 text-sm ${
            activeTab === 'component'
              ? 'bg-dark-hover border-b-2 border-blue-500'
              : 'hover:bg-dark-hover'
          }`}
        >
          <Cpu size={14} className="inline mr-1" />
          Компонент
        </button>
        <button
          onClick={() => setActiveTab('auto')}
          className={`flex-1 px-4 py-2 text-sm ${
            activeTab === 'auto'
              ? 'bg-dark-hover border-b-2 border-blue-500'
              : 'hover:bg-dark-hover'
          }`}
        >
          <Wand2 size={14} className="inline mr-1" />
          Авто
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Таб: Плата */}
        {activeTab === 'board' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Название</label>
              <input
                type="text"
                value={board.name}
                onChange={(e) => setBoardName(e.target.value)}
                className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ширина (мм)</label>
                <input
                  type="number"
                  value={board.width}
                  onChange={(e) => setBoardSize(parseFloat(e.target.value) || 100, board.height)}
                  className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Высота (мм)</label>
                <input
                  type="number"
                  value={board.height}
                  onChange={(e) => setBoardSize(board.width, parseFloat(e.target.value) || 80)}
                  className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Сетка (мм)</label>
              <select
                value={board.gridSize}
                onChange={(e) => setGridSize(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm"
              >
                <option value={0.1}>0.1 мм</option>
                <option value={0.25}>0.25 мм (10 mil)</option>
                <option value={0.5}>0.5 мм (20 mil)</option>
                <option value={1.27}>1.27 мм (50 mil)</option>
                <option value={2.54}>2.54 мм (100 mil)</option>
              </select>
            </div>

            <div className="pt-4 border-t border-border-color">
              <h4 className="text-sm font-medium mb-2">Статистика</h4>
              <p className="text-xs text-gray-500">Компонентов: {board.components.length}</p>
              <p className="text-xs text-gray-500">Дорожек: {board.traces.length}</p>
              <p className="text-xs text-gray-500">Переходов: {board.vias.length}</p>
              <p className="text-xs text-gray-500">
                Цепей: {board.netlist?.nets.length || 0}
              </p>
            </div>

            <div className="pt-4 border-t border-border-color">
              <h4 className="text-sm font-medium mb-2">Отображение</h4>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRatsnest}
                  onChange={toggleRatsnest}
                  className="w-4 h-4"
                />
                Показывать связи (ratsnest)
              </label>
            </div>
          </div>
        )}

        {/* Таб: Компонент */}
        {activeTab === 'component' && (
          <div className="space-y-4">
            {selectedComponent ? (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Обозначение</label>
                  <input
                    type="text"
                    value={selectedComponent.reference}
                    onChange={(e) => updateComponent(selectedComponent.id, { reference: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Значение</label>
                  <input
                    type="text"
                    value={selectedComponent.value}
                    onChange={(e) => updateComponent(selectedComponent.id, { value: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">X (мм)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedComponent.position.x.toFixed(2)}
                      onChange={(e) => updateComponent(selectedComponent.id, {
                        position: { ...selectedComponent.position, x: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Y (мм)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedComponent.position.y.toFixed(2)}
                      onChange={(e) => updateComponent(selectedComponent.id, {
                        position: { ...selectedComponent.position, y: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Поворот</label>
                  <select
                    value={selectedComponent.rotation}
                    onChange={(e) => updateComponent(selectedComponent.id, { rotation: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm"
                  >
                    <option value={0}>0°</option>
                    <option value={90}>90°</option>
                    <option value={180}>180°</option>
                    <option value={270}>270°</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-border-color">
                  <h4 className="text-sm font-medium mb-2">Корпус</h4>
                  <p className="text-xs text-gray-500">{selectedComponent.footprint.name}</p>
                  <p className="text-xs text-gray-500">
                    {selectedComponent.footprint.width.toFixed(2)} x {selectedComponent.footprint.height.toFixed(2)} мм
                  </p>
                  <p className="text-xs text-gray-500">
                    Площадок: {selectedComponent.footprint.pads.length}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Выберите компонент
              </div>
            )}
          </div>
        )}

        {/* Таб: Авто */}
        {activeTab === 'auto' && (
          <div className="space-y-4">
            {/* Размещение */}
            <div className="p-3 bg-dark-bg rounded border border-border-color">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Cpu size={14} />
                Авто-размещение
              </h4>
              <p className="text-xs text-gray-500 mb-2">
                Разместить компоненты на плате автоматически
              </p>
              <div className="space-y-2 mb-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Отступ от края (мм)</label>
                  <input
                    type="number"
                    step="1"
                    value={placementOptions.boardMargin}
                    onChange={(e) => setPlacementOptions({ boardMargin: parseFloat(e.target.value) || 5 })}
                    className="w-full px-2 py-1 bg-dark-panel border border-border-color rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Расстояние между компонентами (мм)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={placementOptions.componentSpacing}
                    onChange={(e) => setPlacementOptions({ componentSpacing: parseFloat(e.target.value) || 2 })}
                    className="w-full px-2 py-1 bg-dark-panel border border-border-color rounded text-xs"
                  />
                </div>
              </div>
              <button
                onClick={handleAutoPlace}
                disabled={isProcessing || board.components.length === 0}
                className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm flex items-center justify-center gap-2"
              >
                <Play size={14} />
                Разместить ({board.components.length} комп.)
              </button>
              {placementMessage && (
                <p className="text-xs text-gray-400 mt-2">{placementMessage}</p>
              )}
            </div>

            {/* Трассировка */}
            <div className="p-3 bg-dark-bg rounded border border-border-color">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Route size={14} />
                Авто-трассировка
              </h4>
              <p className="text-xs text-gray-500 mb-2">
                Соединить площадки компонентов дорожками
              </p>
              <div className="space-y-2 mb-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Ширина дорожки (мм)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={routingOptions.traceWidth}
                    onChange={(e) => setRoutingOptions({ traceWidth: parseFloat(e.target.value) || 0.5 })}
                    className="w-full px-2 py-1 bg-dark-panel border border-border-color rounded text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAutoRoute}
                  disabled={isProcessing || board.components.length < 2}
                  className="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded text-sm flex items-center justify-center gap-2"
                >
                  <Play size={14} />
                  Трассировать
                </button>
                <button
                  onClick={handleClearTraces}
                  disabled={isProcessing || board.traces.length === 0}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded text-sm"
                  title="Удалить дорожки"
                >
                  ✕
                </button>
              </div>
              {routingMessage && (
                <p className="text-xs text-gray-400 mt-2">{routingMessage}</p>
              )}
              {board.traces.length > 0 && (
                <p className="text-xs text-green-400 mt-2">Дорожек: {board.traces.length}</p>
              )}
            </div>

            {/* Загрузка файла */}
            <div className="p-3 bg-dark-bg rounded border border-border-color">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <FolderOpen size={14} />
                Загрузить плату
              </h4>
              <input
                ref={fileInputRef}
                type="file"
                accept=".brd,.kicad_pcb"
                onChange={handleLoadBrd}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm flex items-center justify-center gap-2"
              >
                <Upload size={14} />
                Открыть .brd
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
