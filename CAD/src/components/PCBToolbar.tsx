/**
 * Панель инструментов для PCB редактора
 */

import {
  MousePointer2,
  Move,
  RotateCw,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Route,
  Package,
  Circle,
  Ruler,
  Wand2,
  Layers,
  Play
} from 'lucide-react'
import { usePCBStore, PCBTool } from '../store/pcbStore'

export default function PCBToolbar() {
  const {
    activeTool,
    setActiveTool,
    zoom,
    setZoom,
    setPan,
    activeLayer,
    setActiveLayer,
    board
  } = usePCBStore()

  const tools: Array<{ id: PCBTool; icon: any; label: string }> = [
    { id: 'select', icon: MousePointer2, label: 'Выбрать (V)' },
    { id: 'move', icon: Move, label: 'Панорама (M)' },
    { id: 'rotate', icon: RotateCw, label: 'Повернуть (R)' },
    { id: 'place', icon: Package, label: 'Разместить корпус' },
    { id: 'trace', icon: Route, label: 'Дорожка (T)' },
    { id: 'via', icon: Circle, label: 'Переходное отверстие' },
    { id: 'measure', icon: Ruler, label: 'Измерить' },
    { id: 'delete', icon: Trash2, label: 'Удалить' },
  ]

  const handleZoomIn = () => {
    setZoom(zoom * 1.2)
  }

  const handleZoomOut = () => {
    setZoom(zoom / 1.2)
  }

  const handleZoomFit = () => {
    setZoom(4)
    setPan({ x: 100, y: 100 })
  }

  const toggleLayer = () => {
    setActiveLayer(
      activeLayer === 'top-copper' ? 'bottom-copper' : 'top-copper'
    )
  }

  return (
    <div className="w-16 bg-dark-panel border-r border-border-color flex flex-col items-center py-4 gap-2">
      {/* Инструменты */}
      {tools.map(tool => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
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

      <div className="w-10 h-px bg-border-color my-2" />

      {/* Переключатель слоев */}
      <button
        onClick={toggleLayer}
        className={`w-12 h-12 flex items-center justify-center rounded transition-all ${
          activeLayer === 'top-copper'
            ? 'bg-red-600 text-white'
            : 'bg-blue-600 text-white'
        }`}
        title={`Слой: ${activeLayer === 'top-copper' ? 'Верхний' : 'Нижний'}`}
      >
        <Layers size={20} />
      </button>

      <div className="flex-1" />

      <div className="w-10 h-px bg-border-color my-2" />

      {/* Зум */}
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
