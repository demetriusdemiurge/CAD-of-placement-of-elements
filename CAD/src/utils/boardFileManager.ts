/**
 * Менеджер файлов платы (.sch, .json)
 * Загрузка и сохранение проектов PCB
 */

import { PCBBoard, PlacedComponent, Trace, Via, PCBLayer, Footprint } from '../types/pcb'

// Формат файла .sch для платы
interface SchBoardFile {
  version: string
  name: string
  board: {
    width: number
    height: number
    gridSize: number
    outline?: Array<{ x: number; y: number }>
  }
  components: Array<{
    id: string
    footprintId: string
    footprint: Footprint
    position: { x: number; y: number }
    rotation: number
    reference: string
    value: string
    layer: string
    netConnections: Record<string, string>
  }>
  traces: Array<{
    id: string
    netName: string
    points: Array<{ x: number; y: number }>
    width: number
    layer: string
  }>
  vias: Array<{
    id: string
    position: { x: number; y: number }
    diameter: number
    padDiameter: number
    netName: string
    layers: string[]
  }>
  layers: PCBLayer[]
  createdAt: string
  modifiedAt: string
}

/**
 * Загружает плату из файла
 */
export async function loadBoardFromFile(file: File): Promise<PCBBoard | null> {
  try {
    const content = await file.text()
    const ext = file.name.toLowerCase().split('.').pop()

    if (ext === 'sch' || ext === 'json') {
      return parseBoardFile(content)
    }

    console.error('Неподдерживаемый формат файла:', ext)
    return null
  } catch (error) {
    console.error('Ошибка загрузки файла платы:', error)
    return null
  }
}

/**
 * Парсит содержимое файла платы
 */
function parseBoardFile(content: string): PCBBoard | null {
  try {
    const data: SchBoardFile = JSON.parse(content)

    // Валидация
    if (!data.board || !data.name) {
      console.error('Неверный формат файла платы')
      return null
    }

    // Создаем слои по умолчанию если их нет
    const defaultLayers: PCBLayer[] = [
      { id: 'top-copper', name: 'Top Copper', type: 'top', color: '#ff0000', visible: true, locked: false },
      { id: 'bottom-copper', name: 'Bottom Copper', type: 'bottom', color: '#0000ff', visible: true, locked: false },
      { id: 'top-silk', name: 'Top Silkscreen', type: 'silkscreen_top', color: '#ffffff', visible: true, locked: false },
      { id: 'bottom-silk', name: 'Bottom Silkscreen', type: 'silkscreen_bottom', color: '#ffff00', visible: true, locked: false },
    ]

    const board: PCBBoard = {
      name: data.name,
      width: data.board.width || 100,
      height: data.board.height || 80,
      gridSize: data.board.gridSize || 1.27,
      components: data.components || [],
      traces: data.traces || [],
      vias: data.vias || [],
      layers: data.layers || defaultLayers,
      outline: data.board.outline || [
        { x: 0, y: 0 },
        { x: data.board.width || 100, y: 0 },
        { x: data.board.width || 100, y: data.board.height || 80 },
        { x: 0, y: data.board.height || 80 }
      ]
    }

    return board
  } catch (error) {
    console.error('Ошибка парсинга файла платы:', error)
    return null
  }
}

/**
 * Сохраняет плату в файл .sch (JSON формат)
 */
export function saveBoardToFile(board: PCBBoard, fileName?: string): void {
  const data: SchBoardFile = {
    version: '1.0',
    name: board.name,
    board: {
      width: board.width,
      height: board.height,
      gridSize: board.gridSize,
      outline: board.outline
    },
    components: board.components.map(c => ({
      id: c.id,
      footprintId: c.footprintId,
      footprint: c.footprint,
      position: c.position,
      rotation: c.rotation,
      reference: c.reference,
      value: c.value,
      layer: c.layer,
      netConnections: c.netConnections
    })),
    traces: board.traces.map(t => ({
      id: t.id,
      netName: t.netName,
      points: t.points,
      width: t.width,
      layer: t.layer
    })),
    vias: board.vias.map(v => ({
      id: v.id,
      position: v.position,
      diameter: v.diameter,
      padDiameter: v.padDiameter,
      netName: v.netName,
      layers: v.layers
    })),
    layers: board.layers,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString()
  }

  const content = JSON.stringify(data, null, 2)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || `${board.name.replace(/\s+/g, '_')}.sch`
  a.click()
  
  URL.revokeObjectURL(url)
}

/**
 * Экспортирует плату в .sch формат (то же что и save, но с явным расширением)
 */
export function exportBoardToSch(board: PCBBoard): void {
  saveBoardToFile(board, `${board.name.replace(/\s+/g, '_')}.sch`)
}

/**
 * Загружает плату из URL
 */
export async function loadBoardFromUrl(url: string): Promise<PCBBoard | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error('Не удалось загрузить файл:', url, response.status)
      return null
    }

    const content = await response.text()
    return parseBoardFile(content)
  } catch (error) {
    console.error('Ошибка загрузки файла по URL:', error)
    return null
  }
}

/**
 * Создает пустую плату
 */
export function createEmptyBoard(name: string = 'Новая плата', width: number = 100, height: number = 80): PCBBoard {
  return {
    name,
    width,
    height,
    gridSize: 1.27,
    components: [],
    traces: [],
    vias: [],
    layers: [
      { id: 'top-copper', name: 'Top Copper', type: 'top', color: '#ff0000', visible: true, locked: false },
      { id: 'bottom-copper', name: 'Bottom Copper', type: 'bottom', color: '#0000ff', visible: true, locked: false },
      { id: 'top-silk', name: 'Top Silkscreen', type: 'silkscreen_top', color: '#ffffff', visible: true, locked: false },
      { id: 'bottom-silk', name: 'Bottom Silkscreen', type: 'silkscreen_bottom', color: '#ffff00', visible: true, locked: false },
    ],
    outline: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height }
    ]
  }
}

/**
 * Валидация платы
 */
export function validateBoard(board: PCBBoard): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!board.name || board.name.trim() === '') {
    errors.push('Название платы не может быть пустым')
  }

  if (board.width <= 0 || board.height <= 0) {
    errors.push('Размеры платы должны быть положительными')
  }

  // Проверка на выход компонентов за границы
  for (const comp of board.components) {
    const halfW = comp.footprint.width / 2
    const halfH = comp.footprint.height / 2

    if (comp.position.x - halfW < 0 || comp.position.x + halfW > board.width ||
        comp.position.y - halfH < 0 || comp.position.y + halfH > board.height) {
      errors.push(`Компонент ${comp.reference} выходит за границы платы`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Экспортирует плату в текстовый отчет
 */
export function exportBoardReport(board: PCBBoard): string {
  let report = `# Отчет по плате: ${board.name}\n`
  report += `Дата: ${new Date().toLocaleString()}\n\n`
  
  report += `## Размеры\n`
  report += `- Ширина: ${board.width} мм\n`
  report += `- Высота: ${board.height} мм\n`
  report += `- Площадь: ${(board.width * board.height).toFixed(2)} мм²\n\n`
  
  report += `## Компоненты (${board.components.length})\n`
  for (const comp of board.components) {
    report += `- ${comp.reference}: ${comp.footprint.name}`
    if (comp.value) report += ` (${comp.value})`
    report += ` @ (${comp.position.x.toFixed(2)}, ${comp.position.y.toFixed(2)})\n`
  }
  report += '\n'
  
  report += `## Дорожки (${board.traces.length})\n`
  const tracesByNet: Record<string, number> = {}
  for (const trace of board.traces) {
    tracesByNet[trace.netName || 'Без имени'] = (tracesByNet[trace.netName || 'Без имени'] || 0) + 1
  }
  for (const [net, count] of Object.entries(tracesByNet)) {
    report += `- ${net}: ${count} сегментов\n`
  }
  report += '\n'
  
  report += `## Переходные отверстия (${board.vias.length})\n`

  return report
}
