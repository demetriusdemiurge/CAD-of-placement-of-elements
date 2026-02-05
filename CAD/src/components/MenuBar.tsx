import { useState, useRef } from 'react'
import { useStore } from '../store/useStore'
import { exportProject, exportToSVG, importProject } from '../utils/projectUtils'

export default function MenuBar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { components, wires, layers, toggleGrid, toggleSnapToGrid, newProject } = useStore()
  
  const handleExportJSON = () => {
    exportProject('my-schematic', components, wires, layers)
    setActiveMenu(null)
  }
  
  const handleExportSVG = () => {
    exportToSVG(components, wires)
    setActiveMenu(null)
  }
  
  const handleImport = () => {
    fileInputRef.current?.click()
  }
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      const project = await importProject(file)
      // Here you would load the project into the store
      console.log('Imported project:', project)
      alert('Проект успешно импортирован!')
    } catch (error) {
      alert('Ошибка при импорте проекта')
    }
    
    setActiveMenu(null)
  }
  
  const menus = {
    file: [
      { label: 'Новый проект', shortcut: 'Ctrl+N', action: newProject },
      { label: 'Открыть...', shortcut: 'Ctrl+O', action: handleImport },
      { label: 'Сохранить', shortcut: 'Ctrl+S', action: handleExportJSON },
      { label: 'Сохранить как...', shortcut: 'Ctrl+Shift+S', action: handleExportJSON },
      { divider: true },
      { label: 'Экспорт в SVG', action: handleExportSVG },
      { label: 'Экспорт в PNG', action: () => {} },
    ],
    edit: [
      { label: 'Отменить', shortcut: 'Ctrl+Z', action: () => {} },
      { label: 'Повторить', shortcut: 'Ctrl+Y', action: () => {} },
      { divider: true },
      { label: 'Копировать', shortcut: 'Ctrl+C', action: () => {} },
      { label: 'Вставить', shortcut: 'Ctrl+V', action: () => {} },
      { label: 'Удалить', shortcut: 'Del', action: () => {} },
    ],
    view: [
      { label: 'Показать сетку', shortcut: 'Ctrl+G', action: toggleGrid },
      { label: 'Привязка к сетке', shortcut: 'Ctrl+Shift+G', action: toggleSnapToGrid },
      { divider: true },
      { label: 'Увеличить', shortcut: 'Ctrl++', action: () => {} },
      { label: 'Уменьшить', shortcut: 'Ctrl+-', action: () => {} },
      { label: 'По размеру окна', shortcut: 'Ctrl+0', action: () => {} },
    ],
  }
  
  return (
    <>
      <div className="flex items-center gap-1 text-sm">
        {Object.entries(menus).map(([key, items]) => (
          <div key={key} className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === key ? null : key)}
              className={`px-3 py-1 rounded hover:bg-dark-hover transition-colors ${
                activeMenu === key ? 'bg-dark-hover' : ''
              }`}
            >
              {key === 'file' ? 'Файл' : key === 'edit' ? 'Правка' : 'Вид'}
            </button>
            
            {activeMenu === key && (
              <div className="absolute top-full left-0 mt-1 bg-dark-panel border border-border-color rounded-lg shadow-2xl py-2 min-w-[220px] z-50">
                {items.map((item: any, index: number) => 
                  item.divider ? (
                    <div key={index} className="h-px bg-border-color my-2" />
                  ) : (
                    <button
                      key={index}
                      onClick={item.action}
                      className="w-full px-4 py-2 hover:bg-dark-hover transition-colors flex items-center justify-between text-sm"
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span className="text-xs text-gray-500 ml-8">{item.shortcut}</span>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.kicad.json"
        onChange={handleFileChange}
        className="hidden"
      />
      
      {activeMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActiveMenu(null)}
        />
      )}
    </>
  )
}

