/**
 * Генератор списка цепей (netlist) из схемы
 * Анализирует компоненты и провода для определения электрических соединений
 */

import { Component, Wire, Point } from '../store/useStore'
import { Net, Netlist } from '../types/pcb'

/**
 * Проверяет, находятся ли две точки достаточно близко друг к другу
 */
function arePointsConnected(p1: Point, p2: Point, threshold: number = 5): boolean {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  return Math.sqrt(dx * dx + dy * dy) <= threshold
}

/**
 * Получает позиции пинов компонента в глобальных координатах
 */
function getComponentPinPositions(component: Component): Array<{
  pinNumber: string
  position: Point
}> {
  const pins: Array<{ pinNumber: string; position: Point }> = []
  const { position, rotation } = component

  // Если у компонента есть пины
  if (component.pins && component.pins.length > 0) {
    for (const pin of component.pins) {
      // Применяем поворот к позиции пина
      const rad = (rotation * Math.PI) / 180
      const rotX = pin.position.x * Math.cos(rad) - pin.position.y * Math.sin(rad)
      const rotY = pin.position.x * Math.sin(rad) + pin.position.y * Math.cos(rad)

      pins.push({
        pinNumber: pin.number,
        position: {
          x: position.x + rotX,
          y: position.y + rotY
        }
      })
    }
  } else {
    // Для базовых компонентов создаем стандартные пины
    const standardPins = getStandardPinPositions(component.type, position, rotation)
    pins.push(...standardPins)
  }

  return pins
}

/**
 * Возвращает стандартные позиции пинов для базовых типов компонентов
 */
function getStandardPinPositions(
  componentType: string,
  position: Point,
  rotation: number
): Array<{ pinNumber: string; position: Point }> {
  const pins: Array<{ pinNumber: string; x: number; y: number }> = []

  switch (componentType) {
    case 'resistor':
    case 'capacitor':
    case 'inductor':
    case 'diode':
      pins.push({ pinNumber: '1', x: -40, y: 0 })
      pins.push({ pinNumber: '2', x: 40, y: 0 })
      break

    case 'transistor-npn':
    case 'transistor-pnp':
      pins.push({ pinNumber: '1', x: -40, y: 0 })   // Base
      pins.push({ pinNumber: '2', x: 15, y: -40 })  // Collector
      pins.push({ pinNumber: '3', x: 15, y: 40 })   // Emitter
      break

    case 'opamp':
      pins.push({ pinNumber: '1', x: -50, y: -15 }) // IN-
      pins.push({ pinNumber: '2', x: -50, y: 15 })  // IN+
      pins.push({ pinNumber: '3', x: 50, y: 0 })    // OUT
      break

    case 'and-gate':
    case 'or-gate':
    case 'not-gate':
      pins.push({ pinNumber: '1', x: -50, y: -10 }) // IN1
      pins.push({ pinNumber: '2', x: -50, y: 10 })  // IN2
      pins.push({ pinNumber: '3', x: 30, y: 0 })    // OUT
      break

    case 'ground':
    case 'vcc':
      pins.push({ pinNumber: '1', x: 0, y: -20 })
      break

    case 'voltage-source':
    case 'current-source':
      pins.push({ pinNumber: '1', x: 0, y: -40 }) // +
      pins.push({ pinNumber: '2', x: 0, y: 40 })  // -
      break

    case 'connector-2':
      pins.push({ pinNumber: '1', x: 0, y: -10 })
      pins.push({ pinNumber: '2', x: 0, y: 10 })
      break

    case 'connector-4':
      for (let i = 0; i < 4; i++) {
        pins.push({ pinNumber: String(i + 1), x: 0, y: (i - 1.5) * 15 })
      }
      break

    case 'connector-8':
      for (let i = 0; i < 8; i++) {
        pins.push({ pinNumber: String(i + 1), x: 0, y: (i - 3.5) * 12 })
      }
      break

    default:
      // Для неизвестных компонентов - два пина по бокам
      pins.push({ pinNumber: '1', x: -20, y: 0 })
      pins.push({ pinNumber: '2', x: 20, y: 0 })
  }

  // Применяем поворот
  const rad = (rotation * Math.PI) / 180
  return pins.map(pin => {
    const rotX = pin.x * Math.cos(rad) - pin.y * Math.sin(rad)
    const rotY = pin.x * Math.sin(rad) + pin.y * Math.cos(rad)
    return {
      pinNumber: pin.pinNumber,
      position: {
        x: position.x + rotX,
        y: position.y + rotY
      }
    }
  })
}

/**
 * Проверяет, подключен ли пин к проводу
 */
function isPinConnectedToWire(pinPosition: Point, wire: Wire, threshold: number = 5): boolean {
  for (const point of wire.points) {
    if (arePointsConnected(pinPosition, point, threshold)) {
      return true
    }
  }
  return false
}

/**
 * Находит все точки соединения проводов
 */
function findWireConnections(wires: Wire[], threshold: number = 5): Map<string, Point[]> {
  const connections = new Map<string, Point[]>()

  for (let i = 0; i < wires.length; i++) {
    for (let j = i + 1; j < wires.length; j++) {
      for (const p1 of wires[i].points) {
        for (const p2 of wires[j].points) {
          if (arePointsConnected(p1, p2, threshold)) {
            // Создаем уникальный ключ для соединения
            const key = `${Math.round(p1.x)},${Math.round(p1.y)}`
            if (!connections.has(key)) {
              connections.set(key, [])
            }
            connections.get(key)!.push(p1, p2)
          }
        }
      }
    }
  }

  return connections
}

/**
 * Группирует провода в единые цепи (Union-Find алгоритм)
 */
class UnionFind {
  parent: Map<string, string>
  
  constructor() {
    this.parent = new Map()
  }

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x)
    }
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!))
    }
    return this.parent.get(x)!
  }

  union(x: string, y: string): void {
    const px = this.find(x)
    const py = this.find(y)
    if (px !== py) {
      this.parent.set(px, py)
    }
  }
}

/**
 * Генерирует netlist из схемы
 */
export function generateNetlist(
  components: Component[],
  wires: Wire[],
  connectionThreshold: number = 5
): Netlist {
  const nets: Net[] = []
  const uf = new UnionFind()
  const pinToNet = new Map<string, string>() // "componentRef:pinNumber" -> netId

  // Получаем все пины компонентов
  const allPins: Array<{
    componentRef: string
    pinNumber: string
    position: Point
  }> = []

  for (const component of components) {
    const ref = component.properties.reference || component.id
    const pins = getComponentPinPositions(component)
    
    for (const pin of pins) {
      allPins.push({
        componentRef: ref,
        pinNumber: pin.pinNumber,
        position: pin.position
      })
    }
  }

  // Присваиваем уникальные ID каждому пину
  let netCounter = 0
  for (const pin of allPins) {
    const pinKey = `${pin.componentRef}:${pin.pinNumber}`
    const netId = `net${netCounter++}`
    pinToNet.set(pinKey, netId)
    uf.find(netId) // Инициализируем в Union-Find
  }

  // Соединяем пины через провода
  for (const wire of wires) {
    const connectedPins: string[] = []

    // Находим все пины, подключенные к этому проводу
    for (const pin of allPins) {
      if (isPinConnectedToWire(pin.position, wire, connectionThreshold)) {
        const pinKey = `${pin.componentRef}:${pin.pinNumber}`
        connectedPins.push(pinKey)
      }
    }

    // Объединяем все подключенные пины в одну цепь
    if (connectedPins.length >= 2) {
      const firstNetId = pinToNet.get(connectedPins[0])!
      for (let i = 1; i < connectedPins.length; i++) {
        const otherNetId = pinToNet.get(connectedPins[i])!
        uf.union(firstNetId, otherNetId)
      }
    }
  }

  // Также соединяем провода между собой
  for (let i = 0; i < wires.length; i++) {
    for (let j = i + 1; j < wires.length; j++) {
      // Проверяем соединение проводов через общие точки
      for (const p1 of wires[i].points) {
        for (const p2 of wires[j].points) {
          if (arePointsConnected(p1, p2, connectionThreshold)) {
            // Находим все пины, подключенные к каждому проводу
            const pinsWire1 = allPins.filter(pin => 
              isPinConnectedToWire(pin.position, wires[i], connectionThreshold)
            )
            const pinsWire2 = allPins.filter(pin => 
              isPinConnectedToWire(pin.position, wires[j], connectionThreshold)
            )

            // Объединяем цепи
            if (pinsWire1.length > 0 && pinsWire2.length > 0) {
              const netId1 = pinToNet.get(`${pinsWire1[0].componentRef}:${pinsWire1[0].pinNumber}`)!
              const netId2 = pinToNet.get(`${pinsWire2[0].componentRef}:${pinsWire2[0].pinNumber}`)!
              uf.union(netId1, netId2)
            }
          }
        }
      }
    }
  }

  // Группируем пины по цепям
  const netGroups = new Map<string, Array<{ componentRef: string; pinNumber: string }>>()

  for (const pin of allPins) {
    const pinKey = `${pin.componentRef}:${pin.pinNumber}`
    const netId = pinToNet.get(pinKey)!
    const rootNetId = uf.find(netId)

    if (!netGroups.has(rootNetId)) {
      netGroups.set(rootNetId, [])
    }
    netGroups.get(rootNetId)!.push({
      componentRef: pin.componentRef,
      pinNumber: pin.pinNumber
    })
  }

  // Создаем цепи (только те, что имеют более одного пина)
  let netNameCounter = 1
  netGroups.forEach((pins, _) => {
    if (pins.length >= 2) {
      nets.push({
        name: `Net${netNameCounter++}`,
        pins
      })
    }
  })

  // Определяем имена цепей для питания и земли
  for (const net of nets) {
    const hasGround = net.pins.some(p => {
      const comp = components.find(c => 
        (c.properties.reference === p.componentRef || c.id === p.componentRef) &&
        c.type === 'ground'
      )
      return comp !== undefined
    })

    const hasVcc = net.pins.some(p => {
      const comp = components.find(c => 
        (c.properties.reference === p.componentRef || c.id === p.componentRef) &&
        c.type === 'vcc'
      )
      return comp !== undefined
    })

    if (hasGround) {
      net.name = 'GND'
    } else if (hasVcc) {
      net.name = 'VCC'
    }
  }

  return { nets }
}

/**
 * Экспортирует netlist в текстовый формат
 */
export function exportNetlistToText(netlist: Netlist): string {
  let output = '# Netlist\n'
  output += `# Generated: ${new Date().toISOString()}\n`
  output += `# Total nets: ${netlist.nets.length}\n\n`

  for (const net of netlist.nets) {
    output += `${net.name}:\n`
    for (const pin of net.pins) {
      output += `  ${pin.componentRef}.${pin.pinNumber}\n`
    }
    output += '\n'
  }

  return output
}

/**
 * Экспортирует netlist в JSON формат
 */
export function exportNetlistToJson(netlist: Netlist): string {
  return JSON.stringify(netlist, null, 2)
}

/**
 * Валидация netlist
 */
export function validateNetlist(netlist: Netlist): {
  valid: boolean
  warnings: string[]
  errors: string[]
} {
  const warnings: string[] = []
  const errors: string[] = []

  // Проверяем на одинаковые имена цепей
  const netNames = new Set<string>()
  for (const net of netlist.nets) {
    if (netNames.has(net.name)) {
      errors.push(`Дублирующееся имя цепи: ${net.name}`)
    }
    netNames.add(net.name)
  }

  // Проверяем на неподключенные пины питания
  const powerNets = netlist.nets.filter(n => n.name === 'VCC' || n.name === 'GND')
  if (powerNets.length === 0) {
    warnings.push('Не найдены цепи питания (VCC/GND)')
  }

  // Проверяем на цепи с только одним пином
  const singlePinNets = netlist.nets.filter(n => n.pins.length === 1)
  if (singlePinNets.length > 0) {
    warnings.push(`Найдены цепи с одним пином: ${singlePinNets.map(n => n.name).join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors
  }
}

/**
 * Получает статистику netlist
 */
export function getNetlistStats(netlist: Netlist): {
  totalNets: number
  totalConnections: number
  maxPinsPerNet: number
  avgPinsPerNet: number
} {
  const totalNets = netlist.nets.length
  const totalConnections = netlist.nets.reduce((sum, net) => sum + net.pins.length, 0)
  const maxPinsPerNet = Math.max(...netlist.nets.map(net => net.pins.length), 0)
  const avgPinsPerNet = totalNets > 0 ? totalConnections / totalNets : 0

  return {
    totalNets,
    totalConnections,
    maxPinsPerNet,
    avgPinsPerNet: Math.round(avgPinsPerNet * 100) / 100
  }
}
