/**
 * Парсер файлов схем KiCad (.sch, .kicad_sch)
 */

import { Component, Wire, Point, Pin } from '../store/useStore'

interface SchematicData {
  components: Component[]
  wires: Wire[]
}

/**
 * Парсит .kicad_sch файл (KiCad 6+ формат)
 */
export function parseKicadSch(content: string, fileName: string): SchematicData | null {
  try {
    const components: Component[] = []
    const wires: Wire[] = []

    // Парсим символы
    const symbolRegex = /\(symbol\s+\(lib_id\s+"([^"]+)"\)[\s\S]*?\(at\s+([\d.-]+)\s+([\d.-]+)(?:\s+([\d.-]+))?\)[\s\S]*?(?:\(property\s+"Reference"\s+"([^"]+)")?[\s\S]*?(?:\(property\s+"Value"\s+"([^"]+)")?/g
    
    let match
    let index = 0
    
    while ((match = symbolRegex.exec(content)) !== null) {
      const libId = match[1]
      const x = parseFloat(match[2])
      const y = parseFloat(match[3])
      const rotation = match[4] ? parseFloat(match[4]) : 0
      const reference = match[5] || `U${index + 1}`
      const value = match[6] || libId

      // Определяем тип компонента по lib_id
      let type = 'generic'
      const libIdLower = libId.toLowerCase()
      
      if (libIdLower.includes('resistor') || libIdLower.includes('_r')) {
        type = 'resistor'
      } else if (libIdLower.includes('capacitor') || libIdLower.includes('_c')) {
        type = 'capacitor'
      } else if (libIdLower.includes('inductor') || libIdLower.includes('_l')) {
        type = 'inductor'
      } else if (libIdLower.includes('diode') || libIdLower.includes('_d')) {
        type = 'diode'
      } else if (libIdLower.includes('transistor') || libIdLower.includes('npn') || libIdLower.includes('pnp')) {
        type = libIdLower.includes('pnp') ? 'transistor-pnp' : 'transistor-npn'
      } else if (libIdLower.includes('opamp') || libIdLower.includes('op_amp')) {
        type = 'opamp'
      } else if (libIdLower.includes('gnd') || libIdLower.includes('ground')) {
        type = 'ground'
      } else if (libIdLower.includes('vcc') || libIdLower.includes('vdd') || libIdLower.includes('power')) {
        type = 'vcc'
      }

      components.push({
        id: `comp-${index}`,
        type,
        position: { x, y },
        rotation,
        properties: {
          reference,
          value
        },
        pins: []
      })

      index++
    }

    // Парсим провода
    const wireRegex = /\(wire\s+\(pts\s+\(xy\s+([\d.-]+)\s+([\d.-]+)\)\s*\(xy\s+([\d.-]+)\s+([\d.-]+)\)\)/g
    let wireIndex = 0

    while ((match = wireRegex.exec(content)) !== null) {
      const x1 = parseFloat(match[1])
      const y1 = parseFloat(match[2])
      const x2 = parseFloat(match[3])
      const y2 = parseFloat(match[4])

      wires.push({
        id: `wire-${wireIndex++}`,
        points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
        layer: '1'
      })
    }

    return { components, wires }
  } catch (error) {
    console.error('Error parsing KiCad schematic:', error)
    return null
  }
}

/**
 * Парсит устаревший .sch файл (KiCad 4/5 формат)
 */
export function parseLegacySch(content: string, fileName: string): SchematicData | null {
  try {
    const components: Component[] = []
    const wires: Wire[] = []

    // Парсим компоненты
    // Формат: $Comp ... L <lib> <ref> ... P <x> <y> ... $EndComp
    const compRegex = /\$Comp[\s\S]*?L\s+(\S+)\s+(\S+)[\s\S]*?P\s+([\d.-]+)\s+([\d.-]+)[\s\S]*?(?:F\s+1\s+"([^"]*)")?[\s\S]*?\$EndComp/g
    
    let match
    let index = 0

    while ((match = compRegex.exec(content)) !== null) {
      const libName = match[1]
      const reference = match[2]
      const x = parseFloat(match[3])
      const y = parseFloat(match[4])
      const value = match[5] || libName

      // Определяем тип
      let type = 'generic'
      const libLower = libName.toLowerCase()
      const refLower = reference.toLowerCase()

      if (refLower.startsWith('r') || libLower.includes('res')) {
        type = 'resistor'
      } else if (refLower.startsWith('c') || libLower.includes('cap')) {
        type = 'capacitor'
      } else if (refLower.startsWith('l') || libLower.includes('ind')) {
        type = 'inductor'
      } else if (refLower.startsWith('d') || libLower.includes('diod')) {
        type = 'diode'
      } else if (refLower.startsWith('q') || refLower.startsWith('vt')) {
        type = libLower.includes('pnp') ? 'transistor-pnp' : 'transistor-npn'
      } else if (refLower.startsWith('u') || refLower.startsWith('dd')) {
        type = 'opamp'
      }

      components.push({
        id: `comp-${index}`,
        type,
        position: { x: x / 10, y: y / 10 }, // Конвертируем из mils
        rotation: 0,
        properties: {
          reference,
          value
        },
        pins: []
      })

      index++
    }

    // Парсим провода
    // Формат: Wire Wire Line ... <x1> <y1> <x2> <y2>
    const wireRegex = /Wire\s+Wire\s+Line[\s\S]*?([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)/g
    let wireIndex = 0

    while ((match = wireRegex.exec(content)) !== null) {
      const x1 = parseInt(match[1]) / 10
      const y1 = parseInt(match[2]) / 10
      const x2 = parseInt(match[3]) / 10
      const y2 = parseInt(match[4]) / 10

      wires.push({
        id: `wire-${wireIndex++}`,
        points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
        layer: '1'
      })
    }

    return { components, wires }
  } catch (error) {
    console.error('Error parsing legacy SCH file:', error)
    return null
  }
}

/**
 * Автоопределение формата и парсинг файла схемы
 */
export function parseSchematicFile(content: string, fileName: string): SchematicData | null {
  // Определяем формат
  if (content.includes('(kicad_sch') || content.includes('(symbol (lib_id')) {
    return parseKicadSch(content, fileName)
  } else if (content.includes('EESchema Schematic') || content.includes('$Comp')) {
    return parseLegacySch(content, fileName)
  }
  
  // Пробуем оба парсера
  let result = parseKicadSch(content, fileName)
  if (!result || result.components.length === 0) {
    result = parseLegacySch(content, fileName)
  }
  
  return result
}

/**
 * Экспорт схемы в формат KiCad
 */
export function exportToKicadSch(components: Component[], wires: Wire[]): string {
  let output = `(kicad_sch (version 20211123) (generator "kicad_analog")\n\n`
  
  // Paper
  output += `  (paper "A4")\n\n`
  
  // Lib symbols (placeholder)
  output += `  (lib_symbols)\n\n`
  
  // Symbols (components)
  for (const comp of components) {
    output += `  (symbol (lib_id "${comp.type}")\n`
    output += `    (at ${comp.position.x} ${comp.position.y} ${comp.rotation})\n`
    output += `    (property "Reference" "${comp.properties.reference || ''}" (at 0 -2 0))\n`
    output += `    (property "Value" "${comp.properties.value || ''}" (at 0 2 0))\n`
    output += `  )\n\n`
  }
  
  // Wires
  for (const wire of wires) {
    if (wire.points.length >= 2) {
      for (let i = 0; i < wire.points.length - 1; i++) {
        const p1 = wire.points[i]
        const p2 = wire.points[i + 1]
        output += `  (wire (pts (xy ${p1.x} ${p1.y}) (xy ${p2.x} ${p2.y})))\n`
      }
    }
  }
  
  output += `)\n`
  
  return output
}
