import { useStore } from '../store/useStore'

export default function StatusBar() {
  const { activeTool, gridSize, showGrid, snapToGrid, components, wires } = useStore()
  
  const toolNames: Record<string, string> = {
    select: 'Выбор',
    move: 'Перемещение',
    rotate: 'Поворот',
    wire: 'Провод',
    bus: 'Шина',
    label: 'Метка',
    junction: 'Узел',
    component: 'Компонент',
    delete: 'Удаление',
  }
  
  return (
    <div className="h-8 bg-dark-panel border-t border-border-color flex items-center px-4 text-xs text-gray-400">
      <div className="flex items-center gap-4">
        <span>Инструмент: <span className="text-white">{toolNames[activeTool]}</span></span>
        
        <div className="w-px h-4 bg-border-color" />
        
        <span>Сетка: <span className="text-white">{gridSize}px</span></span>
        
        <span className={showGrid ? 'text-green-400' : ''}>
          {showGrid ? '✓' : '✗'} Отображение
        </span>
        
        <span className={snapToGrid ? 'text-green-400' : ''}>
          {snapToGrid ? '✓' : '✗'} Привязка
        </span>
        
        <div className="w-px h-4 bg-border-color" />
        
        <span>Компонентов: <span className="text-white">{components.length}</span></span>
        <span>Соединений: <span className="text-white">{wires.length}</span></span>
      </div>
      
      <div className="flex-1" />
      
      <span className="text-gray-500">KiCad Analog v1.0.0</span>
    </div>
  )
}

