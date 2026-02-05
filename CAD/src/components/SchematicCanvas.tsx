import { useRef, useEffect, useState, useCallback } from 'react'
import { useStore, Point } from '../store/useStore'
import { drawGrid, drawComponent, drawWire, setCustomComponentsCache, setKicadLibrariesCache, isPointNearWire } from '../utils/canvasUtils'

export default function SchematicCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [isPlacingComponent, setIsPlacingComponent] = useState(false)
  const [tempComponentPos, setTempComponentPos] = useState({ x: 0, y: 0 })
  const [isDraggingComponent, setIsDraggingComponent] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDrawingWire, setIsDrawingWire] = useState(false)
  const [currentWirePoints, setCurrentWirePoints] = useState<Point[]>([])
  const [tempWirePoint, setTempWirePoint] = useState<Point | null>(null)
  
  const {
    zoom,
    pan,
    gridSize,
    showGrid,
    snapToGrid,
    components,
    wires,
    activeTool,
    selectedComponentType,
    selectedObjects,
    setZoom,
    setPan,
    addComponent,
    setSelectedComponentType,
    setSelectedObjects,
    updateComponent,
    removeComponent,
    addWire,
    removeWire,
    deleteSelected,
    customComponents,
    kicadLibraries,
  } = useStore()
  
  // Update custom components cache whenever they change
  useEffect(() => {
    setCustomComponentsCache(customComponents)
  }, [customComponents])
  
  // Update KiCad libraries cache whenever they change
  useEffect(() => {
    setKicadLibrariesCache(kicadLibraries)
  }, [kicadLibraries])
  
  // Helper function to check if point is inside component
  const isPointInComponent = (point: Point, componentId: string): boolean => {
    const component = components.find(c => c.id === componentId)
    if (!component) return false
    
    const dx = point.x - component.position.x
    const dy = point.y - component.position.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    return distance < 50 // Hit detection radius
  }
  
  // Find component at position
  const findComponentAt = (point: Point): string | null => {
    for (let i = components.length - 1; i >= 0; i--) {
      if (isPointInComponent(point, components[i].id)) {
        return components[i].id
      }
    }
    return null
  }
  
  // Find wire at position
  const findWireAt = (point: Point): string | null => {
    for (let i = wires.length - 1; i >= 0; i--) {
      if (isPointNearWire(point, wires[i], 8)) {
        return wires[i].id
      }
    }
    return null
  }
  
  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Set canvas size
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    
    // Clear canvas
    ctx.fillStyle = '#1e1e1e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Apply transformations
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)
    
    // Draw grid
    if (showGrid) {
      drawGrid(ctx, canvas.width, canvas.height, gridSize, zoom, pan)
    }
    
    // Draw wires
    wires.forEach(wire => {
      const isSelected = selectedObjects.includes(`wire-${wire.id}`)
      drawWire(ctx, wire, isSelected)
    })
    
    // Draw components
    components.forEach(component => {
      drawComponent(ctx, component)
      
      // Draw selection highlight
      if (selectedObjects.includes(component.id)) {
        ctx.strokeStyle = '#00ffff'
        ctx.lineWidth = 3
        ctx.setLineDash([5, 5])
        ctx.strokeRect(
          component.position.x - 60,
          component.position.y - 60,
          120,
          120
        )
        ctx.setLineDash([])
      }
    })
    
    // Draw temporary component while placing
    if (isPlacingComponent && selectedComponentType) {
      ctx.globalAlpha = 0.5
      drawComponent(ctx, {
        id: 'temp',
        type: selectedComponentType,
        position: tempComponentPos,
        rotation: 0,
        properties: {},
        pins: []
      })
      ctx.globalAlpha = 1
    }
    
    // Draw temporary wire while drawing
    if (isDrawingWire && currentWirePoints.length > 0) {
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      
      ctx.beginPath()
      ctx.moveTo(currentWirePoints[0].x, currentWirePoints[0].y)
      
      for (let i = 1; i < currentWirePoints.length; i++) {
        ctx.lineTo(currentWirePoints[i].x, currentWirePoints[i].y)
      }
      
      if (tempWirePoint) {
        ctx.lineTo(tempWirePoint.x, tempWirePoint.y)
      }
      
      ctx.stroke()
      ctx.setLineDash([])
      
      // Draw points
      ctx.fillStyle = '#00ff00'
      currentWirePoints.forEach(point => {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
        ctx.fill()
      })
    }
    
    ctx.restore()
  }, [zoom, pan, gridSize, showGrid, components, wires, isPlacingComponent, tempComponentPos, selectedComponentType, selectedObjects, isDrawingWire, currentWirePoints, tempWirePoint])
  
  const getCanvasCoordinates = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - pan.x) / zoom
    const y = (e.clientY - rect.top - pan.y) / zoom
    
    if (snapToGrid) {
      return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize,
      }
    }
    
    return { x, y }
  }
  
  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasCoordinates(e)
    
    // Middle mouse button - always panning
    if (e.button === 1) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      return
    }
    
    // Left mouse button
    if (e.button === 0) {
      if (activeTool === 'wire') {
        // Wire drawing mode
        if (!isDrawingWire) {
          setIsDrawingWire(true)
          setCurrentWirePoints([pos])
        } else {
          setCurrentWirePoints([...currentWirePoints, pos])
        }
      } else if (activeTool === 'component' && selectedComponentType) {
        // Placing component mode
        setIsPlacingComponent(true)
        setTempComponentPos(pos)
      } else if (activeTool === 'label') {
        // Add text label
        const label = prompt('Введите текст метки:')
        if (label) {
          addComponent({
            id: `label-${Date.now()}`,
            type: 'label',
            position: pos,
            rotation: 0,
            properties: {
              reference: '',
              value: label,
            },
            pins: [],
          })
        }
      } else if (activeTool === 'junction') {
        // Add junction point
        addComponent({
          id: `junction-${Date.now()}`,
          type: 'junction',
          position: pos,
          rotation: 0,
          properties: {},
          pins: [],
        })
      } else if (activeTool === 'select') {
        // Select mode - find component or wire
        const componentId = findComponentAt(pos)
        const wireId = findWireAt(pos)
        
        if (componentId) {
          // Check if Ctrl/Cmd is pressed for multi-select
          if (e.ctrlKey || e.metaKey) {
            if (selectedObjects.includes(componentId)) {
              setSelectedObjects(selectedObjects.filter(id => id !== componentId))
            } else {
              setSelectedObjects([...selectedObjects, componentId])
            }
          } else {
            setSelectedObjects([componentId])
          }
          // Also allow dragging in select mode
          setIsDraggingComponent(true)
          const component = components.find(c => c.id === componentId)
          if (component) {
            setDragOffset({
              x: pos.x - component.position.x,
              y: pos.y - component.position.y
            })
          }
        } else if (wireId) {
          // Check if Ctrl/Cmd is pressed for multi-select
          if (e.ctrlKey || e.metaKey) {
            const wireSelectId = `wire-${wireId}`
            if (selectedObjects.includes(wireSelectId)) {
              setSelectedObjects(selectedObjects.filter(id => id !== wireSelectId))
            } else {
              setSelectedObjects([...selectedObjects, wireSelectId])
            }
          } else {
            setSelectedObjects([`wire-${wireId}`])
          }
        } else {
          // Click on empty space - clear selection unless Ctrl/Cmd is pressed
          if (!(e.ctrlKey || e.metaKey)) {
            setSelectedObjects([])
          }
        }
      } else if (activeTool === 'move') {
        // Move mode - pan the workspace
        setIsPanning(true)
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      } else if (activeTool === 'delete') {
        // Delete mode
        const componentId = findComponentAt(pos)
        const wireId = findWireAt(pos)
        
        if (componentId) {
          removeComponent(componentId)
        } else if (wireId) {
          removeWire(wireId)
        }
      } else if (activeTool === 'rotate') {
        // Rotate mode
        const componentId = findComponentAt(pos)
        if (componentId) {
          const component = components.find(c => c.id === componentId)
          if (component) {
            updateComponent(componentId, {
              rotation: (component.rotation + 90) % 360
            })
          }
        }
      }
    }
  }
  
  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getCanvasCoordinates(e)
    
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
    } else if (isDrawingWire) {
      setTempWirePoint(pos)
    } else if (isPlacingComponent) {
      setTempComponentPos(pos)
    } else if (isDraggingComponent && selectedObjects.length > 0) {
      // Move selected components
      selectedObjects.forEach(id => {
        updateComponent(id, {
          position: {
            x: pos.x - dragOffset.x,
            y: pos.y - dragOffset.y
          }
        })
      })
    }
  }
  
  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false)
    } else if (isPlacingComponent && selectedComponentType) {
      const pos = getCanvasCoordinates(e)
      
      // Add component
      const newId = `comp-${Date.now()}`
      addComponent({
        id: newId,
        type: selectedComponentType,
        position: pos,
        rotation: 0,
        properties: {
          reference: `${selectedComponentType.charAt(0).toUpperCase()}?`,
          value: '',
        },
        pins: [],
      })
      
      setIsPlacingComponent(false)
      setSelectedObjects([newId])
    } else if (isDraggingComponent) {
      setIsDraggingComponent(false)
    }
  }
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsPlacingComponent(false)
      setSelectedComponentType(null)
      setSelectedObjects([])
      setIsDrawingWire(false)
      setCurrentWirePoints([])
      setTempWirePoint(null)
    } else if (e.key === 'Enter' && isDrawingWire && currentWirePoints.length >= 2) {
      // Finish wire
      addWire({
        id: `wire-${Date.now()}`,
        points: currentWirePoints,
        layer: '1',
      })
      setIsDrawingWire(false)
      setCurrentWirePoints([])
      setTempWirePoint(null)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Delete selected components and wires
      deleteSelected()
    }
  }, [setSelectedComponentType, selectedObjects, deleteSelected, setSelectedObjects, isDrawingWire, currentWirePoints, addWire])
  
  // Handle keyboard events
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
  
  // Handle wheel events with passive: false to allow preventDefault
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
  
  // Get cursor style based on active tool
  const getCursorClass = () => {
    if (isPanning) return 'cursor-grabbing'
    switch (activeTool) {
      case 'select': return 'cursor-pointer'
      case 'move': return 'cursor-grab'
      case 'delete': return 'cursor-not-allowed'
      case 'rotate': return 'cursor-alias'
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
      
      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 bg-dark-panel px-3 py-2 rounded border border-border-color text-sm">
        Масштаб: {(zoom * 100).toFixed(0)}%
      </div>
      
      {/* Tool hints */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-none">
        {activeTool === 'component' && selectedComponentType && (
          <div className="bg-blue-600 px-4 py-2 rounded text-sm shadow-lg">
            Нажмите для размещения компонента • ESC - отмена
          </div>
        )}
        {activeTool === 'select' && (
          <div className="bg-gray-700 px-4 py-2 rounded text-sm shadow-lg">
            Кликните для выбора компонента или провода • Ctrl - множественный выбор
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
            Кликните по компоненту или проводу для удаления
          </div>
        )}
        {activeTool === 'wire' && (
          <div className="bg-yellow-600 px-4 py-2 rounded text-sm shadow-lg">
            Кликните для размещения точек провода • Enter - завершить • ESC - отмена
          </div>
        )}
        {selectedObjects.length > 0 && (
          <div className="bg-cyan-600 px-4 py-2 rounded text-sm shadow-lg">
            Выбрано: {selectedObjects.length} • Delete - удалить • R - повернуть
          </div>
        )}
      </div>
    </div>
  )
}

