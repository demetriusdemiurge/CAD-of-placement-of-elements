/**
 * Парсер корпусов (.emp файлы)
 * Формат: JSON
 */

import { Footprint, Pad, PadShape, Point } from '../types/pcb'

// Интерфейс для входных данных .emp файла
interface EmpPadInput {
  number: string
  x: number
  y: number
  width: number
  height: number
  shape?: string
  layer?: string
  rotation?: number
}

interface EmpFootprintInput {
  name: string
  description?: string
  pads: EmpPadInput[]
  outline?: Array<{ x: number; y: number }>
  courtyard?: Array<{ x: number; y: number }>
  width?: number
  height?: number
  referencePosition?: { x: number; y: number }
  valuePosition?: { x: number; y: number }
}

/**
 * Парсит содержимое .emp файла и возвращает Footprint
 */
export function parseEmpFile(content: string, fileName?: string): Footprint | null {
  try {
    const data: EmpFootprintInput = JSON.parse(content)
    return convertEmpToFootprint(data, fileName)
  } catch (error) {
    console.error('Error parsing EMP file:', error)
    return null
  }
}

/**
 * Конвертирует входные данные EMP в Footprint
 */
function convertEmpToFootprint(data: EmpFootprintInput, fileName?: string): Footprint {
  const pads: Pad[] = data.pads.map((pad, index) => ({
    id: `pad-${index + 1}`,
    number: pad.number || String(index + 1),
    position: { x: pad.x, y: pad.y },
    width: pad.width || 1,
    height: pad.height || 1,
    shape: mapPadShape(pad.shape),
    layer: (pad.layer as 'top' | 'bottom') || 'top',
    rotation: pad.rotation || 0
  }))

  // Вычисляем размеры если не указаны
  let width = data.width
  let height = data.height

  if (!width || !height) {
    const bounds = calculateBounds(pads, data.outline)
    width = width || bounds.width
    height = height || bounds.height
  }

  // Создаем контур если не указан
  const outline = data.outline?.map(p => ({ x: p.x, y: p.y })) || 
    generateDefaultOutline(width, height)

  // Создаем courtyard если не указан
  const courtyard = data.courtyard?.map(p => ({ x: p.x, y: p.y })) ||
    generateCourtyardFromOutline(outline, 0.5)

  return {
    id: `fp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: data.name || fileName?.replace('.emp', '') || 'Unknown',
    description: data.description,
    pads,
    outline,
    courtyard,
    width,
    height,
    referencePosition: data.referencePosition,
    valuePosition: data.valuePosition
  }
}

/**
 * Маппинг строки формы в PadShape
 */
function mapPadShape(shape?: string): PadShape {
  if (!shape) return 'rect'
  
  const normalized = shape.toLowerCase()
  if (normalized === 'circle' || normalized === 'round') return 'circle'
  if (normalized === 'oval' || normalized === 'oblong') return 'oval'
  return 'rect'
}

/**
 * Вычисляет границы корпуса по площадкам и контуру
 */
function calculateBounds(pads: Pad[], outline?: Array<{ x: number; y: number }>): { width: number; height: number } {
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  pads.forEach(pad => {
    const halfW = pad.width / 2
    const halfH = pad.height / 2
    minX = Math.min(minX, pad.position.x - halfW)
    maxX = Math.max(maxX, pad.position.x + halfW)
    minY = Math.min(minY, pad.position.y - halfH)
    maxY = Math.max(maxY, pad.position.y + halfH)
  })

  if (outline) {
    outline.forEach(p => {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    })
  }

  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1
  }
}

/**
 * Генерирует прямоугольный контур по умолчанию
 */
function generateDefaultOutline(width: number, height: number): Point[] {
  const halfW = width / 2
  const halfH = height / 2
  return [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH }
  ]
}

/**
 * Генерирует courtyard (зону запрета) с отступом от контура
 */
function generateCourtyardFromOutline(outline: Point[], margin: number): Point[] {
  if (outline.length === 0) return []

  // Для простого прямоугольного контура расширяем его
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  outline.forEach(p => {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  })

  return [
    { x: minX - margin, y: minY - margin },
    { x: maxX + margin, y: minY - margin },
    { x: maxX + margin, y: maxY + margin },
    { x: minX - margin, y: maxY + margin }
  ]
}

/**
 * Экспортирует Footprint в формат .emp (JSON)
 */
export function exportToEmp(footprint: Footprint): string {
  const empData: EmpFootprintInput = {
    name: footprint.name,
    description: footprint.description,
    pads: footprint.pads.map(pad => ({
      number: pad.number,
      x: pad.position.x,
      y: pad.position.y,
      width: pad.width,
      height: pad.height,
      shape: pad.shape,
      layer: pad.layer,
      rotation: pad.rotation
    })),
    outline: footprint.outline,
    courtyard: footprint.courtyard,
    width: footprint.width,
    height: footprint.height,
    referencePosition: footprint.referencePosition,
    valuePosition: footprint.valuePosition
  }

  return JSON.stringify(empData, null, 2)
}

/**
 * Создает стандартные корпуса
 */
export function createStandardFootprints(): Footprint[] {
  return [
    createResistorFootprint('0805'),
    createResistorFootprint('0603'),
    createResistorFootprint('1206'),
    createCapacitorFootprint('0805'),
    createSOT23Footprint(),
    createDIP8Footprint(),
    createSOIC8Footprint()
  ]
}

/**
 * Создает корпус резистора SMD
 */
function createResistorFootprint(size: '0603' | '0805' | '1206'): Footprint {
  const sizes: Record<string, { w: number; h: number; padW: number; padH: number; spacing: number }> = {
    '0603': { w: 1.6, h: 0.8, padW: 0.8, padH: 0.8, spacing: 1.6 },
    '0805': { w: 2.0, h: 1.25, padW: 1.0, padH: 1.25, spacing: 2.0 },
    '1206': { w: 3.2, h: 1.6, padW: 1.0, padH: 1.6, spacing: 3.2 }
  }

  const s = sizes[size]
  const halfSpacing = s.spacing / 2

  return {
    id: `fp-R${size}`,
    name: `R_${size}`,
    description: `Резистор SMD ${size}`,
    pads: [
      {
        id: 'pad-1',
        number: '1',
        position: { x: -halfSpacing, y: 0 },
        width: s.padW,
        height: s.padH,
        shape: 'rect',
        layer: 'top'
      },
      {
        id: 'pad-2',
        number: '2',
        position: { x: halfSpacing, y: 0 },
        width: s.padW,
        height: s.padH,
        shape: 'rect',
        layer: 'top'
      }
    ],
    outline: generateDefaultOutline(s.w, s.h),
    courtyard: generateCourtyardFromOutline(generateDefaultOutline(s.w, s.h), 0.25),
    width: s.w,
    height: s.h
  }
}

/**
 * Создает корпус конденсатора SMD
 */
function createCapacitorFootprint(size: '0805'): Footprint {
  const fp = createResistorFootprint(size)
  return {
    ...fp,
    id: `fp-C${size}`,
    name: `C_${size}`,
    description: `Конденсатор SMD ${size}`
  }
}

/**
 * Создает корпус SOT-23 (транзистор)
 */
function createSOT23Footprint(): Footprint {
  return {
    id: 'fp-SOT23',
    name: 'SOT-23',
    description: 'Корпус SOT-23 для транзисторов',
    pads: [
      {
        id: 'pad-1',
        number: '1',
        position: { x: -0.95, y: 1.0 },
        width: 0.6,
        height: 0.7,
        shape: 'rect',
        layer: 'top'
      },
      {
        id: 'pad-2',
        number: '2',
        position: { x: 0.95, y: 1.0 },
        width: 0.6,
        height: 0.7,
        shape: 'rect',
        layer: 'top'
      },
      {
        id: 'pad-3',
        number: '3',
        position: { x: 0, y: -1.0 },
        width: 0.6,
        height: 0.7,
        shape: 'rect',
        layer: 'top'
      }
    ],
    outline: [
      { x: -1.4, y: -0.65 },
      { x: 1.4, y: -0.65 },
      { x: 1.4, y: 0.65 },
      { x: -1.4, y: 0.65 }
    ],
    courtyard: generateCourtyardFromOutline([
      { x: -1.4, y: -1.5 },
      { x: 1.4, y: -1.5 },
      { x: 1.4, y: 1.5 },
      { x: -1.4, y: 1.5 }
    ], 0.25),
    width: 2.8,
    height: 3.0
  }
}

/**
 * Создает корпус DIP-8
 */
function createDIP8Footprint(): Footprint {
  const pads: Pad[] = []
  const pitch = 2.54 // Шаг между выводами
  const rowSpacing = 7.62 // Расстояние между рядами

  for (let i = 0; i < 4; i++) {
    // Левый ряд (1-4)
    pads.push({
      id: `pad-${i + 1}`,
      number: String(i + 1),
      position: { x: -rowSpacing / 2, y: (i - 1.5) * pitch },
      width: 1.6,
      height: 1.6,
      shape: 'circle',
      layer: 'top'
    })
    // Правый ряд (5-8, нумерация снизу вверх)
    pads.push({
      id: `pad-${8 - i}`,
      number: String(8 - i),
      position: { x: rowSpacing / 2, y: (i - 1.5) * pitch },
      width: 1.6,
      height: 1.6,
      shape: 'circle',
      layer: 'top'
    })
  }

  // Сортируем по номеру пина
  pads.sort((a, b) => parseInt(a.number) - parseInt(b.number))

  return {
    id: 'fp-DIP8',
    name: 'DIP-8',
    description: 'Корпус DIP-8',
    pads,
    outline: [
      { x: -5, y: -5 },
      { x: 5, y: -5 },
      { x: 5, y: 5 },
      { x: -5, y: 5 }
    ],
    courtyard: generateCourtyardFromOutline([
      { x: -5, y: -5 },
      { x: 5, y: -5 },
      { x: 5, y: 5 },
      { x: -5, y: 5 }
    ], 0.5),
    width: 10,
    height: 10
  }
}

/**
 * Создает корпус SOIC-8
 */
function createSOIC8Footprint(): Footprint {
  const pads: Pad[] = []
  const pitch = 1.27 // Шаг между выводами
  const rowSpacing = 5.4 // Расстояние между рядами

  for (let i = 0; i < 4; i++) {
    // Левый ряд (1-4)
    pads.push({
      id: `pad-${i + 1}`,
      number: String(i + 1),
      position: { x: -rowSpacing / 2, y: (i - 1.5) * pitch },
      width: 0.6,
      height: 1.5,
      shape: 'rect',
      layer: 'top'
    })
    // Правый ряд (5-8)
    pads.push({
      id: `pad-${8 - i}`,
      number: String(8 - i),
      position: { x: rowSpacing / 2, y: (i - 1.5) * pitch },
      width: 0.6,
      height: 1.5,
      shape: 'rect',
      layer: 'top'
    })
  }

  pads.sort((a, b) => parseInt(a.number) - parseInt(b.number))

  return {
    id: 'fp-SOIC8',
    name: 'SOIC-8',
    description: 'Корпус SOIC-8 SMD',
    pads,
    outline: [
      { x: -2.5, y: -2.5 },
      { x: 2.5, y: -2.5 },
      { x: 2.5, y: 2.5 },
      { x: -2.5, y: 2.5 }
    ],
    courtyard: generateCourtyardFromOutline([
      { x: -3.5, y: -2.5 },
      { x: 3.5, y: -2.5 },
      { x: 3.5, y: 2.5 },
      { x: -3.5, y: 2.5 }
    ], 0.25),
    width: 7,
    height: 5
  }
}

/**
 * Валидация Footprint
 */
export function validateFootprint(footprint: Footprint): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!footprint.name || footprint.name.trim() === '') {
    errors.push('Имя корпуса не может быть пустым')
  }

  if (!footprint.pads || footprint.pads.length === 0) {
    errors.push('Корпус должен иметь хотя бы одну площадку')
  }

  // Проверка уникальности номеров пинов
  const pinNumbers = footprint.pads.map(p => p.number)
  const uniquePins = new Set(pinNumbers)
  if (pinNumbers.length !== uniquePins.size) {
    errors.push('Номера пинов должны быть уникальными')
  }

  // Проверка размеров
  if (footprint.width <= 0 || footprint.height <= 0) {
    errors.push('Размеры корпуса должны быть положительными')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
