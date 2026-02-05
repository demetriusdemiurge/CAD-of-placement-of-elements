import { 
  MousePointer2, Move, RotateCw, Cable, 
  Tag, CircleDot, Minus, Trash2, 
  ZoomIn, ZoomOut, Maximize2 
} from 'lucide-react'
import { useStore } from '../store/useStore'

export default function Toolbar() {
  const { activeTool, setActiveTool, zoom, setZoom, setPan } = useStore()
  
  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Выбрать (V)' },
    { id: 'move', icon: Move, label: 'Панорама (M)' },
    { id: 'rotate', icon: RotateCw, label: 'Повернуть (R)' },
    { id: 'wire', icon: Cable, label: 'Провод (W)' },
    { id: 'bus', icon: Minus, label: 'Шина' },
    { id: 'label', icon: Tag, label: 'Метка (L)' },
    { id: 'junction', icon: CircleDot, label: 'Узел (J)' },
    { id: 'delete', icon: Trash2, label: 'Удалить' },
  ]
  
  const handleZoomIn = () => {
    setZoom(zoom * 1.2)
  }
  
  const handleZoomOut = () => {
    setZoom(zoom / 1.2)
  }
  
  const handleZoomFit = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }
  
  return (
    <div className="w-16 bg-dark-panel border-r border-border-color flex flex-col items-center py-4 gap-2">
      {tools.map(tool => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id as any)}
          className={`w-12 h-12 flex items-center justify-center rounded transition-all ${
            activeTool === tool.id 
              ? 'bg-blue-600 text-white' 
              : 'hover:bg-dark-hover text-gray-300'
          }`}
          title={tool.label}
        >
          <tool.icon size={20} />
        </button>
      ))}
      
      <div className="flex-1" />
      
      <div className="w-10 h-px bg-border-color my-2" />
      
      <button 
        onClick={handleZoomIn}
        className="w-12 h-12 flex items-center justify-center rounded hover:bg-dark-hover text-gray-300"
        title="Увеличить"
      >
        <ZoomIn size={20} />
      </button>
      <button 
        onClick={handleZoomOut}
        className="w-12 h-12 flex items-center justify-center rounded hover:bg-dark-hover text-gray-300"
        title="Уменьшить"
      >
        <ZoomOut size={20} />
      </button>
      <button 
        onClick={handleZoomFit}
        className="w-12 h-12 flex items-center justify-center rounded hover:bg-dark-hover text-gray-300"
        title="По размеру"
      >
        <Maximize2 size={20} />
      </button>
    </div>
  )
}

