import { useState, useRef, useEffect } from 'react'
import { X, Plus, Trash2, Save } from 'lucide-react'
import { Component, Pin, Point } from '../store/useStore'

interface CustomComponentEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (component: any) => void
}

type DrawMode = 'line' | 'rectangle' | 'circle' | 'pin'

export default function CustomComponentEditor({ isOpen, onClose, onSave }: CustomComponentEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [componentName, setComponentName] = useState('')
  const [componentPrefix, setComponentPrefix] = useState('U')
  const [drawMode, setDrawMode] = useState<DrawMode>('line')
  const [shapes, setShapes] = useState<any[]>([])
  const [pins, setPins] = useState<Pin[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<Point | null>(null)
  const [tempShape, setTempShape] = useState<any>(null)
  
  useEffect(() => {
    if (!isOpen) {
      // Reset on close
      setComponentName('')
      setComponentPrefix('U')
      setShapes([])
      setPins([])
    }
  }, [isOpen])
  
  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear
    ctx.fillStyle = '#1e1e1e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Draw grid
    ctx.strokeStyle = '#2a2d2e'
    ctx.lineWidth = 1
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }
    
    // Draw center cross
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    ctx.strokeStyle = '#ff0000'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(centerX - 10, centerY)
    ctx.lineTo(centerX + 10, centerY)
    ctx.moveTo(centerX, centerY - 10)
    ctx.lineTo(centerX, centerY + 10)
    ctx.stroke()
    
    // Draw shapes
    ctx.strokeStyle = '#ffffff'
    ctx.fillStyle = 'rgba(100, 100, 255, 0.3)'
    ctx.lineWidth = 2
    
    shapes.forEach(shape => {
      if (shape.type === 'line') {
        ctx.beginPath()
        ctx.moveTo(shape.start.x, shape.start.y)
        ctx.lineTo(shape.end.x, shape.end.y)
        ctx.stroke()
      } else if (shape.type === 'rectangle') {
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
      } else if (shape.type === 'circle') {
        ctx.beginPath()
        ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2)
        ctx.stroke()
      }
    })
    
    // Draw temp shape
    if (tempShape) {
      ctx.strokeStyle = '#00ff00'
      ctx.setLineDash([5, 5])
      
      if (tempShape.type === 'line') {
        ctx.beginPath()
        ctx.moveTo(tempShape.start.x, tempShape.start.y)
        ctx.lineTo(tempShape.end.x, tempShape.end.y)
        ctx.stroke()
      } else if (tempShape.type === 'rectangle') {
        ctx.strokeRect(tempShape.x, tempShape.y, tempShape.width, tempShape.height)
      } else if (tempShape.type === 'circle') {
        ctx.beginPath()
        ctx.arc(tempShape.x, tempShape.y, tempShape.radius, 0, Math.PI * 2)
        ctx.stroke()
      }
      
      ctx.setLineDash([])
    }
    
    // Draw pins
    pins.forEach((pin, index) => {
      ctx.fillStyle = '#00ff00'
      ctx.beginPath()
      ctx.arc(pin.position.x, pin.position.y, 5, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = '#ffff00'
      ctx.font = '10px monospace'
      ctx.fillText(pin.number, pin.position.x + 8, pin.position.y + 4)
    })
  }, [shapes, pins, tempShape])
  
  const getCanvasCoords = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) / 20) * 20
    const y = Math.round((e.clientY - rect.top) / 20) * 20
    
    return { x, y }
  }
  
  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasCoords(e)
    
    if (drawMode === 'pin') {
      const newPin: Pin = {
        id: `pin-${Date.now()}`,
        position: pos,
        name: `PIN${pins.length + 1}`,
        number: String(pins.length + 1),
        type: 'bidirectional'
      }
      setPins([...pins, newPin])
    } else {
      setIsDrawing(true)
      setDrawStart(pos)
    }
  }
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) return
    
    const pos = getCanvasCoords(e)
    
    if (drawMode === 'line') {
      setTempShape({
        type: 'line',
        start: drawStart,
        end: pos
      })
    } else if (drawMode === 'rectangle') {
      setTempShape({
        type: 'rectangle',
        x: Math.min(drawStart.x, pos.x),
        y: Math.min(drawStart.y, pos.y),
        width: Math.abs(pos.x - drawStart.x),
        height: Math.abs(pos.y - drawStart.y)
      })
    } else if (drawMode === 'circle') {
      const dx = pos.x - drawStart.x
      const dy = pos.y - drawStart.y
      const radius = Math.sqrt(dx * dx + dy * dy)
      setTempShape({
        type: 'circle',
        x: drawStart.x,
        y: drawStart.y,
        radius
      })
    }
  }
  
  const handleMouseUp = () => {
    if (isDrawing && tempShape) {
      setShapes([...shapes, tempShape])
      setTempShape(null)
    }
    setIsDrawing(false)
    setDrawStart(null)
  }
  
  const handleSave = () => {
    if (!componentName) {
      alert('Введите название компонента')
      return
    }
    
    const customComponent = {
      name: componentName,
      prefix: componentPrefix,
      shapes,
      pins,
      category: 'custom'
    }
    
    onSave(customComponent)
    onClose()
  }
  
  const clearCanvas = () => {
    setShapes([])
    setPins([])
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-dark-panel border border-border-color rounded-lg w-[900px] h-[700px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-color">
          <h2 className="text-xl font-semibold">Создание собственного компонента</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-hover rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Tools & Settings */}
          <div className="w-64 border-r border-border-color p-4 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-2">Название компонента</label>
                <input
                  type="text"
                  value={componentName}
                  onChange={(e) => setComponentName(e.target.value)}
                  placeholder="Например: OpAmp"
                  className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="text-xs text-gray-400 block mb-2">Префикс обозначения</label>
                <input
                  type="text"
                  value={componentPrefix}
                  onChange={(e) => setComponentPrefix(e.target.value)}
                  placeholder="U"
                  maxLength={2}
                  className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div className="pt-4 border-t border-border-color">
                <label className="text-xs text-gray-400 block mb-2">Инструменты рисования</label>
                <div className="space-y-2">
                  <button
                    onClick={() => setDrawMode('line')}
                    className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                      drawMode === 'line' ? 'bg-blue-600' : 'bg-dark-bg hover:bg-dark-hover'
                    }`}
                  >
                    Линия
                  </button>
                  <button
                    onClick={() => setDrawMode('rectangle')}
                    className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                      drawMode === 'rectangle' ? 'bg-blue-600' : 'bg-dark-bg hover:bg-dark-hover'
                    }`}
                  >
                    Прямоугольник
                  </button>
                  <button
                    onClick={() => setDrawMode('circle')}
                    className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                      drawMode === 'circle' ? 'bg-blue-600' : 'bg-dark-bg hover:bg-dark-hover'
                    }`}
                  >
                    Круг
                  </button>
                  <button
                    onClick={() => setDrawMode('pin')}
                    className={`w-full px-3 py-2 rounded text-sm transition-colors ${
                      drawMode === 'pin' ? 'bg-green-600' : 'bg-dark-bg hover:bg-dark-hover'
                    }`}
                  >
                    <Plus size={16} className="inline mr-2" />
                    Добавить Pin
                  </button>
                </div>
              </div>
              
              <div className="pt-4 border-t border-border-color">
                <label className="text-xs text-gray-400 block mb-2">Пины ({pins.length})</label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {pins.map((pin, index) => (
                    <div key={pin.id} className="flex items-center justify-between text-xs bg-dark-bg p-2 rounded">
                      <span>Pin {pin.number}</span>
                      <button
                        onClick={() => setPins(pins.filter((_, i) => i !== index))}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              <button
                onClick={clearCanvas}
                className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
              >
                Очистить всё
              </button>
            </div>
          </div>
          
          {/* Center - Canvas */}
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={500}
                height={500}
                className="border border-border-color rounded cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              />
              <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs">
                Режим: {
                  drawMode === 'line' ? 'Линия' :
                  drawMode === 'rectangle' ? 'Прямоугольник' :
                  drawMode === 'circle' ? 'Круг' :
                  'Добавление Pin'
                }
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border-color">
          <div className="text-sm text-gray-400">
            Красный крест - центр компонента (0, 0)
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border-color rounded hover:bg-dark-hover transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors flex items-center gap-2"
            >
              <Save size={16} />
              Сохранить компонент
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

