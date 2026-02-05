import { useState, useEffect, useRef } from 'react'
import { Search, ChevronRight, ChevronDown, Plus, Trash2, Upload, FolderOpen, Loader2 } from 'lucide-react'
import { useStore, LibraryComponent } from '../store/useStore'
import CustomComponentEditor from './CustomComponentEditor'

interface ComponentCategory {
  name: string
  items: { id: string; name: string; symbol: string }[]
}

const componentLibrary: ComponentCategory[] = [
  {
    name: 'Пассивные компоненты',
    items: [
      { id: 'resistor', name: 'Резистор', symbol: 'R' },
      { id: 'capacitor', name: 'Конденсатор', symbol: 'C' },
      { id: 'inductor', name: 'Катушка индуктивности', symbol: 'L' },
      { id: 'diode', name: 'Диод', symbol: 'D' },
    ]
  },
  {
    name: 'Активные компоненты',
    items: [
      { id: 'transistor-npn', name: 'Транзистор NPN', symbol: 'Q' },
      { id: 'transistor-pnp', name: 'Транзистор PNP', symbol: 'Q' },
      { id: 'mosfet-n', name: 'MOSFET N-канальный', symbol: 'Q' },
      { id: 'opamp', name: 'Операционный усилитель', symbol: 'U' },
    ]
  },
  {
    name: 'Цифровые компоненты',
    items: [
      { id: 'and-gate', name: 'И (AND)', symbol: 'U' },
      { id: 'or-gate', name: 'ИЛИ (OR)', symbol: 'U' },
      { id: 'not-gate', name: 'НЕ (NOT)', symbol: 'U' },
      { id: 'flip-flop', name: 'Триггер', symbol: 'U' },
    ]
  },
  {
    name: 'Источники питания',
    items: [
      { id: 'voltage-source', name: 'Источник напряжения', symbol: 'V' },
      { id: 'current-source', name: 'Источник тока', symbol: 'I' },
      { id: 'ground', name: 'Земля', symbol: 'GND' },
      { id: 'vcc', name: 'VCC', symbol: 'VCC' },
    ]
  },
  {
    name: 'Соединители',
    items: [
      { id: 'connector-2', name: 'Разъем 2-pin', symbol: 'J' },
      { id: 'connector-4', name: 'Разъем 4-pin', symbol: 'J' },
      { id: 'connector-8', name: 'Разъем 8-pin', symbol: 'J' },
      { id: 'header', name: 'Штыревой разъем', symbol: 'J' },
    ]
  },
]

export default function ComponentLibrary() {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Пассивные компоненты'])
  const [searchTerm, setSearchTerm] = useState('')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { 
    setSelectedComponentType, 
    setActiveTool, 
    customComponents, 
    addCustomComponent, 
    removeCustomComponent,
    kicadLibraries,
    librariesLoading,
    loadKicadLibrariesFromData,
    loadKicadLibraryFromFile,
    removeKicadLibrary
  } = useStore()
  
  // Загружаем библиотеки из папки data при первом рендере
  useEffect(() => {
    loadKicadLibrariesFromData()
  }, [])
  
  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    )
  }
  
  const handleComponentSelect = (componentId: string) => {
    setSelectedComponentType(componentId)
    setActiveTool('component')
  }
  
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return
    
    for (const file of Array.from(files)) {
      await loadKicadLibraryFromFile(file)
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  const filteredLibrary = componentLibrary.map(category => ({
    ...category,
    items: category.items.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.items.length > 0)
  
  // Add custom components category
  const customCategory = {
    name: 'Пользовательские компоненты',
    items: customComponents.map(c => ({
      id: `custom-${c.name}`,
      name: c.name,
      symbol: c.prefix
    })),
    isCustom: true,
    isKicad: false
  }
  
  // Add KiCad libraries as categories
  const kicadCategories = kicadLibraries.map(lib => ({
    name: `📦 ${lib.name}`,
    libraryName: lib.name,
    items: lib.components
      .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(c => ({
        id: `kicad-${lib.name}-${c.name}`,
        name: c.name,
        symbol: c.prefix
      })),
    isCustom: false,
    isKicad: true
  })).filter(cat => cat.items.length > 0 || searchTerm === '')
  
  const allCategories = [
    ...(customComponents.length > 0 ? [customCategory] : []),
    ...kicadCategories,
    ...filteredLibrary.map(cat => ({ ...cat, isCustom: false, isKicad: false }))
  ]
  
  const handleSaveCustomComponent = (component: any) => {
    addCustomComponent(component)
  }
  
  return (
    <>
    <CustomComponentEditor
      isOpen={isEditorOpen}
      onClose={() => setIsEditorOpen(false)}
      onSave={handleSaveCustomComponent}
    />
    <div className="w-64 bg-dark-panel border-r border-border-color flex flex-col">
      <div className="p-4 border-b border-border-color">
        <h2 className="text-sm font-semibold mb-3 text-gray-300">Библиотека компонентов</h2>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Поиск..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-dark-bg border border-border-color rounded text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditorOpen(true)}
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Создать
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={librariesLoading}
            className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm transition-colors flex items-center justify-center gap-2"
          >
            {librariesLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            Импорт
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".lib,.kicad_sym,.emp"
          multiple
          onChange={handleFileImport}
          className="hidden"
        />
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {allCategories.map(category => (
          <div key={category.name} className="border-b border-border-color">
            <div className="flex items-center">
              <button
                onClick={() => toggleCategory(category.name)}
                className="flex-1 px-4 py-3 flex items-center gap-2 hover:bg-dark-hover transition-colors text-left"
              >
                {expandedCategories.includes(category.name) ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
                <span className="text-sm font-medium">{category.name}</span>
                {category.isKicad && (
                  <span className="text-xs text-green-400 ml-auto mr-2">KiCad</span>
                )}
              </button>
              {category.isKicad && (category as any).libraryName && (
                <button
                  onClick={() => removeKicadLibrary((category as any).libraryName)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-dark-hover transition-all"
                  title="Удалить библиотеку"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            
            {expandedCategories.includes(category.name) && (
              <div className="pb-2">
                {category.items.length === 0 ? (
                  <div className="px-8 py-2 text-sm text-gray-500 italic">
                    Нет компонентов
                  </div>
                ) : (
                  category.items.map(item => (
                    <div
                      key={item.id}
                      className="w-full px-8 py-2 hover:bg-dark-hover transition-colors flex items-center justify-between group"
                    >
                      <button
                        onClick={() => handleComponentSelect(item.id)}
                        className="flex-1 text-left flex items-center justify-between"
                      >
                        <span className="text-sm text-gray-300">{item.name}</span>
                        <span className="text-xs text-gray-500 font-mono">{item.symbol}</span>
                      </button>
                      {category.isCustom && (
                        <button
                          onClick={() => removeCustomComponent(item.name)}
                          className="ml-2 p-1 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Удалить"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
    </>
  )
}

