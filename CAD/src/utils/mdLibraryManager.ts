/**
 * Менеджер библиотек корпусов (.md файлы)
 * Формат: JSON массив корпусов
 */

import { Footprint } from '../types/pcb'
import { parseEmpFile, exportToEmp, createStandardFootprints } from './footprintParser'

// Интерфейс библиотеки корпусов
export interface MdLibrary {
  name: string
  version: string
  description?: string
  footprints: Footprint[]
  createdAt: string
  modifiedAt: string
}

// Загруженная библиотека с метаданными
export interface LoadedFootprintLibrary {
  name: string
  fileName: string
  library: MdLibrary
  loadedAt: Date
}

/**
 * Парсит содержимое .md файла и возвращает MdLibrary
 */
export function parseMdLibrary(content: string, fileName?: string): MdLibrary | null {
  try {
    const data = JSON.parse(content)
    
    // Проверяем формат
    if (!data.footprints || !Array.isArray(data.footprints)) {
      console.error('Invalid MD library format: missing footprints array')
      return null
    }

    return {
      name: data.name || fileName?.replace('.md', '') || 'Unknown',
      version: data.version || '1.0',
      description: data.description,
      footprints: data.footprints,
      createdAt: data.createdAt || new Date().toISOString(),
      modifiedAt: data.modifiedAt || new Date().toISOString()
    }
  } catch (error) {
    console.error('Error parsing MD library:', error)
    return null
  }
}

/**
 * Экспортирует библиотеку в формат .md (JSON)
 */
export function exportMdLibrary(library: MdLibrary): string {
  const exportData = {
    ...library,
    modifiedAt: new Date().toISOString()
  }
  return JSON.stringify(exportData, null, 2)
}

/**
 * Создает новую пустую библиотеку
 */
export function createEmptyLibrary(name: string, description?: string): MdLibrary {
  return {
    name,
    version: '1.0',
    description,
    footprints: [],
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString()
  }
}

/**
 * Создает библиотеку со стандартными корпусами
 */
export function createStandardLibrary(): MdLibrary {
  return {
    name: 'Standard Footprints',
    version: '1.0',
    description: 'Стандартные корпуса SMD компонентов',
    footprints: createStandardFootprints(),
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString()
  }
}

/**
 * Добавляет корпус в библиотеку
 */
export function addFootprintToLibrary(library: MdLibrary, footprint: Footprint): MdLibrary {
  // Проверяем на дублирование имени
  const existingIndex = library.footprints.findIndex(f => f.name === footprint.name)
  
  if (existingIndex >= 0) {
    // Заменяем существующий
    const newFootprints = [...library.footprints]
    newFootprints[existingIndex] = footprint
    return {
      ...library,
      footprints: newFootprints,
      modifiedAt: new Date().toISOString()
    }
  }

  return {
    ...library,
    footprints: [...library.footprints, footprint],
    modifiedAt: new Date().toISOString()
  }
}

/**
 * Удаляет корпус из библиотеки
 */
export function removeFootprintFromLibrary(library: MdLibrary, footprintId: string): MdLibrary {
  return {
    ...library,
    footprints: library.footprints.filter(f => f.id !== footprintId),
    modifiedAt: new Date().toISOString()
  }
}

/**
 * Загружает библиотеку из файла
 */
export async function loadLibraryFromFile(file: File): Promise<LoadedFootprintLibrary | null> {
  try {
    const content = await file.text()
    const ext = file.name.toLowerCase().split('.').pop()

    if (ext === 'md') {
      // Загрузка .md библиотеки
      const library = parseMdLibrary(content, file.name)
      if (!library) return null

      return {
        name: library.name,
        fileName: file.name,
        library,
        loadedAt: new Date()
      }
    } else if (ext === 'emp') {
      // Загрузка отдельного .emp файла как библиотеки с одним корпусом
      const footprint = parseEmpFile(content, file.name)
      if (!footprint) return null

      const library: MdLibrary = {
        name: file.name.replace('.emp', ''),
        version: '1.0',
        footprints: [footprint],
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      }

      return {
        name: library.name,
        fileName: file.name,
        library,
        loadedAt: new Date()
      }
    }

    console.error('Unsupported file format:', ext)
    return null
  } catch (error) {
    console.error('Error loading library from file:', error)
    return null
  }
}

/**
 * Загружает библиотеку по URL
 */
export async function loadLibraryFromUrl(url: string): Promise<LoadedFootprintLibrary | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error('Failed to fetch library:', url, response.status)
      return null
    }

    const content = await response.text()
    const fileName = url.split('/').pop() || 'unknown.md'
    const library = parseMdLibrary(content, fileName)

    if (!library) return null

    return {
      name: library.name,
      fileName,
      library,
      loadedAt: new Date()
    }
  } catch (error) {
    console.error('Error loading library from URL:', error)
    return null
  }
}

/**
 * Сохраняет библиотеки в localStorage
 */
export function saveLibrariesToLocalStorage(libraries: LoadedFootprintLibrary[]): void {
  try {
    const data = libraries.map(lib => ({
      name: lib.name,
      fileName: lib.fileName,
      library: lib.library,
      loadedAt: lib.loadedAt.toISOString()
    }))
    localStorage.setItem('footprint-libraries', JSON.stringify(data))
  } catch (error) {
    console.error('Error saving libraries to localStorage:', error)
  }
}

/**
 * Загружает библиотеки из localStorage
 */
export function loadLibrariesFromLocalStorage(): LoadedFootprintLibrary[] {
  try {
    const data = localStorage.getItem('footprint-libraries')
    if (!data) return []

    const parsed = JSON.parse(data)
    return parsed.map((lib: any) => ({
      name: lib.name,
      fileName: lib.fileName,
      library: lib.library,
      loadedAt: new Date(lib.loadedAt)
    }))
  } catch (error) {
    console.error('Error loading libraries from localStorage:', error)
    return []
  }
}

/**
 * Поиск корпуса по имени в библиотеках
 */
export function findFootprintByName(
  libraries: LoadedFootprintLibrary[], 
  name: string
): Footprint | null {
  for (const lib of libraries) {
    const footprint = lib.library.footprints.find(f => f.name === name)
    if (footprint) return footprint
  }
  return null
}

/**
 * Поиск корпуса по ID
 */
export function findFootprintById(
  libraries: LoadedFootprintLibrary[],
  id: string
): Footprint | null {
  for (const lib of libraries) {
    const footprint = lib.library.footprints.find(f => f.id === id)
    if (footprint) return footprint
  }
  return null
}

/**
 * Получает все корпуса из всех библиотек
 */
export function getAllFootprints(libraries: LoadedFootprintLibrary[]): Array<{
  footprint: Footprint
  libraryName: string
}> {
  const result: Array<{ footprint: Footprint; libraryName: string }> = []
  
  for (const lib of libraries) {
    for (const footprint of lib.library.footprints) {
      result.push({
        footprint,
        libraryName: lib.name
      })
    }
  }
  
  return result
}

/**
 * Экспортирует корпус в .emp файл
 */
export function exportFootprintToEmp(footprint: Footprint): string {
  return exportToEmp(footprint)
}

/**
 * Сканирует папку data для библиотек корпусов
 */
export async function scanDataFolderForFootprints(): Promise<string[]> {
  try {
    const response = await fetch('/data/manifest.json')
    if (response.ok) {
      const manifest = await response.json()
      return manifest.footprintLibraries || []
    }
  } catch {
    // manifest.json не существует или не содержит footprintLibraries
  }
  return []
}

/**
 * Загружает все библиотеки из папки data
 */
export async function loadAllLibrariesFromData(): Promise<LoadedFootprintLibrary[]> {
  const libraryPaths = await scanDataFolderForFootprints()
  const libraries: LoadedFootprintLibrary[] = []

  for (const path of libraryPaths) {
    const library = await loadLibraryFromUrl(`/data/${path}`)
    if (library) {
      libraries.push(library)
    }
  }

  // Добавляем стандартную библиотеку если нет других
  if (libraries.length === 0) {
    const standardLib = createStandardLibrary()
    libraries.push({
      name: standardLib.name,
      fileName: 'standard.md',
      library: standardLib,
      loadedAt: new Date()
    })
  }

  return libraries
}

/**
 * Объединяет несколько библиотек в одну
 */
export function mergeLibraries(libraries: MdLibrary[], name: string): MdLibrary {
  const allFootprints: Footprint[] = []
  const seenIds = new Set<string>()

  for (const lib of libraries) {
    for (const fp of lib.footprints) {
      if (!seenIds.has(fp.id)) {
        allFootprints.push(fp)
        seenIds.add(fp.id)
      }
    }
  }

  return {
    name,
    version: '1.0',
    description: `Объединенная библиотека из ${libraries.length} библиотек`,
    footprints: allFootprints,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString()
  }
}
