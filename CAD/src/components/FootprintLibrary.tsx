/**
 * FootprintLibrary - Библиотека корпусов
 */

import { useState, useEffect, useRef } from 'react'
import { 
  Search, 
  ChevronRight, 
  ChevronDown, 
  Upload, 
  Trash2, 
  Loader2, 
  Package,
  Download,
  Eye
} from 'lucide-react'
import { usePCBStore } from '../store/pcbStore'
import { Footprint } from '../types/pcb'
import { drawFootprintPreview } from '../utils/pcbCanvasUtils'
import { exportFootprintToEmp, exportMdLibrary } from '../utils/mdLibraryManager'

export default function FootprintLibrary() {
  const [expandedLibraries, setExpandedLibraries] = useState<string[]>(['Standard Footprints'])
  const [searchTerm, setSearchTerm] = useState('')
  const [previewFootprint, setPreviewFootprint] = useState<Footprint | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  const {
    footprintLibraries,
    librariesLoading,
    selectedFootprint,
    loadFootprintLibraries,
    loadFootprintLibraryFromFile,
    removeFootprintLibrary,
    setSelectedFootprint,
    setActiveTool
  } = usePCBStore()

  // Загрузка библиотек при монтировании
  useEffect(() => {
    loadFootprintLibraries()
  }, [])

  // Отрисовка превью
  useEffect(() => {
    if (previewFootprint && previewCanvasRef.current) {
      const ctx = previewCanvasRef.current.getContext('2d')
      if (ctx) {
        drawFootprintPreview(
          ctx,
          previewFootprint,
          previewCanvasRef.current.width,
          previewCanvasRef.current.height
        )
      }
    }
  }, [previewFootprint])

  const toggleLibrary = (libraryName: string) => {
    setExpandedLibraries(prev =>
      prev.includes(libraryName)
        ? prev.filter(l => l !== libraryName)
        : [...prev, libraryName]
    )
  }

  const handleFootprintSelect = (footprint: Footprint) => {
    setSelectedFootprint(footprint)
    setActiveTool('place')
  }

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      await loadFootprintLibraryFromFile(file)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleExportFootprint = (footprint: Footprint) => {
    const empContent = exportFootprintToEmp(footprint)
    const blob = new Blob([empContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${footprint.name}.emp`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportLibrary = (libraryName: string) => {
    const library = footprintLibraries.find(l => l.name === libraryName)
    if (!library) return

    const mdContent = exportMdLibrary(library.library)
    const blob = new Blob([mdContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${libraryName}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Фильтрация по поиску
  const filteredLibraries = footprintLibraries.map(lib => ({
    ...lib,
    library: {
      ...lib.library,
      footprints: lib.library.footprints.filter(fp =>
        fp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (fp.description && fp.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }
  })).filter(lib => lib.library.footprints.length > 0 || searchTerm === '')

  return (
    <div className="flex flex-col h-full">
      {/* Заголовок и поиск */}
      <div className="p-4 border-b border-border-color">
        <h2 className="text-sm font-semibold mb-3 text-gray-300 flex items-center gap-2">
          <Package size={16} />
          Библиотека корпусов
        </h2>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Поиск корпусов..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-dark-bg border border-border-color rounded text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={librariesLoading}
          className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm transition-colors flex items-center justify-center gap-2"
        >
          {librariesLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Upload size={16} />
          )}
          Импорт .emp / .md
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".emp,.md"
          multiple
          onChange={handleFileImport}
          className="hidden"
        />
      </div>

      {/* Список библиотек */}
      <div className="flex-1 overflow-y-auto">
        {filteredLibraries.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {librariesLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 size={20} className="animate-spin" />
                Загрузка библиотек...
              </div>
            ) : (
              'Библиотеки не найдены'
            )}
          </div>
        ) : (
          filteredLibraries.map(lib => (
            <div key={lib.name} className="border-b border-border-color">
              {/* Заголовок библиотеки */}
              <div className="flex items-center">
                <button
                  onClick={() => toggleLibrary(lib.name)}
                  className="flex-1 px-4 py-3 flex items-center gap-2 hover:bg-dark-hover transition-colors text-left"
                >
                  {expandedLibraries.includes(lib.name) ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                  <span className="text-sm font-medium">{lib.name}</span>
                  <span className="text-xs text-gray-500 ml-auto mr-2">
                    {lib.library.footprints.length}
                  </span>
                </button>
                <button
                  onClick={() => handleExportLibrary(lib.name)}
                  className="p-2 text-blue-400 hover:text-blue-300 hover:bg-dark-hover transition-all"
                  title="Экспорт библиотеки"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => removeFootprintLibrary(lib.name)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-dark-hover transition-all"
                  title="Удалить библиотеку"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Список корпусов */}
              {expandedLibraries.includes(lib.name) && (
                <div className="pb-2">
                  {lib.library.footprints.length === 0 ? (
                    <div className="px-8 py-2 text-sm text-gray-500 italic">
                      Нет корпусов
                    </div>
                  ) : (
                    lib.library.footprints.map(fp => (
                      <div
                        key={fp.id}
                        className={`w-full px-4 py-2 hover:bg-dark-hover transition-colors flex items-center justify-between group ${
                          selectedFootprint?.id === fp.id ? 'bg-blue-600/20' : ''
                        }`}
                      >
                        <button
                          onClick={() => handleFootprintSelect(fp)}
                          className="flex-1 text-left flex items-center gap-2"
                        >
                          <Package size={14} className="text-gray-500" />
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-300">{fp.name}</span>
                            {fp.description && (
                              <span className="text-xs text-gray-500">{fp.description}</span>
                            )}
                          </div>
                        </button>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setPreviewFootprint(fp)}
                            className="p-1 text-gray-400 hover:text-gray-300"
                            title="Просмотр"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleExportFootprint(fp)}
                            className="p-1 text-blue-400 hover:text-blue-300"
                            title="Экспорт .emp"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Панель превью */}
      {previewFootprint && (
        <div className="border-t border-border-color p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium">{previewFootprint.name}</h3>
            <button
              onClick={() => setPreviewFootprint(null)}
              className="text-gray-400 hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          <canvas
            ref={previewCanvasRef}
            width={200}
            height={150}
            className="w-full bg-dark-bg rounded border border-border-color"
          />
          <div className="mt-2 text-xs text-gray-500">
            <p>Размер: {previewFootprint.width.toFixed(2)} x {previewFootprint.height.toFixed(2)} мм</p>
            <p>Площадок: {previewFootprint.pads.length}</p>
          </div>
          <button
            onClick={() => {
              handleFootprintSelect(previewFootprint)
              setPreviewFootprint(null)
            }}
            className="w-full mt-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
          >
            Разместить
          </button>
        </div>
      )}

      {/* Выбранный корпус */}
      {selectedFootprint && !previewFootprint && (
        <div className="border-t border-border-color p-4 bg-blue-600/10">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-blue-400" />
            <div>
              <p className="text-sm font-medium">{selectedFootprint.name}</p>
              <p className="text-xs text-gray-500">Готов к размещению</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
