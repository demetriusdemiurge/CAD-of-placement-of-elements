/**
 * Парсер файлов плат KiCad (.brd, .kicad_pcb)
 */

import { PCBBoard, PlacedComponent, Trace, Footprint, Pad, Point, PCBLayer, Netlist, Net } from '../types/pcb'

// Начальные слои платы
const defaultLayers: PCBLayer[] = [
  { id: 'top-copper', name: 'Top Copper', type: 'top', color: '#ff0000', visible: true, locked: false },
  { id: 'bottom-copper', name: 'Bottom Copper', type: 'bottom', color: '#0000ff', visible: true, locked: false },
  { id: 'top-silk', name: 'Top Silkscreen', type: 'silkscreen_top', color: '#ffffff', visible: true, locked: false },
  { id: 'bottom-silk', name: 'Bottom Silkscreen', type: 'silkscreen_bottom', color: '#ffff00', visible: true, locked: false },
]

/**
 * Вычисляет размеры корпуса на основе позиций площадок
 * и центрирует площадки относительно центра корпуса
 * Возвращает также смещение центра для коррекции позиции компонента
 */
function calculateFootprintSizeAndRecenter(pads: Pad[]): { 
  width: number; 
  height: number; 
  outline: Point[];
  recenteredPads: Pad[];
  centerOffset: Point;
} {
  if (pads.length === 0) {
    return {
      width: 4,
      height: 2,
      outline: [{ x: -2, y: -1 }, { x: 2, y: -1 }, { x: 2, y: 1 }, { x: -2, y: 1 }],
      recenteredPads: [
        { id: 'pad-1', number: '1', position: { x: -1, y: 0 }, width: 1, height: 1, shape: 'rect', layer: 'top' },
        { id: 'pad-2', number: '2', position: { x: 1, y: 0 }, width: 1, height: 1, shape: 'rect', layer: 'top' }
      ],
      centerOffset: { x: 0, y: 0 }
    }
  }

  // Находим границы всех площадок
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  for (const pad of pads) {
    const halfW = pad.width / 2
    const halfH = pad.height / 2
    
    minX = Math.min(minX, pad.position.x - halfW)
    maxX = Math.max(maxX, pad.position.x + halfW)
    minY = Math.min(minY, pad.position.y - halfH)
    maxY = Math.max(maxY, pad.position.y + halfH)
  }

  // Центр площадок (геометрический центр bounding box)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  // Добавляем отступ вокруг площадок для корпуса
  const padding = 0.5 // мм

  const width = (maxX - minX) + padding * 2
  const height = (maxY - minY) + padding * 2
  
  const halfW = width / 2
  const halfH = height / 2

  // Контур корпуса (центрирован относительно 0,0)
  const outline: Point[] = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH }
  ]

  // Пересчитываем позиции площадок относительно центра корпуса
  const recenteredPads: Pad[] = pads.map(pad => ({
    ...pad,
    position: {
      x: pad.position.x - centerX,
      y: pad.position.y - centerY
    }
  }))

  return { 
    width, 
    height, 
    outline, 
    recenteredPads,
    centerOffset: { x: centerX, y: centerY }
  }
}

/**
 * Автоматически подстраивает размер платы под содержимое
 * Учитывает все компоненты и дорожки
 */
function adjustBoardSizeToContent(board: PCBBoard): void {
  if (board.components.length === 0 && board.traces.length === 0) {
    return
  }

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  // Учитываем все компоненты с их размерами
  for (const comp of board.components) {
    const halfW = comp.footprint.width / 2
    const halfH = comp.footprint.height / 2
    
    // Учитываем поворот для bounding box
    const rad = (comp.rotation * Math.PI) / 180
    const cos = Math.abs(Math.cos(rad))
    const sin = Math.abs(Math.sin(rad))
    const rotatedHalfW = halfW * cos + halfH * sin
    const rotatedHalfH = halfW * sin + halfH * cos
    
    minX = Math.min(minX, comp.position.x - rotatedHalfW)
    maxX = Math.max(maxX, comp.position.x + rotatedHalfW)
    minY = Math.min(minY, comp.position.y - rotatedHalfH)
    maxY = Math.max(maxY, comp.position.y + rotatedHalfH)
  }

  // Учитываем все дорожки
  for (const trace of board.traces) {
    for (const point of trace.points) {
      minX = Math.min(minX, point.x - trace.width / 2)
      maxX = Math.max(maxX, point.x + trace.width / 2)
      minY = Math.min(minY, point.y - trace.width / 2)
      maxY = Math.max(maxY, point.y + trace.width / 2)
    }
  }

  // Если нашли контент
  if (minX !== Infinity) {
    // Добавляем отступы от края
    const margin = 5 // мм

    // Вычисляем смещение для нормализации к началу координат
    const offsetX = minX - margin
    const offsetY = minY - margin

    // Сдвигаем все компоненты
    for (const comp of board.components) {
      comp.position.x -= offsetX
      comp.position.y -= offsetY
    }

    // Сдвигаем все дорожки
    for (const trace of board.traces) {
      for (const point of trace.points) {
        point.x -= offsetX
        point.y -= offsetY
      }
    }

    // Устанавливаем новые размеры платы
    board.width = (maxX - minX) + margin * 2
    board.height = (maxY - minY) + margin * 2

    // Обновляем контур
    board.outline = [
      { x: 0, y: 0 },
      { x: board.width, y: 0 },
      { x: board.width, y: board.height },
      { x: 0, y: board.height }
    ]
  }
}

/**
 * Парсит .kicad_pcb файл (KiCad 5/6/7 формат)
 */
export function parseKicadPcb(content: string, fileName: string): PCBBoard | null {
  try {
    const board: PCBBoard = {
      name: fileName.replace(/\.(kicad_pcb|brd)$/i, ''),
      width: 100,
      height: 80,
      gridSize: 1.27,
      components: [],
      traces: [],
      vias: [],
      layers: defaultLayers,
      outline: []
    }

    // Парсим размеры платы из general секции
    const generalMatch = content.match(/\(general[\s\S]*?\(thickness\s+([\d.]+)\)/)
    
    // Парсим gr_rect или edge cuts для размеров
    let minX = 0, minY = 0, maxX = 100, maxY = 80
    const edgeCutsMatch = content.match(/\(gr_rect\s+\(start\s+([\d.-]+)\s+([\d.-]+)\)\s*\(end\s+([\d.-]+)\s+([\d.-]+)\)/)
    if (edgeCutsMatch) {
      const x1 = parseFloat(edgeCutsMatch[1])
      const y1 = parseFloat(edgeCutsMatch[2])
      const x2 = parseFloat(edgeCutsMatch[3])
      const y2 = parseFloat(edgeCutsMatch[4])
      
      minX = Math.min(x1, x2)
      minY = Math.min(y1, y2)
      maxX = Math.max(x1, x2)
      maxY = Math.max(y1, y2)
      
      board.width = maxX - minX
      board.height = maxY - minY
      board.outline = [
        { x: 0, y: 0 },
        { x: board.width, y: 0 },
        { x: board.width, y: board.height },
        { x: 0, y: board.height }
      ]
    }

    // Парсим footprints
    const footprintRegex = /\(footprint\s+"([^"]+)"[\s\S]*?\(at\s+([\d.-]+)\s+([\d.-]+)(?:\s+([\d.-]+))?\)([\s\S]*?)(?=\n\s*\(footprint|\n\s*\(segment|\n\s*\)$)/g
    
    let compIndex = 0
    let match
    while ((match = footprintRegex.exec(content)) !== null) {
      const fpName = match[1]
      const x = parseFloat(match[2]) - minX
      const y = parseFloat(match[3]) - minY
      const rotation = match[4] ? parseFloat(match[4]) : 0
      const fpContent = match[5]
      
      // Извлекаем reference и value
      const refMatch = fpContent.match(/\(fp_text\s+reference\s+"([^"]+)"/)
      const valMatch = fpContent.match(/\(fp_text\s+value\s+"([^"]+)"/)
      const reference = refMatch ? refMatch[1] : `U${compIndex + 1}`
      const value = valMatch ? valMatch[1] : fpName

      // Парсим площадки
      const pads: Pad[] = []
      const padRegex = /\(pad\s+"([^"]+)"\s+(\w+)\s+(\w+)\s+\(at\s+([\d.-]+)\s+([\d.-]+)(?:\s+([\d.-]+))?\)\s*\(size\s+([\d.-]+)\s+([\d.-]+)\)/g
      let padMatch
      
      while ((padMatch = padRegex.exec(fpContent)) !== null) {
        const padNumber = padMatch[1]
        const padType = padMatch[2] // smd, thru_hole
        const padShape = padMatch[3] // rect, circle, oval
        const padX = parseFloat(padMatch[4])
        const padY = parseFloat(padMatch[5])
        const padWidth = parseFloat(padMatch[7])
        const padHeight = parseFloat(padMatch[8])
        
        pads.push({
          id: `pad-${pads.length}`,
          number: padNumber,
          position: { x: padX, y: padY },
          width: padWidth,
          height: padHeight,
          shape: padShape === 'circle' ? 'circle' : padShape === 'oval' ? 'oval' : 'rect',
          layer: 'top'
        })
      }

      // Вычисляем реальные размеры корпуса и центрируем площадки
      const { width: fpWidth, height: fpHeight, outline: fpOutline, recenteredPads, centerOffset } = 
        calculateFootprintSizeAndRecenter(pads)

      const footprint: Footprint = {
        id: `fp-${compIndex}`,
        name: fpName,
        pads: recenteredPads,
        outline: fpOutline,
        courtyard: [],
        width: fpWidth,
        height: fpHeight
      }

      // Корректируем позицию компонента с учетом смещения центра площадок
      board.components.push({
        id: `comp-${compIndex}`,
        footprintId: footprint.id,
        footprint,
        position: { 
          x: x + centerOffset.x, 
          y: y + centerOffset.y 
        },
        rotation,
        reference,
        value,
        layer: 'top',
        netConnections: {}
      })

      compIndex++
    }

    // Парсим сегменты дорожек
    const segmentRegex = /\(segment\s+\(start\s+([\d.-]+)\s+([\d.-]+)\)\s*\(end\s+([\d.-]+)\s+([\d.-]+)\)\s*\(width\s+([\d.-]+)\)/g
    let segmentMatch
    let traceIndex = 0

    while ((segmentMatch = segmentRegex.exec(content)) !== null) {
      const x1 = parseFloat(segmentMatch[1]) - minX  // Нормализуем
      const y1 = parseFloat(segmentMatch[2]) - minY
      const x2 = parseFloat(segmentMatch[3]) - minX
      const y2 = parseFloat(segmentMatch[4]) - minY
      const width = parseFloat(segmentMatch[5])

      board.traces.push({
        id: `trace-${traceIndex++}`,
        netName: `Net${traceIndex}`,
        points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
        width,
        layer: 'top-copper'
      })
    }

    // Автоматически подстраиваем размер платы под содержимое
    adjustBoardSizeToContent(board)

    return board
  } catch (error) {
    console.error('Error parsing KiCad PCB file:', error)
    return null
  }
}

/**
 * Парсит устаревший .brd файл (KiCad 4 и ранее)
 */
export function parseLegacyBrd(content: string, fileName: string): PCBBoard | null {
  try {
    const board: PCBBoard = {
      name: fileName.replace(/\.(brd|kicad_pcb)$/i, ''),
      width: 100,
      height: 80,
      gridSize: 1.27,
      components: [],
      traces: [],
      vias: [],
      layers: defaultLayers,
      outline: []
    }

    // Определяем версию и единицы измерения
    let isVersion2 = content.includes('Version 2')
    let unitMultiplier = 1 // для Version 2 (mm)
    
    if (!isVersion2) {
      // Version 1 использует 1/10000 дюйма
      unitMultiplier = 0.00254 // конвертируем в мм
    }

    // Парсим $EQUIPOT секции для получения имен цепей
    // Формат: $EQUIPOT Na <number> "<name>" ... $EndEQUIPOT
    const netMap = new Map<number, string>()
    const equipotRegex = /\$EQUIPOT[\s\S]*?Na\s+(\d+)\s+"([^"]*)"[\s\S]*?\$EndEQUIPOT/gi
    let equipotMatch
    while ((equipotMatch = equipotRegex.exec(content)) !== null) {
      const netNumber = parseInt(equipotMatch[1])
      const netName = equipotMatch[2]
      if (netNumber > 0 && netName) { // 0 = no net
        netMap.set(netNumber, netName)
      }
    }
    console.log(`Parsed ${netMap.size} nets from EQUIPOT sections`)

    // Парсим $GENERAL для размеров платы
    const generalMatch = content.match(/\$GENERAL[\s\S]*?\$EndGENERAL/i)
    if (generalMatch) {
      const generalSection = generalMatch[0]
      
      // Di (Drawing area) содержит границы: Di x1 y1 x2 y2
      const diMatch = generalSection.match(/Di\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/)
      if (diMatch) {
        const x1 = parseFloat(diMatch[1]) * unitMultiplier
        const y1 = parseFloat(diMatch[2]) * unitMultiplier
        const x2 = parseFloat(diMatch[3]) * unitMultiplier
        const y2 = parseFloat(diMatch[4]) * unitMultiplier
        
        board.width = Math.abs(x2 - x1)
        board.height = Math.abs(y2 - y1)
      }
    }

    // Парсим $SHEETDESCR для размеров листа
    const sheetMatch = content.match(/\$SHEETDESCR[\s\S]*?Sheet\s+\S+\s+([\d]+)\s+([\d]+)/)
    if (sheetMatch && board.width === 100) {
      // Используем размеры листа если не нашли Di
      board.width = parseInt(sheetMatch[1]) * 0.0254 // из mils в мм
      board.height = parseInt(sheetMatch[2]) * 0.0254
    }

    // Парсим модули ($MODULE секции)
    const moduleRegex = /\$MODULE\s+([^\r\n]+)[\s\S]*?Po\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)[\s\S]*?(?=\$EndMODULE)/gi
    let moduleMatch
    let compIndex = 0

    while ((moduleMatch = moduleRegex.exec(content)) !== null) {
      const name = moduleMatch[1].trim()
      const x = parseFloat(moduleMatch[2]) * unitMultiplier
      const y = parseFloat(moduleMatch[3]) * unitMultiplier
      const rotation = parseFloat(moduleMatch[4]) / 10 // углы всегда в десятых градуса

      // Извлекаем reference из секции модуля
      const moduleContent = content.substring(moduleMatch.index, content.indexOf('$EndMODULE', moduleMatch.index))
      const refMatch = moduleContent.match(/T0[^"]*"([^"]+)"/)
      const valueMatch = moduleContent.match(/T1[^"]*"([^"]+)"/)
      
      const reference = refMatch ? refMatch[1] : `U${compIndex + 1}`
      const value = valueMatch ? valueMatch[1] : name

      // Парсим площадки в модуле
      const pads: Pad[] = []
      const netConnections: Record<string, string> = {}
      
      // Ищем все $PAD...$EndPAD блоки
      const padBlocks = moduleContent.matchAll(/\$PAD([\s\S]*?)\$EndPAD/gi)
      
      for (const padBlock of padBlocks) {
        const padContent = padBlock[1]
        
        // Парсим Sh (shape): Sh "номер" форма ширина высота ...
        const shMatch = padContent.match(/Sh\s+"([^"]+)"\s+(\w+)\s+([\d.-]+)\s+([\d.-]+)/)
        // Парсим Po (position): Po x y
        const poMatch = padContent.match(/Po\s+([\d.-]+)\s+([\d.-]+)/)
        // Парсим Ne (net): Ne номер_цепи "имя_цепи"
        const neMatch = padContent.match(/Ne\s+(\d+)\s+"([^"]*)"/)
        
        if (shMatch && poMatch) {
          const padNumber = shMatch[1]
          const padShape = shMatch[2].toLowerCase()
          const padWidth = parseFloat(shMatch[3]) * unitMultiplier
          const padHeight = parseFloat(shMatch[4]) * unitMultiplier
          const padX = parseFloat(poMatch[1]) * unitMultiplier
          const padY = parseFloat(poMatch[2]) * unitMultiplier
          
          // Получаем имя цепи
          let netName: string | undefined
          if (neMatch) {
            const netNum = parseInt(neMatch[1])
            netName = neMatch[2] || netMap.get(netNum)
            if (netName && netNum > 0) {
              netConnections[padNumber] = netName
            }
          }
          
          pads.push({
            id: `pad-${pads.length}`,
            number: padNumber,
            position: { x: padX, y: padY },
            width: padWidth,
            height: padHeight,
            shape: padShape === 'c' ? 'circle' : padShape === 'r' ? 'rect' : 'oval',
            layer: 'top',
            netName
          })
        }
      }

      // Вычисляем реальные размеры корпуса и центрируем площадки
      const { width: fpWidth, height: fpHeight, outline: fpOutline, recenteredPads, centerOffset } = 
        calculateFootprintSizeAndRecenter(pads)

      const footprint: Footprint = {
        id: `fp-${compIndex}`,
        name,
        pads: recenteredPads,
        outline: fpOutline,
        courtyard: [],
        width: fpWidth,
        height: fpHeight
      }

      // Корректируем позицию компонента с учетом смещения центра площадок
      board.components.push({
        id: `comp-${compIndex}`,
        footprintId: footprint.id,
        footprint,
        position: { 
          x: x + centerOffset.x, 
          y: y + centerOffset.y 
        },
        rotation,
        reference,
        value,
        layer: 'top',
        netConnections
      })

      compIndex++
    }

    // Строим netlist из собранных данных
    const netlistMap = new Map<string, Array<{ componentRef: string; pinNumber: string }>>()
    for (const comp of board.components) {
      for (const [pinNumber, netName] of Object.entries(comp.netConnections)) {
        if (!netlistMap.has(netName)) {
          netlistMap.set(netName, [])
        }
        netlistMap.get(netName)!.push({
          componentRef: comp.reference,
          pinNumber
        })
      }
    }

    // Создаем Netlist
    const nets: Net[] = []
    for (const [name, pins] of netlistMap) {
      if (pins.length >= 2) { // Только цепи с 2+ пинами
        nets.push({ name, pins })
      }
    }
    board.netlist = { nets }
    console.log(`Built netlist with ${nets.length} nets`)

    // Находим минимальные координаты для нормализации
    let minX = 0, minY = 0
    if (generalMatch) {
      const generalSection = generalMatch[0]
      const diMatch = generalSection.match(/Di\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/)
      if (diMatch) {
        minX = parseFloat(diMatch[1]) * unitMultiplier
        minY = parseFloat(diMatch[2]) * unitMultiplier
      }
    }

    // Нормализуем координаты компонентов
    for (const comp of board.components) {
      comp.position.x -= minX
      comp.position.y -= minY
    }

    // Парсим дорожки - ищем все секции $TRACK
    const trackSections = content.matchAll(/\$TRACK[\s\S]*?\$EndTRACK/gi)
    let traceIndex = 0

    for (const trackSection of trackSections) {
      const trackContent = trackSection[0]
      
      // Формат: Po тип x1 y1 x2 y2 ширина
      // Разбиваем на строки и парсим каждую Po строку
      const lines = trackContent.split('\n')
      
      for (const line of lines) {
        const trimmedLine = line.trim()
        
        // Парсим строки Po (дорожки)
        const poMatch = trimmedLine.match(/^Po\s+(\d+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/)
        if (poMatch) {
          const x1 = parseFloat(poMatch[2]) * unitMultiplier - minX
          const y1 = parseFloat(poMatch[3]) * unitMultiplier - minY
          const x2 = parseFloat(poMatch[4]) * unitMultiplier - minX
          const y2 = parseFloat(poMatch[5]) * unitMultiplier - minY
          const width = parseFloat(poMatch[6]) * unitMultiplier

          board.traces.push({
            id: `trace-${traceIndex++}`,
            netName: `Net${traceIndex}`,
            points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
            width: width > 0 ? width : 0.5,
            layer: 'top-copper'
          })
        }
      }
    }

    // Также парсим отдельные сегменты вне секции $TRACK (для совместимости)
    const segmentRegex = /^Po\s+0\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/gm
    let segMatch
    while ((segMatch = segmentRegex.exec(content)) !== null) {
      // Проверяем, что это не внутри $TRACK секции (уже обработано)
      const beforeMatch = content.substring(0, segMatch.index)
      const lastTrackStart = beforeMatch.lastIndexOf('$TRACK')
      const lastTrackEnd = beforeMatch.lastIndexOf('$EndTRACK')
      
      // Если мы внутри TRACK секции, пропускаем (уже обработано)
      if (lastTrackStart > lastTrackEnd) {
        continue
      }

      const x1 = parseFloat(segMatch[1]) * unitMultiplier - minX
      const y1 = parseFloat(segMatch[2]) * unitMultiplier - minY
      const x2 = parseFloat(segMatch[3]) * unitMultiplier - minX
      const y2 = parseFloat(segMatch[4]) * unitMultiplier - minY
      const width = parseFloat(segMatch[5]) * unitMultiplier

      board.traces.push({
        id: `trace-${traceIndex++}`,
        netName: `Net${traceIndex}`,
        points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
        width: width > 0 ? width : 0.5,
        layer: 'top-copper'
      })
    }

    console.log(`Parsed ${board.components.length} components and ${board.traces.length} traces`)

    // Автоматически подстраиваем размер платы под содержимое
    adjustBoardSizeToContent(board)

    // Создаем контур платы
    if (board.width > 0 && board.height > 0) {
      board.outline = [
        { x: 0, y: 0 },
        { x: board.width, y: 0 },
        { x: board.width, y: board.height },
        { x: 0, y: board.height }
      ]
    }

    return board
  } catch (error) {
    console.error('Error parsing legacy BRD file:', error)
    return null
  }
}

/**
 * Автоопределение формата и парсинг файла платы
 */
export function parseBoardFile(content: string, fileName: string): PCBBoard | null {
  // Определяем формат по содержимому
  if (content.includes('(kicad_pcb') || content.includes('(footprint')) {
    return parseKicadPcb(content, fileName)
  } else if (content.includes('PCBNEW-BOARD') || content.includes('$MODULE')) {
    return parseLegacyBrd(content, fileName)
  }
  
  // Пробуем оба парсера
  let result = parseKicadPcb(content, fileName)
  if (!result || (result.components.length === 0 && result.traces.length === 0)) {
    result = parseLegacyBrd(content, fileName)
  }
  
  return result
}

/**
 * Экспорт платы в формат KiCad
 */
export function exportToKicadPcb(board: PCBBoard): string {
  let output = `(kicad_pcb (version 20211014) (generator "kicad_analog")\n\n`
  
  // General section
  output += `  (general\n`
  output += `    (thickness 1.6)\n`
  output += `  )\n\n`
  
  // Page settings
  output += `  (paper "A4")\n\n`
  
  // Layers
  output += `  (layers\n`
  output += `    (0 "F.Cu" signal)\n`
  output += `    (31 "B.Cu" signal)\n`
  output += `    (32 "B.Adhes" user "B.Adhesive")\n`
  output += `    (33 "F.Adhes" user "F.Adhesive")\n`
  output += `    (36 "B.SilkS" user "B.Silkscreen")\n`
  output += `    (37 "F.SilkS" user "F.Silkscreen")\n`
  output += `  )\n\n`
  
  // Board outline
  output += `  (gr_rect (start 0 0) (end ${board.width} ${board.height}) (layer "Edge.Cuts") (width 0.1))\n\n`
  
  // Footprints
  for (const comp of board.components) {
    output += `  (footprint "${comp.footprint.name}"\n`
    output += `    (at ${comp.position.x} ${comp.position.y} ${comp.rotation})\n`
    output += `    (fp_text reference "${comp.reference}" (at 0 -2) (layer "F.SilkS"))\n`
    output += `    (fp_text value "${comp.value}" (at 0 2) (layer "F.Fab"))\n`
    
    for (const pad of comp.footprint.pads) {
      output += `    (pad "${pad.number}" smd rect (at ${pad.position.x} ${pad.position.y}) (size ${pad.width} ${pad.height}) (layers "F.Cu" "F.Paste" "F.Mask"))\n`
    }
    
    output += `  )\n\n`
  }
  
  // Traces
  for (const trace of board.traces) {
    for (let i = 0; i < trace.points.length - 1; i++) {
      const p1 = trace.points[i]
      const p2 = trace.points[i + 1]
      output += `  (segment (start ${p1.x} ${p1.y}) (end ${p2.x} ${p2.y}) (width ${trace.width}) (layer "F.Cu") (net 0))\n`
    }
  }
  
  output += `)\n`
  
  return output
}
