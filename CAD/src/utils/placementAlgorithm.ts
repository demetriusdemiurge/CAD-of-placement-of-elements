/**
 * Последовательный алгоритм размещения компонентов с минимизацией длины связей
 */

import {
  PCBBoard,
  PlacedComponent,
  Footprint,
  Netlist,
  Net,
  PlacementOptions,
  PlacementResult,
  Point
} from '../types/pcb'

/**
 * Вычисляет расстояние между двумя точками
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Вычисляет позицию пина компонента в глобальных координатах
 */
function getPinGlobalPosition(
  component: PlacedComponent,
  pinNumber: string
): Point | null {
  const pad = component.footprint.pads.find(p => p.number === pinNumber)
  if (!pad) return null

  // Учитываем поворот компонента
  const rad = (component.rotation * Math.PI) / 180
  const rotX = pad.position.x * Math.cos(rad) - pad.position.y * Math.sin(rad)
  const rotY = pad.position.x * Math.sin(rad) + pad.position.y * Math.cos(rad)

  return {
    x: component.position.x + rotX,
    y: component.position.y + rotY
  }
}

/**
 * Вычисляет общую длину связей (wirelength) для текущего размещения
 */
export function calculateWirelength(
  components: PlacedComponent[],
  netlist: Netlist
): number {
  let totalLength = 0

  for (const net of netlist.nets) {
    if (net.pins.length < 2) continue

    // Half-perimeter bounding box (HPWL) метрика
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (const pin of net.pins) {
      const component = components.find(c => c.reference === pin.componentRef)
      if (!component) continue

      const pos = getPinGlobalPosition(component, pin.pinNumber)
      if (!pos) continue

      minX = Math.min(minX, pos.x)
      maxX = Math.max(maxX, pos.x)
      minY = Math.min(minY, pos.y)
      maxY = Math.max(maxY, pos.y)
    }

    if (minX !== Infinity) {
      // HPWL = (maxX - minX) + (maxY - minY)
      totalLength += (maxX - minX) + (maxY - minY)
    }
  }

  return totalLength
}

/**
 * Вычисляет связность компонента (количество цепей, к которым он подключен)
 */
function calculateConnectivity(
  reference: string,
  netlist: Netlist
): number {
  let connectivity = 0
  for (const net of netlist.nets) {
    if (net.pins.some(p => p.componentRef === reference)) {
      connectivity++
    }
  }
  return connectivity
}

/**
 * Вычисляет AABB (Axis-Aligned Bounding Box) для компонента с учетом поворота
 */
function getComponentAABB(comp: PlacedComponent, spacing: number = 0): {
  minX: number; maxX: number; minY: number; maxY: number
} {
  const halfW = comp.footprint.width / 2
  const halfH = comp.footprint.height / 2
  
  // Учитываем поворот
  const rad = (comp.rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  
  // Вычисляем размеры повернутого bounding box
  const rotatedHalfW = halfW * cos + halfH * sin + spacing / 2
  const rotatedHalfH = halfW * sin + halfH * cos + spacing / 2
  
  return {
    minX: comp.position.x - rotatedHalfW,
    maxX: comp.position.x + rotatedHalfW,
    minY: comp.position.y - rotatedHalfH,
    maxY: comp.position.y + rotatedHalfH
  }
}

/**
 * Проверяет столкновение двух компонентов с использованием AABB
 */
export function checkCollision(
  comp1: PlacedComponent,
  comp2: PlacedComponent,
  spacing: number = 1
): boolean {
  const aabb1 = getComponentAABB(comp1, spacing)
  const aabb2 = getComponentAABB(comp2, spacing)
  
  // Проверка пересечения AABB
  return !(
    aabb1.maxX < aabb2.minX ||
    aabb1.minX > aabb2.maxX ||
    aabb1.maxY < aabb2.minY ||
    aabb1.minY > aabb2.maxY
  )
}

/**
 * Проверяет, находится ли компонент в пределах платы
 */
function isWithinBoard(
  position: Point,
  footprint: Footprint,
  boardWidth: number,
  boardHeight: number,
  margin: number
): boolean {
  const halfW = footprint.width / 2
  const halfH = footprint.height / 2

  return (
    position.x - halfW >= margin &&
    position.x + halfW <= boardWidth - margin &&
    position.y - halfH >= margin &&
    position.y + halfH <= boardHeight - margin
  )
}

/**
 * Проверяет коллизию с уже размещенными компонентами
 */
function hasCollisionWithPlaced(
  position: Point,
  footprint: Footprint,
  rotation: number,
  placedComponents: PlacedComponent[],
  spacing: number
): boolean {
  const tempComponent: PlacedComponent = {
    id: 'temp',
    footprintId: footprint.id,
    footprint,
    position,
    rotation,
    reference: '',
    value: '',
    layer: 'top',
    netConnections: {}
  }

  for (const placed of placedComponents) {
    if (checkCollision(tempComponent, placed, spacing)) {
      return true
    }
  }

  return false
}

/**
 * Вычисляет стоимость размещения компонента в данной позиции
 * Стоимость = сумма длин связей с уже размещенными компонентами
 */
function calculatePlacementCost(
  reference: string,
  footprint: Footprint,
  position: Point,
  rotation: number,
  placedComponents: PlacedComponent[],
  netlist: Netlist
): number {
  let cost = 0

  // Создаем временный компонент для расчета
  const tempComponent: PlacedComponent = {
    id: 'temp',
    footprintId: footprint.id,
    footprint,
    position,
    rotation,
    reference,
    value: '',
    layer: 'top',
    netConnections: {}
  }

  // Для каждой цепи, связанной с этим компонентом
  for (const net of netlist.nets) {
    const myPins = net.pins.filter(p => p.componentRef === reference)
    if (myPins.length === 0) continue

    const otherPins = net.pins.filter(p => p.componentRef !== reference)
    if (otherPins.length === 0) continue

    // Находим позиции моих пинов
    for (const myPin of myPins) {
      const myPos = getPinGlobalPosition(tempComponent, myPin.pinNumber)
      if (!myPos) continue

      // Находим позиции пинов других компонентов
      for (const otherPin of otherPins) {
        const otherComponent = placedComponents.find(c => c.reference === otherPin.componentRef)
        if (!otherComponent) continue

        const otherPos = getPinGlobalPosition(otherComponent, otherPin.pinNumber)
        if (!otherPos) continue

        // Добавляем Манхэттенское расстояние
        cost += Math.abs(myPos.x - otherPos.x) + Math.abs(myPos.y - otherPos.y)
      }
    }
  }

  return cost
}

/**
 * Находит оптимальную позицию для компонента
 */
export function findOptimalPosition(
  reference: string,
  footprint: Footprint,
  placedComponents: PlacedComponent[],
  netlist: Netlist,
  boardWidth: number,
  boardHeight: number,
  options: PlacementOptions
): { position: Point; rotation: number; cost: number } | null {
  const { boardMargin, componentSpacing } = options
  
  // Шаг сетки для поиска позиций
  const gridStep = Math.max(1, Math.min(footprint.width, footprint.height) / 2)
  
  let bestPosition: Point | null = null
  let bestRotation = 0
  let bestCost = Infinity

  // Определяем возможные повороты
  const rotations = options.preferredOrientation === 'horizontal' 
    ? [0, 180]
    : options.preferredOrientation === 'vertical'
    ? [90, 270]
    : [0, 90, 180, 270]

  // Если есть связанные компоненты, ищем рядом с ними
  const connectedComponents = findConnectedComponents(reference, placedComponents, netlist)
  
  if (connectedComponents.length > 0) {
    // Центр тяжести связанных компонентов
    const centerX = connectedComponents.reduce((sum, c) => sum + c.position.x, 0) / connectedComponents.length
    const centerY = connectedComponents.reduce((sum, c) => sum + c.position.y, 0) / connectedComponents.length

    // Поиск в области вокруг центра тяжести
    const searchRadius = Math.max(boardWidth, boardHeight) / 2
    
    for (const rotation of rotations) {
      for (let dx = -searchRadius; dx <= searchRadius; dx += gridStep) {
        for (let dy = -searchRadius; dy <= searchRadius; dy += gridStep) {
          const position = { x: centerX + dx, y: centerY + dy }

          // Проверка границ платы
          if (!isWithinBoard(position, footprint, boardWidth, boardHeight, boardMargin)) {
            continue
          }

          // Проверка коллизий
          if (hasCollisionWithPlaced(position, footprint, rotation, placedComponents, componentSpacing)) {
            continue
          }

          // Расчет стоимости
          const cost = calculatePlacementCost(
            reference,
            footprint,
            position,
            rotation,
            placedComponents,
            netlist
          )

          if (cost < bestCost) {
            bestCost = cost
            bestPosition = position
            bestRotation = rotation
          }
        }
      }
    }
  }

  // Если не нашли позицию рядом со связанными, ищем по всей плате
  if (!bestPosition) {
    for (const rotation of rotations) {
      for (let x = boardMargin + footprint.width / 2; x <= boardWidth - boardMargin - footprint.width / 2; x += gridStep) {
        for (let y = boardMargin + footprint.height / 2; y <= boardHeight - boardMargin - footprint.height / 2; y += gridStep) {
          const position = { x, y }

          if (hasCollisionWithPlaced(position, footprint, rotation, placedComponents, componentSpacing)) {
            continue
          }

          const cost = calculatePlacementCost(
            reference,
            footprint,
            position,
            rotation,
            placedComponents,
            netlist
          )

          if (cost < bestCost) {
            bestCost = cost
            bestPosition = position
            bestRotation = rotation
          }
        }
      }
    }
  }

  if (!bestPosition) return null

  return {
    position: bestPosition,
    rotation: bestRotation,
    cost: bestCost
  }
}

/**
 * Находит компоненты, связанные с данным через netlist
 */
function findConnectedComponents(
  reference: string,
  placedComponents: PlacedComponent[],
  netlist: Netlist
): PlacedComponent[] {
  const connectedRefs = new Set<string>()

  for (const net of netlist.nets) {
    const hasMyPin = net.pins.some(p => p.componentRef === reference)
    if (!hasMyPin) continue

    for (const pin of net.pins) {
      if (pin.componentRef !== reference) {
        connectedRefs.add(pin.componentRef)
      }
    }
  }

  return placedComponents.filter(c => connectedRefs.has(c.reference))
}

/**
 * Сортирует компоненты по связности (от наиболее связанного к наименее)
 */
function sortByConnectivity(
  components: Array<{ reference: string; footprint: Footprint }>,
  netlist: Netlist
): Array<{ reference: string; footprint: Footprint; connectivity: number }> {
  return components
    .map(c => ({
      ...c,
      connectivity: calculateConnectivity(c.reference, netlist)
    }))
    .sort((a, b) => b.connectivity - a.connectivity)
}

/**
 * Основной алгоритм автоматического размещения
 */
export function autoPlace(
  componentsToPlace: Array<{ reference: string; footprint: Footprint; value?: string }>,
  netlist: Netlist,
  board: PCBBoard,
  options: PlacementOptions = {
    boardMargin: 5,
    componentSpacing: 2,
    preferredOrientation: 'auto',
    sortBy: 'connectivity'
  }
): PlacementResult {
  const placedComponents: PlacedComponent[] = [...board.components]
  const failedPlacements: string[] = []

  // Сортируем компоненты
  let sortedComponents: Array<{ reference: string; footprint: Footprint; value?: string; connectivity?: number }>
  
  if (options.sortBy === 'connectivity') {
    sortedComponents = sortByConnectivity(componentsToPlace, netlist)
  } else if (options.sortBy === 'size') {
    sortedComponents = [...componentsToPlace].sort((a, b) => {
      const areaA = a.footprint.width * a.footprint.height
      const areaB = b.footprint.width * b.footprint.height
      return areaB - areaA // Большие сначала
    })
  } else {
    sortedComponents = [...componentsToPlace].sort((a, b) => 
      a.reference.localeCompare(b.reference)
    )
  }

  // Размещаем первый компонент в центре платы
  if (sortedComponents.length > 0 && placedComponents.length === 0) {
    const first = sortedComponents[0]
    const centerPosition = {
      x: board.width / 2,
      y: board.height / 2
    }

    placedComponents.push({
      id: `placed-${Date.now()}-0`,
      footprintId: first.footprint.id,
      footprint: first.footprint,
      position: centerPosition,
      rotation: 0,
      reference: first.reference,
      value: first.value || '',
      layer: 'top',
      netConnections: {}
    })

    sortedComponents = sortedComponents.slice(1)
  }

  // Размещаем остальные компоненты последовательно
  for (let i = 0; i < sortedComponents.length; i++) {
    const comp = sortedComponents[i]

    const result = findOptimalPosition(
      comp.reference,
      comp.footprint,
      placedComponents,
      netlist,
      board.width,
      board.height,
      options
    )

    if (result) {
      placedComponents.push({
        id: `placed-${Date.now()}-${i + 1}`,
        footprintId: comp.footprint.id,
        footprint: comp.footprint,
        position: result.position,
        rotation: result.rotation,
        reference: comp.reference,
        value: comp.value || '',
        layer: 'top',
        netConnections: {}
      })
    } else {
      failedPlacements.push(comp.reference)
    }
  }

  // Вычисляем итоговую длину связей
  const wirelength = calculateWirelength(placedComponents, netlist)

  return {
    components: placedComponents,
    wirelength,
    success: failedPlacements.length === 0,
    message: failedPlacements.length > 0
      ? `Не удалось разместить: ${failedPlacements.join(', ')}`
      : `Размещение завершено. Общая длина связей: ${wirelength.toFixed(2)} мм`
  }
}

/**
 * Улучшение размещения методом локального поиска
 */
export function optimizePlacement(
  components: PlacedComponent[],
  netlist: Netlist,
  board: PCBBoard,
  iterations: number = 100
): PlacedComponent[] {
  let currentComponents = [...components]
  let currentWirelength = calculateWirelength(currentComponents, netlist)

  for (let iter = 0; iter < iterations; iter++) {
    // Выбираем случайный компонент
    const idx = Math.floor(Math.random() * currentComponents.length)
    const component = currentComponents[idx]

    // Пробуем небольшие смещения
    const offsets = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 }
    ]

    for (const offset of offsets) {
      const newPosition = {
        x: component.position.x + offset.x,
        y: component.position.y + offset.y
      }

      // Проверяем границы и коллизии
      if (!isWithinBoard(newPosition, component.footprint, board.width, board.height, 2)) {
        continue
      }

      const othersWithoutCurrent = currentComponents.filter((_, i) => i !== idx)
      if (hasCollisionWithPlaced(newPosition, component.footprint, component.rotation, othersWithoutCurrent, 1)) {
        continue
      }

      // Вычисляем новую длину связей
      const testComponents = [...currentComponents]
      testComponents[idx] = { ...component, position: newPosition }
      const newWirelength = calculateWirelength(testComponents, netlist)

      // Принимаем улучшение
      if (newWirelength < currentWirelength) {
        currentComponents = testComponents
        currentWirelength = newWirelength
        break
      }
    }
  }

  return currentComponents
}

/**
 * Извлекает netlist из существующих дорожек на плате
 * Анализирует соединения между площадками компонентов
 */
export function extractNetlistFromTraces(board: PCBBoard): Netlist {
  const nets: Net[] = []
  const netMap = new Map<string, Set<string>>() // netName -> set of "componentRef:pinNumber"

  // Анализируем дорожки и находим соединения
  for (const trace of board.traces) {
    const connectedPins: Array<{ componentRef: string; pinNumber: string }> = []

    // Для каждой точки дорожки ищем ближайшие площадки
    for (const point of trace.points) {
      for (const component of board.components) {
        for (const pad of component.footprint.pads) {
          // Вычисляем глобальную позицию площадки
          const rad = (component.rotation * Math.PI) / 180
          const rotX = pad.position.x * Math.cos(rad) - pad.position.y * Math.sin(rad)
          const rotY = pad.position.x * Math.sin(rad) + pad.position.y * Math.cos(rad)
          const padGlobalX = component.position.x + rotX
          const padGlobalY = component.position.y + rotY

          // Проверяем близость к точке дорожки
          const distance = Math.sqrt(
            Math.pow(point.x - padGlobalX, 2) + Math.pow(point.y - padGlobalY, 2)
          )

          if (distance < pad.width / 2 + trace.width / 2 + 0.5) {
            connectedPins.push({
              componentRef: component.reference,
              pinNumber: pad.number
            })
          }
        }
      }
    }

    // Если нашли соединенные пины, добавляем их в netlist
    if (connectedPins.length >= 2) {
      const netName = trace.netName || `Net_${nets.length + 1}`
      
      if (!netMap.has(netName)) {
        netMap.set(netName, new Set())
      }
      
      const pinSet = netMap.get(netName)!
      for (const pin of connectedPins) {
        pinSet.add(`${pin.componentRef}:${pin.pinNumber}`)
      }
    }
  }

  // Преобразуем Map в массив Net
  for (const [name, pinSet] of netMap) {
    const pins = Array.from(pinSet).map(pinStr => {
      const [componentRef, pinNumber] = pinStr.split(':')
      return { componentRef, pinNumber }
    })
    nets.push({ name, pins })
  }

  return { nets }
}

/**
 * Строит граф связности компонентов на основе netlist
 */
function buildConnectivityGraph(
  components: PlacedComponent[],
  netlist: Netlist
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>()

  // Инициализируем граф
  for (const component of components) {
    graph.set(component.reference, new Set())
  }

  // Добавляем связи на основе netlist
  for (const net of netlist.nets) {
    const componentRefs = [...new Set(net.pins.map(p => p.componentRef))]
    
    // Каждый компонент в цепи связан с каждым другим
    for (let i = 0; i < componentRefs.length; i++) {
      for (let j = i + 1; j < componentRefs.length; j++) {
        const ref1 = componentRefs[i]
        const ref2 = componentRefs[j]
        
        if (graph.has(ref1)) {
          graph.get(ref1)!.add(ref2)
        }
        if (graph.has(ref2)) {
          graph.get(ref2)!.add(ref1)
        }
      }
    }
  }

  return graph
}

/**
 * Определяет порядок размещения компонентов на основе топологической сортировки
 * и принципов последовательного размещения сигнального пути
 */
function determineSequentialOrder(
  components: PlacedComponent[],
  netlist: Netlist
): PlacedComponent[] {
  const graph = buildConnectivityGraph(components, netlist)
  const componentMap = new Map(components.map(c => [c.reference, c]))
  
  // Вычисляем "важность" каждого компонента (количество связей)
  const importance = new Map<string, number>()
  for (const [ref, connections] of graph) {
    importance.set(ref, connections.size)
  }

  // Сортируем компоненты:
  // 1. Сначала микросхемы (DD, DA, U) - они являются "центрами" схемы
  // 2. Затем по количеству связей
  // 3. Затем резисторы и конденсаторы рядом со связанными компонентами
  const sorted = [...components].sort((a, b) => {
    const aIsIC = /^(DD|DA|U|IC)/.test(a.reference)
    const bIsIC = /^(DD|DA|U|IC)/.test(b.reference)
    
    if (aIsIC && !bIsIC) return -1
    if (!aIsIC && bIsIC) return 1

    // Кварцы и важные элементы
    const aIsQuartz = /^(Z|Y|Q)/.test(a.reference)
    const bIsQuartz = /^(Z|Y|Q)/.test(b.reference)
    if (aIsQuartz && !bIsQuartz) return -1
    if (!aIsQuartz && bIsQuartz) return 1

    // По количеству связей (больше связей = важнее)
    const impA = importance.get(a.reference) || 0
    const impB = importance.get(b.reference) || 0
    if (impA !== impB) return impB - impA

    // По размеру (большие сначала)
    const areaA = a.footprint.width * a.footprint.height
    const areaB = b.footprint.width * b.footprint.height
    return areaB - areaA
  })

  return sorted
}

/**
 * Находит оптимальную позицию для компонента с учетом сигнального пути
 */
function findSequentialPosition(
  component: PlacedComponent,
  placedComponents: PlacedComponent[],
  netlist: Netlist,
  board: PCBBoard,
  options: PlacementOptions
): Point {
  const { boardMargin, componentSpacing } = options

  // Находим компоненты, с которыми этот компонент связан
  const connectedRefs = new Set<string>()
  for (const net of netlist.nets) {
    if (net.pins.some(p => p.componentRef === component.reference)) {
      for (const pin of net.pins) {
        if (pin.componentRef !== component.reference) {
          connectedRefs.add(pin.componentRef)
        }
      }
    }
  }

  // Находим размещенные связанные компоненты
  const connectedPlaced = placedComponents.filter(c => connectedRefs.has(c.reference))

  // Если есть связанные компоненты, размещаем рядом с ними
  if (connectedPlaced.length > 0) {
    // Вычисляем центр масс связанных компонентов
    const centerX = connectedPlaced.reduce((sum, c) => sum + c.position.x, 0) / connectedPlaced.length
    const centerY = connectedPlaced.reduce((sum, c) => sum + c.position.y, 0) / connectedPlaced.length

    // Ищем свободную позицию рядом с центром масс
    const searchRadius = Math.max(board.width, board.height)
    const step = Math.max(component.footprint.width, component.footprint.height) / 2

    for (let r = step; r < searchRadius; r += step) {
      // Пробуем позиции по спирали вокруг центра масс
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const x = centerX + r * Math.cos(angle)
        const y = centerY + r * Math.sin(angle)

        // Проверяем границы платы
        const halfW = component.footprint.width / 2
        const halfH = component.footprint.height / 2
        
        if (x - halfW < boardMargin || x + halfW > board.width - boardMargin ||
            y - halfH < boardMargin || y + halfH > board.height - boardMargin) {
          continue
        }

        // Проверяем коллизии
        let hasCollision = false
        for (const placed of placedComponents) {
          if (checkCollision(
            { ...component, position: { x, y } },
            placed,
            componentSpacing
          )) {
            hasCollision = true
            break
          }
        }

        if (!hasCollision) {
          return { x, y }
        }
      }
    }
  }

  // Если не нашли позицию рядом со связанными, используем fallback
  return findFallbackPosition(component, placedComponents, board, options)
}

/**
 * Fallback позиционирование - размещение в свободной области платы
 */
function findFallbackPosition(
  component: PlacedComponent,
  placedComponents: PlacedComponent[],
  board: PCBBoard,
  options: PlacementOptions
): Point {
  const { boardMargin, componentSpacing } = options
  const halfW = component.footprint.width / 2
  const halfH = component.footprint.height / 2
  const step = Math.max(halfW, halfH)

  // Сканируем плату построчно
  for (let y = boardMargin + halfH; y < board.height - boardMargin - halfH; y += step) {
    for (let x = boardMargin + halfW; x < board.width - boardMargin - halfW; x += step) {
      let hasCollision = false
      
      for (const placed of placedComponents) {
        if (checkCollision(
          { ...component, position: { x, y } },
          placed,
          componentSpacing
        )) {
          hasCollision = true
          break
        }
      }

      if (!hasCollision) {
        return { x, y }
      }
    }
  }

  // Если не нашли свободного места, возвращаем центр платы
  return { x: board.width / 2, y: board.height / 2 }
}

/**
 * Последовательный алгоритм размещения компонентов
 * Размещает компоненты так, чтобы ток последовательно проходил через них
 * с минимизацией длин проводников
 */
export function sequentialPlacement(
  board: PCBBoard,
  options: PlacementOptions = {
    boardMargin: 5,
    componentSpacing: 3,
    preferredOrientation: 'auto',
    sortBy: 'connectivity'
  }
): PlacementResult {
  if (board.components.length === 0) {
    return {
      components: [],
      wirelength: 0,
      success: false,
      message: 'На плате нет компонентов'
    }
  }

  // Используем netlist из board если есть, иначе извлекаем из дорожек
  const netlist = board.netlist && board.netlist.nets.length > 0 
    ? board.netlist 
    : extractNetlistFromTraces(board)
  
  console.log(`Using netlist with ${netlist.nets.length} nets for placement`)
  
  // Определяем порядок размещения
  const orderedComponents = determineSequentialOrder(board.components, netlist)
  
  const placedComponents: PlacedComponent[] = []
  const { boardMargin, componentSpacing } = options

  for (const component of orderedComponents) {
    let position: Point

    if (placedComponents.length === 0) {
      // Первый компонент (обычно главная микросхема) - размещаем в центре
      position = { x: board.width / 2, y: board.height / 2 }
    } else {
      // Остальные компоненты - ищем оптимальную позицию
      position = findSequentialPosition(component, placedComponents, netlist, board, options)
    }

    // Проверяем границы платы
    const halfW = component.footprint.width / 2
    const halfH = component.footprint.height / 2
    
    position.x = Math.max(boardMargin + halfW, Math.min(board.width - boardMargin - halfW, position.x))
    position.y = Math.max(boardMargin + halfH, Math.min(board.height - boardMargin - halfH, position.y))

    placedComponents.push({
      ...component,
      position
    })
  }

  // Вычисляем общую длину связей
  const wirelength = calculateWirelength(placedComponents, netlist)

  return {
    components: placedComponents,
    wirelength,
    success: true,
    message: `Последовательное размещение: ${placedComponents.length} компонентов, длина связей: ${wirelength.toFixed(1)} мм`
  }
}

/**
 * Автоматическое размещение компонентов, уже находящихся на плате
 * Последовательный алгоритм с минимизацией суммарной длины связей
 */
export function autoPlaceOnBoard(
  board: PCBBoard,
  options: PlacementOptions = {
    boardMargin: 5,
    componentSpacing: 3,
    preferredOrientation: 'auto',
    sortBy: 'size'
  }
): PlacementResult {
  // Используем новый последовательный алгоритм
  return sequentialPlacement(board, options)
}
