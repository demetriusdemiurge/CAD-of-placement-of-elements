import { Eye, EyeOff, Lock, Unlock } from 'lucide-react'
import { useStore } from '../store/useStore'

export default function LayerManager() {
  const { layers, activeLayer, toggleLayer, setActiveLayer } = useStore()
  
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-4 text-gray-300">Слои</h3>
      
      <div className="space-y-2">
        {layers.map(layer => (
          <div
            key={layer.id}
            className={`flex items-center gap-2 p-2 rounded transition-colors ${
              activeLayer === layer.id ? 'bg-dark-hover' : 'hover:bg-dark-hover'
            }`}
          >
            <button
              onClick={() => toggleLayer(layer.id)}
              className="p-1 hover:bg-dark-bg rounded"
              title={layer.visible ? 'Скрыть слой' : 'Показать слой'}
            >
              {layer.visible ? (
                <Eye size={16} />
              ) : (
                <EyeOff size={16} className="text-gray-500" />
              )}
            </button>
            
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: layer.color }}
            />
            
            <button
              onClick={() => setActiveLayer(layer.id)}
              className="flex-1 text-left text-sm"
            >
              {layer.name}
            </button>
            
            <button
              className="p-1 hover:bg-dark-bg rounded"
              title={layer.locked ? 'Разблокировать' : 'Заблокировать'}
            >
              {layer.locked ? (
                <Lock size={14} className="text-gray-500" />
              ) : (
                <Unlock size={14} />
              )}
            </button>
          </div>
        ))}
      </div>
      
      <button className="w-full mt-4 py-2 border border-border-color rounded hover:bg-dark-hover transition-colors text-sm">
        + Добавить слой
      </button>
    </div>
  )
}

