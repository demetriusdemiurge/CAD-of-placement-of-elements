/**
 * KiCad Library Parser
 * Поддерживает форматы:
 * - .lib (устаревший текстовый формат KiCad 4-5)
 * - .kicad_sym (S-expression формат KiCad 6+)
 * - .emp (кастомный формат компонентов)
 */

import { Pin, Point } from '../store/useStore'

export interface KiCadSymbol {
  name: string
  reference: string
  value: string
  footprint?: string
  datasheet?: string
  description?: string
  pins: KiCadPin[]
  drawings: KiCadDrawing[]
  properties: Record<string, string>
}

export interface KiCadPin {
  number: string
  name: string
  type: PinElectricalType
  position: Point
  length: number
  orientation: 'U' | 'D' | 'L' | 'R'
  nameVisible: boolean
  numberVisible: boolean
}

export type PinElectricalType = 
  | 'input'
  | 'output'
  | 'bidirectional'
  | 'power_in'
  | 'power_out'
  | 'passive'
  | 'open_collector'
  | 'open_emitter'
  | 'unconnected'
  | 'unspecified'

export interface KiCadDrawing {
  type: 'rectangle' | 'circle' | 'arc' | 'polyline' | 'text'
  points?: Point[]
  center?: Point
  radius?: number
  startAngle?: number
  endAngle?: number
  text?: string
  fill: boolean
  strokeWidth: number
}

export interface KiCadLibrary {
  name: string
  version: string
  symbols: KiCadSymbol[]
}

/**
 * Парсит устаревший формат .lib (KiCad 4-5)
 */
export function parseLegacyLib(content: string, fileName: string): KiCadLibrary {
  const lines = content.split('\n').map(l => l.trim())
  const library: KiCadLibrary = {
    name: fileName.replace('.lib', ''),
    version: '2.4',
    symbols: []
  }

  let currentSymbol: KiCadSymbol | null = null
  let inDraw = false
  let i = 0

  // Чтение заголовка
  if (lines[0]?.startsWith('EESchema-LIBRARY')) {
    const versionMatch = lines[0].match(/Version\s+([\d.]+)/)
    if (versionMatch) {
      library.version = versionMatch[1]
    }
    i = 1
  }

  while (i < lines.length) {
    const line = lines[i]

    // Пропуск комментариев и пустых строк
    if (!line || line.startsWith('#')) {
      i++
      continue
    }

    // Начало определения компонента
    if (line.startsWith('DEF ')) {
      const parts = line.split(/\s+/)
      // DEF name reference unused text_offset draw_pinnumber draw_pinname unit_count units_locked option_flag
      currentSymbol = {
        name: parts[1] || 'Unknown',
        reference: parts[2] || 'U',
        value: parts[1] || '',
        pins: [],
        drawings: [],
        properties: {}
      }
      i++
      continue
    }

    // Поля компонента (F0, F1, F2, F3...)
    if (line.startsWith('F') && currentSymbol) {
      const fieldMatch = line.match(/^F(\d+)\s+"([^"]*)"\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+([HV])\s+([VIO])\s+([CLRBTJ]+)\s+([A-Z]+)/)
      if (fieldMatch) {
        const fieldNum = parseInt(fieldMatch[1])
        const fieldValue = fieldMatch[2]
        
        switch (fieldNum) {
          case 0:
            currentSymbol.reference = fieldValue || currentSymbol.reference
            break
          case 1:
            currentSymbol.value = fieldValue || currentSymbol.value
            break
          case 2:
            currentSymbol.footprint = fieldValue
            break
          case 3:
            currentSymbol.datasheet = fieldValue
            break
          default:
            currentSymbol.properties[`F${fieldNum}`] = fieldValue
        }
      }
      i++
      continue
    }

    // Начало секции рисования
    if (line === 'DRAW') {
      inDraw = true
      i++
      continue
    }

    // Конец секции рисования
    if (line === 'ENDDRAW') {
      inDraw = false
      i++
      continue
    }

    // Конец определения компонента
    if (line === 'ENDDEF') {
      if (currentSymbol) {
        library.symbols.push(currentSymbol)
      }
      currentSymbol = null
      i++
      continue
    }

    // Парсинг элементов рисования
    if (inDraw && currentSymbol) {
      // Прямоугольник: S x1 y1 x2 y2 unit convert thickness fill
      if (line.startsWith('S ')) {
        const parts = line.split(/\s+/)
        currentSymbol.drawings.push({
          type: 'rectangle',
          points: [
            { x: parseInt(parts[1]) / 10, y: -parseInt(parts[2]) / 10 },
            { x: parseInt(parts[3]) / 10, y: -parseInt(parts[4]) / 10 }
          ],
          fill: parts[8] === 'F' || parts[8] === 'f',
          strokeWidth: parseInt(parts[7]) / 10 || 1
        })
      }
      
      // Круг: C x y radius unit convert thickness fill
      if (line.startsWith('C ')) {
        const parts = line.split(/\s+/)
        currentSymbol.drawings.push({
          type: 'circle',
          center: { x: parseInt(parts[1]) / 10, y: -parseInt(parts[2]) / 10 },
          radius: parseInt(parts[3]) / 10,
          fill: parts[7] === 'F' || parts[7] === 'f',
          strokeWidth: parseInt(parts[6]) / 10 || 1
        })
      }
      
      // Полилиния: P count unit convert thickness x1 y1 x2 y2 ... fill
      if (line.startsWith('P ')) {
        const parts = line.split(/\s+/)
        const count = parseInt(parts[1])
        const points: Point[] = []
        for (let j = 0; j < count; j++) {
          points.push({
            x: parseInt(parts[5 + j * 2]) / 10,
            y: -parseInt(parts[6 + j * 2]) / 10
          })
        }
        const fillIndex = 5 + count * 2
        currentSymbol.drawings.push({
          type: 'polyline',
          points,
          fill: parts[fillIndex] === 'F' || parts[fillIndex] === 'f',
          strokeWidth: parseInt(parts[4]) / 10 || 1
        })
      }
      
      // Дуга: A x y radius start_angle end_angle unit convert thickness fill
      if (line.startsWith('A ')) {
        const parts = line.split(/\s+/)
        currentSymbol.drawings.push({
          type: 'arc',
          center: { x: parseInt(parts[1]) / 10, y: -parseInt(parts[2]) / 10 },
          radius: parseInt(parts[3]) / 10,
          startAngle: parseInt(parts[4]) / 10,
          endAngle: parseInt(parts[5]) / 10,
          fill: parts[9] === 'F' || parts[9] === 'f',
          strokeWidth: parseInt(parts[8]) / 10 || 1
        })
      }
      
      // Текст: T orientation x y dimension unit convert Text italic bold justify
      if (line.startsWith('T ')) {
        const textMatch = line.match(/^T\s+(\d+)\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+\d+\s+\d+\s+(\S+)/)
        if (textMatch) {
          currentSymbol.drawings.push({
            type: 'text',
            points: [{ x: parseInt(textMatch[2]) / 10, y: -parseInt(textMatch[3]) / 10 }],
            text: textMatch[5].replace(/~/g, ' '),
            fill: false,
            strokeWidth: 1
          })
        }
      }
      
      // Пин: X name number posx posy length orientation sizenum sizename unit convert electrical_type [shape]
      if (line.startsWith('X ')) {
        const parts = line.split(/\s+/)
        const electricalTypeMap: Record<string, PinElectricalType> = {
          'I': 'input',
          'O': 'output',
          'B': 'bidirectional',
          'T': 'passive',
          'P': 'passive',
          'W': 'power_in',
          'w': 'power_out',
          'C': 'open_collector',
          'E': 'open_emitter',
          'N': 'unconnected',
          'U': 'unspecified'
        }
        
        const pin: KiCadPin = {
          name: parts[1].replace(/~/g, ''),
          number: parts[2],
          position: { x: parseInt(parts[3]) / 10, y: -parseInt(parts[4]) / 10 },
          length: parseInt(parts[5]) / 10,
          orientation: parts[6] as 'U' | 'D' | 'L' | 'R',
          nameVisible: parts[7] !== '0',
          numberVisible: parts[8] !== '0',
          type: electricalTypeMap[parts[11]] || 'unspecified'
        }
        
        currentSymbol.pins.push(pin)
      }
    }

    i++
  }

  return library
}

/**
 * Парсит новый формат .kicad_sym (S-expression, KiCad 6+)
 */
export function parseKicadSym(content: string, fileName: string): KiCadLibrary {
  const library: KiCadLibrary = {
    name: fileName.replace('.kicad_sym', ''),
    version: '6.0',
    symbols: []
  }

  // Простой парсер S-expressions
  const parseSymbolBlock = (symbolContent: string): KiCadSymbol | null => {
    const nameMatch = symbolContent.match(/\(symbol\s+"([^"]+)"/)
    if (!nameMatch) return null

    const symbol: KiCadSymbol = {
      name: nameMatch[1],
      reference: 'U',
      value: nameMatch[1],
      pins: [],
      drawings: [],
      properties: {}
    }

    // Парсинг свойств
    const propertyRegex = /\(property\s+"([^"]+)"\s+"([^"]*)"/g
    let propMatch
    while ((propMatch = propertyRegex.exec(symbolContent)) !== null) {
      const propName = propMatch[1]
      const propValue = propMatch[2]
      
      switch (propName) {
        case 'Reference':
          symbol.reference = propValue
          break
        case 'Value':
          symbol.value = propValue
          break
        case 'Footprint':
          symbol.footprint = propValue
          break
        case 'Datasheet':
          symbol.datasheet = propValue
          break
        case 'Description':
          symbol.description = propValue
          break
        default:
          symbol.properties[propName] = propValue
      }
    }

    // Парсинг пинов
    const pinRegex = /\(pin\s+(\w+)\s+\w+\s+\(at\s+([-\d.]+)\s+([-\d.]+)\s*([-\d.]*)?\)\s*\(length\s+([-\d.]+)\)[^)]*\(name\s+"([^"]*)"\s*[^)]*\)\s*\(number\s+"([^"]*)"/g
    let pinMatch
    while ((pinMatch = pinRegex.exec(symbolContent)) !== null) {
      const electricalTypeMap: Record<string, PinElectricalType> = {
        'input': 'input',
        'output': 'output',
        'bidirectional': 'bidirectional',
        'passive': 'passive',
        'power_in': 'power_in',
        'power_out': 'power_out',
        'open_collector': 'open_collector',
        'open_emitter': 'open_emitter',
        'no_connect': 'unconnected',
        'unspecified': 'unspecified'
      }

      const angle = parseFloat(pinMatch[4] || '0')
      let orientation: 'U' | 'D' | 'L' | 'R' = 'R'
      if (angle === 0) orientation = 'R'
      else if (angle === 90) orientation = 'U'
      else if (angle === 180) orientation = 'L'
      else if (angle === 270) orientation = 'D'

      symbol.pins.push({
        number: pinMatch[7],
        name: pinMatch[6],
        type: electricalTypeMap[pinMatch[1]] || 'unspecified',
        position: { x: parseFloat(pinMatch[2]), y: -parseFloat(pinMatch[3]) },
        length: parseFloat(pinMatch[5]),
        orientation,
        nameVisible: true,
        numberVisible: true
      })
    }

    // Парсинг прямоугольников
    const rectRegex = /\(rectangle\s+\(start\s+([-\d.]+)\s+([-\d.]+)\)\s*\(end\s+([-\d.]+)\s+([-\d.]+)\)/g
    let rectMatch
    while ((rectMatch = rectRegex.exec(symbolContent)) !== null) {
      symbol.drawings.push({
        type: 'rectangle',
        points: [
          { x: parseFloat(rectMatch[1]), y: -parseFloat(rectMatch[2]) },
          { x: parseFloat(rectMatch[3]), y: -parseFloat(rectMatch[4]) }
        ],
        fill: symbolContent.includes('fill (type background)') || symbolContent.includes('fill (type outline)'),
        strokeWidth: 1
      })
    }

    // Парсинг полилиний
    const polylineRegex = /\(polyline\s+\(pts\s+([\s\S]*?)\)\s*\(stroke/g
    let polyMatch
    while ((polyMatch = polylineRegex.exec(symbolContent)) !== null) {
      const ptsContent = polyMatch[1]
      const xyRegex = /\(xy\s+([-\d.]+)\s+([-\d.]+)\)/g
      const points: Point[] = []
      let xyMatch
      while ((xyMatch = xyRegex.exec(ptsContent)) !== null) {
        points.push({ x: parseFloat(xyMatch[1]), y: -parseFloat(xyMatch[2]) })
      }
      if (points.length > 0) {
        symbol.drawings.push({
          type: 'polyline',
          points,
          fill: false,
          strokeWidth: 1
        })
      }
    }

    // Парсинг кругов
    const circleRegex = /\(circle\s+\(center\s+([-\d.]+)\s+([-\d.]+)\)\s*\(radius\s+([-\d.]+)\)/g
    let circleMatch
    while ((circleMatch = circleRegex.exec(symbolContent)) !== null) {
      symbol.drawings.push({
        type: 'circle',
        center: { x: parseFloat(circleMatch[1]), y: -parseFloat(circleMatch[2]) },
        radius: parseFloat(circleMatch[3]),
        fill: false,
        strokeWidth: 1
      })
    }

    // Парсинг дуг
    const arcRegex = /\(arc\s+\(start\s+([-\d.]+)\s+([-\d.]+)\)\s*\(mid\s+([-\d.]+)\s+([-\d.]+)\)\s*\(end\s+([-\d.]+)\s+([-\d.]+)\)/g
    let arcMatch
    while ((arcMatch = arcRegex.exec(symbolContent)) !== null) {
      symbol.drawings.push({
        type: 'arc',
        points: [
          { x: parseFloat(arcMatch[1]), y: -parseFloat(arcMatch[2]) },
          { x: parseFloat(arcMatch[3]), y: -parseFloat(arcMatch[4]) },
          { x: parseFloat(arcMatch[5]), y: -parseFloat(arcMatch[6]) }
        ],
        fill: false,
        strokeWidth: 1
      })
    }

    return symbol
  }

  // Находим все символы верхнего уровня
  const symbolRegex = /\(symbol\s+"([^"]+)"\s+(?!\(symbol)[\s\S]*?(?=\(symbol\s+"[^"]+"\s+(?!\(symbol)|\s*\)\s*$)/g
  let match

  // Упрощённый парсинг: ищем все блоки (symbol "name" ...
  const symbols: string[] = []
  let depth = 0
  let currentSymbol = ''
  let inSymbol = false
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    
    if (char === '(' && content.substring(i, i + 8) === '(symbol ') {
      if (depth === 1) {
        // Это символ верхнего уровня внутри kicad_symbol_lib
        inSymbol = true
        currentSymbol = '('
        depth++
        i += 0 // продолжаем с текущего символа
        continue
      }
    }
    
    if (inSymbol) {
      currentSymbol += char
      if (char === '(') depth++
      if (char === ')') {
        depth--
        if (depth === 1) {
          // Завершение символа
          // Проверяем, что это не вложенный символ юнита
          if (!currentSymbol.match(/\(symbol\s+"[^"]+_\d+_\d+"/)) {
            symbols.push(currentSymbol)
          }
          currentSymbol = ''
          inSymbol = false
        }
      }
    } else {
      if (char === '(') depth++
      if (char === ')') depth--
    }
  }

  // Альтернативный простой подход: ищем по паттерну
  const simpleSymbolRegex = /\(symbol\s+"([^"_]+)"/g
  const symbolNames = new Set<string>()
  while ((match = simpleSymbolRegex.exec(content)) !== null) {
    symbolNames.add(match[1])
  }

  // Для каждого уникального имени символа извлекаем его содержимое
  symbolNames.forEach(name => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const symbolBlockRegex = new RegExp(`\\(symbol\\s+"${escapedName}"\\s+([\\s\\S]*?)(?=\\(symbol\\s+"(?!${escapedName})|\$)`, 'g')
    const blockMatch = symbolBlockRegex.exec(content)
    if (blockMatch) {
      const fullBlock = `(symbol "${name}" ${blockMatch[1]}`
      const parsed = parseSymbolBlock(fullBlock)
      if (parsed && parsed.pins.length > 0) {
        library.symbols.push(parsed)
      }
    }
  })

  return library
}

/**
 * Парсит кастомный формат .emp
 */
export function parseEmpFile(content: string, fileName: string): KiCadSymbol | null {
  try {
    // Предполагаем JSON-подобный формат
    const data = JSON.parse(content)
    
    const symbol: KiCadSymbol = {
      name: data.name || fileName.replace('.emp', ''),
      reference: data.reference || data.prefix || 'U',
      value: data.value || data.name || '',
      footprint: data.footprint,
      datasheet: data.datasheet,
      description: data.description,
      pins: [],
      drawings: [],
      properties: data.properties || {}
    }

    // Парсинг пинов
    if (Array.isArray(data.pins)) {
      symbol.pins = data.pins.map((pin: any, index: number) => ({
        number: String(pin.number || index + 1),
        name: pin.name || `Pin${index + 1}`,
        type: mapPinType(pin.type),
        position: { x: pin.x || 0, y: pin.y || 0 },
        length: pin.length || 10,
        orientation: pin.orientation || 'R',
        nameVisible: pin.nameVisible !== false,
        numberVisible: pin.numberVisible !== false
      }))
    }

    // Парсинг графики
    if (Array.isArray(data.shapes) || Array.isArray(data.drawings)) {
      const shapes = data.shapes || data.drawings
      symbol.drawings = shapes.map((shape: any) => {
        const drawing: KiCadDrawing = {
          type: shape.type || 'rectangle',
          fill: shape.fill || false,
          strokeWidth: shape.strokeWidth || 1
        }

        if (shape.type === 'rectangle' && shape.points) {
          drawing.points = shape.points
        } else if (shape.type === 'circle') {
          drawing.center = shape.center || { x: 0, y: 0 }
          drawing.radius = shape.radius || 10
        } else if (shape.type === 'polyline' && shape.points) {
          drawing.points = shape.points
        } else if (shape.type === 'arc') {
          drawing.center = shape.center
          drawing.radius = shape.radius
          drawing.startAngle = shape.startAngle
          drawing.endAngle = shape.endAngle
        } else if (shape.type === 'text') {
          drawing.text = shape.text
          drawing.points = [shape.position || { x: 0, y: 0 }]
        }

        return drawing
      })
    }

    return symbol
  } catch (e) {
    console.error('Error parsing EMP file:', e)
    return null
  }
}

function mapPinType(type: string): PinElectricalType {
  const typeMap: Record<string, PinElectricalType> = {
    'input': 'input',
    'output': 'output',
    'bidirectional': 'bidirectional',
    'bidi': 'bidirectional',
    'power': 'power_in',
    'power_in': 'power_in',
    'power_out': 'power_out',
    'passive': 'passive',
    'open_collector': 'open_collector',
    'open_emitter': 'open_emitter',
    'unconnected': 'unconnected',
    'nc': 'unconnected'
  }
  return typeMap[type?.toLowerCase()] || 'unspecified'
}

/**
 * Автоопределение формата и парсинг файла
 */
export function parseKiCadFile(content: string, fileName: string): KiCadLibrary | KiCadSymbol | null {
  const ext = fileName.toLowerCase().split('.').pop()

  switch (ext) {
    case 'lib':
      return parseLegacyLib(content, fileName)
    case 'kicad_sym':
      return parseKicadSym(content, fileName)
    case 'emp':
      return parseEmpFile(content, fileName)
    default:
      // Попробуем определить по содержимому
      if (content.startsWith('EESchema-LIBRARY')) {
        return parseLegacyLib(content, fileName)
      }
      if (content.includes('(kicad_symbol_lib')) {
        return parseKicadSym(content, fileName)
      }
      if (content.startsWith('{')) {
        return parseEmpFile(content, fileName)
      }
      return null
  }
}

/**
 * Конвертирует KiCad символ в формат приложения
 */
export function convertToAppComponent(symbol: KiCadSymbol): {
  type: string
  name: string
  prefix: string
  pins: Pin[]
  shapes: any[]
  properties: Record<string, string>
} {
  return {
    type: `kicad-${symbol.name}`,
    name: symbol.name,
    prefix: symbol.reference,
    pins: symbol.pins.map((pin, index) => ({
      id: `pin-${index}`,
      position: calculatePinEndPosition(pin),
      name: pin.name,
      number: pin.number,
      type: mapKiCadPinToAppPin(pin.type)
    })),
    shapes: symbol.drawings.map(drawing => convertDrawingToShape(drawing)),
    properties: {
      value: symbol.value,
      footprint: symbol.footprint || '',
      datasheet: symbol.datasheet || '',
      description: symbol.description || '',
      ...symbol.properties
    }
  }
}

function calculatePinEndPosition(pin: KiCadPin): Point {
  const { position, length, orientation } = pin
  switch (orientation) {
    case 'U':
      return { x: position.x, y: position.y - length }
    case 'D':
      return { x: position.x, y: position.y + length }
    case 'L':
      return { x: position.x - length, y: position.y }
    case 'R':
    default:
      return { x: position.x + length, y: position.y }
  }
}

function mapKiCadPinToAppPin(type: PinElectricalType): 'input' | 'output' | 'bidirectional' | 'power' {
  switch (type) {
    case 'input':
      return 'input'
    case 'output':
    case 'open_collector':
    case 'open_emitter':
      return 'output'
    case 'power_in':
    case 'power_out':
      return 'power'
    case 'bidirectional':
    case 'passive':
    default:
      return 'bidirectional'
  }
}

function convertDrawingToShape(drawing: KiCadDrawing): any {
  switch (drawing.type) {
    case 'rectangle':
      return {
        type: 'rect',
        x: Math.min(drawing.points![0].x, drawing.points![1].x),
        y: Math.min(drawing.points![0].y, drawing.points![1].y),
        width: Math.abs(drawing.points![1].x - drawing.points![0].x),
        height: Math.abs(drawing.points![1].y - drawing.points![0].y),
        fill: drawing.fill,
        strokeWidth: drawing.strokeWidth
      }
    case 'circle':
      return {
        type: 'circle',
        cx: drawing.center!.x,
        cy: drawing.center!.y,
        r: drawing.radius,
        fill: drawing.fill,
        strokeWidth: drawing.strokeWidth
      }
    case 'polyline':
      return {
        type: 'polyline',
        points: drawing.points,
        fill: drawing.fill,
        strokeWidth: drawing.strokeWidth
      }
    case 'arc':
      return {
        type: 'arc',
        cx: drawing.center?.x || 0,
        cy: drawing.center?.y || 0,
        r: drawing.radius,
        startAngle: drawing.startAngle,
        endAngle: drawing.endAngle,
        points: drawing.points, // Для нового формата KiCad 6+
        fill: drawing.fill,
        strokeWidth: drawing.strokeWidth
      }
    case 'text':
      return {
        type: 'text',
        x: drawing.points![0].x,
        y: drawing.points![0].y,
        text: drawing.text,
        strokeWidth: drawing.strokeWidth
      }
    default:
      return drawing
  }
}

