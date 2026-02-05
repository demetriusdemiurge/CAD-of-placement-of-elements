import { useRef, useState } from 'react'
import { Upload, FileText } from 'lucide-react'
import { useStore } from '../store/useStore'

export default function PropertiesPanel() {
  const { selectedObjects, components, wires, updateComponent, addComponent, addWire, clearAll } = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loadMessage, setLoadMessage] = useState<string>('')
  
  const selectedComponent = selectedObjects.length === 1 
    ? components.find(c => c.id === selectedObjects[0])
    : null
  
  const handlePropertyChange = (key: string, value: any) => {
    if (!selectedComponent) return
    
    if (key === 'position.x' || key === 'position.y') {
      const axis = key.split('.')[1]
      updateComponent(selectedComponent.id, {
        position: {
          ...selectedComponent.position,
          [axis]: parseFloat(value) || 0
        }
      })
    } else if (key.startsWith('properties.')) {
      const propKey = key.split('.')[1]
      updateComponent(selectedComponent.id, {
        properties: {
          ...selectedComponent.properties,
          [propKey]: value
        }
      })
    } else {
      updateComponent(selectedComponent.id, { [key]: value })
    }
  }
  
  return (
    <div className="flex-1 border-b border-border-color p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold mb-4 text-gray-300">Свойства</h3>
      
      {selectedComponent ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Тип</label>
            <input
              type="text"
              value={selectedComponent.type}
              disabled
              className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm opacity-60"
            />
          </div>
          
          <div>
            <label className="text-xs text-gray-400 block mb-1">Обозначение</label>
            <input
              type="text"
              value={selectedComponent.properties.reference || ''}
              onChange={(e) => handlePropertyChange('properties.reference', e.target.value)}
              placeholder="R1, C1, U1..."
              className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="text-xs text-gray-400 block mb-1">Значение</label>
            <input
              type="text"
              value={selectedComponent.properties.value || ''}
              onChange={(e) => handlePropertyChange('properties.value', e.target.value)}
              placeholder="10kΩ, 100nF..."
              className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">X</label>
              <input
                type="number"
                value={Math.round(selectedComponent.position.x)}
                onChange={(e) => handlePropertyChange('position.x', e.target.value)}
                className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Y</label>
              <input
                type="number"
                value={Math.round(selectedComponent.position.y)}
                onChange={(e) => handlePropertyChange('position.y', e.target.value)}
                className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="text-xs text-gray-400 block mb-1">Поворот</label>
            <select
              value={selectedComponent.rotation}
              onChange={(e) => handlePropertyChange('rotation', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-dark-bg border border-border-color rounded text-sm focus:outline-none focus:border-blue-500"
            >
              <option value={0}>0°</option>
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>
          </div>
          
          <div className="pt-2 border-t border-border-color">
            <div className="text-xs text-gray-500">
              ID: {selectedComponent.id}
            </div>
          </div>
        </div>
      ) : selectedObjects.length > 1 ? (
        <div className="text-sm text-gray-400">
          Выбрано объектов: {selectedObjects.length}
          <div className="mt-2 text-xs">
            Выберите один объект для редактирования свойств
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-400">
          <div className="mb-2">Выберите объект для редактирования свойств</div>
          <div className="text-xs">
            • Инструмент "Выбрать" (V)<br/>
            • Кликните по компоненту
          </div>
        </div>
      )}
      
      {/* Загрузка .sch файла */}
      <div className="mt-4 pt-4 border-t border-border-color">
        <h4 className="text-xs font-semibold text-gray-300 mb-2">Загрузка схемы</h4>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".sch,.kicad_sch"
          onChange={handleLoadSch}
          className="hidden"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded flex items-center justify-center gap-2"
        >
          <Upload size={14} />
          Загрузить .sch
        </button>
        
        {loadMessage && (
          <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
            <FileText size={12} />
            {loadMessage}
          </div>
        )}
        
        <div className="mt-2 text-xs text-gray-500">
          Компонентов: {components.length}, Проводов: {wires.length}
        </div>
      </div>
    </div>
  )
  
  // Загрузка .sch файла
  async function handleLoadSch(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      
      // Импортируем парсер
      const { parseSchematicFile } = await import('../utils/kicadSchematicParser')
      const result = parseSchematicFile(content, file.name)
      
      if (result && (result.components.length > 0 || result.wires.length > 0)) {
        // Очищаем и добавляем новые элементы
        clearAll()
        
        // Добавляем компоненты
        for (const comp of result.components) {
          addComponent(comp)
        }
        
        // Добавляем провода
        for (const wire of result.wires) {
          addWire(wire)
        }
        
        setLoadMessage(`Загружено: ${result.components.length} комп., ${result.wires.length} пров.`)
      } else {
        setLoadMessage('Файл пуст или не распознан')
      }
    } catch (error) {
      setLoadMessage(`Ошибка: ${error}`)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
}

