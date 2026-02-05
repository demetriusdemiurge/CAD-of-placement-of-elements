/**
 * Утилита для загрузки библиотек компонентов
 */

import { 
  parseKiCadFile, 
  convertToAppComponent, 
  KiCadLibrary, 
  KiCadSymbol 
} from './kicadParser'

export interface LibraryComponent {
  id: string
  name: string
  prefix: string
  libraryName: string
  pins: any[]
  shapes: any[]
  properties: Record<string, string>
}

export interface LoadedLibrary {
  name: string
  fileName: string
  components: LibraryComponent[]
  loadedAt: Date
}

/**
 * Загружает библиотеку из файла (через File API)
 */
export async function loadLibraryFromFile(file: File): Promise<LoadedLibrary | null> {
  try {
    const content = await file.text()
    const result = parseKiCadFile(content, file.name)
    
    if (!result) {
      console.error('Failed to parse library file:', file.name)
      return null
    }

    // Если это библиотека (с массивом символов)
    if ('symbols' in result) {
      const library = result as KiCadLibrary
      return {
        name: library.name,
        fileName: file.name,
        components: library.symbols.map((symbol, index) => {
          const converted = convertToAppComponent(symbol)
          return {
            id: `${library.name}-${symbol.name}-${index}`,
            name: converted.name,
            prefix: converted.prefix,
            libraryName: library.name,
            pins: converted.pins,
            shapes: converted.shapes,
            properties: converted.properties
          }
        }),
        loadedAt: new Date()
      }
    }
    
    // Если это отдельный символ (из .emp файла)
    const symbol = result as KiCadSymbol
    const converted = convertToAppComponent(symbol)
    return {
      name: file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      components: [{
        id: `single-${symbol.name}`,
        name: converted.name,
        prefix: converted.prefix,
        libraryName: file.name.replace(/\.[^.]+$/, ''),
        pins: converted.pins,
        shapes: converted.shapes,
        properties: converted.properties
      }],
      loadedAt: new Date()
    }
  } catch (error) {
    console.error('Error loading library:', error)
    return null
  }
}

/**
 * Загружает библиотеку по URL (для предзагруженных библиотек в папке data)
 */
export async function loadLibraryFromUrl(url: string, libraryName?: string): Promise<LoadedLibrary | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error('Failed to fetch library:', url, response.status)
      return null
    }
    
    const content = await response.text()
    const fileName = url.split('/').pop() || 'unknown.lib'
    const result = parseKiCadFile(content, fileName)
    
    if (!result) {
      console.error('Failed to parse library from URL:', url)
      return null
    }

    if ('symbols' in result) {
      const library = result as KiCadLibrary
      return {
        name: libraryName || library.name,
        fileName,
        components: library.symbols.map((symbol, index) => {
          const converted = convertToAppComponent(symbol)
          return {
            id: `${library.name}-${symbol.name}-${index}`,
            name: converted.name,
            prefix: converted.prefix,
            libraryName: libraryName || library.name,
            pins: converted.pins,
            shapes: converted.shapes,
            properties: converted.properties
          }
        }),
        loadedAt: new Date()
      }
    }
    
    const symbol = result as KiCadSymbol
    const converted = convertToAppComponent(symbol)
    return {
      name: libraryName || fileName.replace(/\.[^.]+$/, ''),
      fileName,
      components: [{
        id: `single-${symbol.name}`,
        name: converted.name,
        prefix: converted.prefix,
        libraryName: libraryName || fileName.replace(/\.[^.]+$/, ''),
        pins: converted.pins,
        shapes: converted.shapes,
        properties: converted.properties
      }],
      loadedAt: new Date()
    }
  } catch (error) {
    console.error('Error loading library from URL:', error)
    return null
  }
}

/**
 * Сканирует папку data на наличие библиотек
 * Возвращает список путей к файлам библиотек
 */
export async function scanDataFolder(): Promise<string[]> {
  // В браузерном окружении мы не можем сканировать папки напрямую
  // Поэтому загружаем manifest.json, если он есть
  try {
    const response = await fetch('/data/manifest.json')
    if (response.ok) {
      const manifest = await response.json()
      return manifest.libraries || []
    }
  } catch {
    // manifest.json не существует
  }
  
  // Возвращаем пустой массив, если manifest не найден
  return []
}

/**
 * Загружает все библиотеки из папки data
 */
export async function loadAllLibrariesFromData(): Promise<LoadedLibrary[]> {
  const libraryPaths = await scanDataFolder()
  const libraries: LoadedLibrary[] = []
  
  for (const path of libraryPaths) {
    const library = await loadLibraryFromUrl(`/data/${path}`)
    if (library) {
      libraries.push(library)
    }
  }
  
  return libraries
}

/**
 * Экспортирует компонент в формат .emp
 */
export function exportToEmp(component: LibraryComponent): string {
  const empData = {
    name: component.name,
    reference: component.prefix,
    prefix: component.prefix,
    value: component.properties.value || component.name,
    footprint: component.properties.footprint,
    datasheet: component.properties.datasheet,
    description: component.properties.description,
    pins: component.pins.map(pin => ({
      number: pin.number,
      name: pin.name,
      type: pin.type,
      x: pin.position.x,
      y: pin.position.y,
      length: 10,
      orientation: 'R'
    })),
    shapes: component.shapes,
    properties: component.properties
  }
  
  return JSON.stringify(empData, null, 2)
}

/**
 * Сохраняет библиотеку в localStorage для персистентности
 */
export function saveLibrariesToLocalStorage(libraries: LoadedLibrary[]): void {
  try {
    localStorage.setItem('kicad-libraries', JSON.stringify(libraries))
  } catch (error) {
    console.error('Error saving libraries to localStorage:', error)
  }
}

/**
 * Загружает библиотеки из localStorage
 */
export function loadLibrariesFromLocalStorage(): LoadedLibrary[] {
  try {
    const data = localStorage.getItem('kicad-libraries')
    if (data) {
      const libraries = JSON.parse(data)
      // Восстанавливаем Date объекты
      return libraries.map((lib: any) => ({
        ...lib,
        loadedAt: new Date(lib.loadedAt)
      }))
    }
  } catch (error) {
    console.error('Error loading libraries from localStorage:', error)
  }
  return []
}

