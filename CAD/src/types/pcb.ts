/**
 * Типы данных для PCB (печатной платы)
 */

import { Point } from './index'

// Тип формы площадки
export type PadShape = 'rect' | 'circle' | 'oval'

// Слой платы
export type PCBLayerType = 'top' | 'bottom' | 'silkscreen_top' | 'silkscreen_bottom' | 'soldermask_top' | 'soldermask_bottom'

// SMD площадка
export interface Pad {
  id: string
  number: string           // Номер пина (1, 2, 3...)
  position: Point          // Позиция относительно центра корпуса
  width: number            // Ширина площадки
  height: number           // Высота площадки
  shape: PadShape          // Форма: прямоугольник, круг, овал
  layer: 'top' | 'bottom'  // Слой размещения
  netName?: string         // Имя цепи для связи
  rotation?: number        // Поворот площадки
}

// Корпус элемента (Footprint)
export interface Footprint {
  id: string
  name: string             // Название корпуса (SOT23, DIP8, 0805...)
  description?: string     // Описание
  pads: Pad[]              // Массив площадок
  outline: Point[]         // Контур корпуса (для отрисовки)
  courtyard: Point[]       // Зона запрета (для проверки коллизий)
  width: number            // Общая ширина корпуса
  height: number           // Общая высота корпуса
  referencePosition?: Point // Позиция референса
  valuePosition?: Point    // Позиция значения
}

// Размещенный компонент на плате
export interface PlacedComponent {
  id: string
  footprintId: string      // ID корпуса из библиотеки
  footprint: Footprint     // Копия корпуса
  position: Point          // Позиция на плате
  rotation: number         // Поворот (0, 90, 180, 270)
  reference: string        // Обозначение (R1, C1, U1...)
  value: string            // Значение (10k, 100nF...)
  layer: 'top' | 'bottom'  // Сторона платы
  netConnections: Record<string, string>  // padNumber -> netName
  locked?: boolean         // Заблокирован ли компонент
}

// Дорожка (trace)
export interface Trace {
  id: string
  netName: string          // Имя цепи
  points: Point[]          // Точки дорожки
  width: number            // Ширина дорожки
  layer: string            // Слой (top, bottom)
}

// Переходное отверстие (via)
export interface Via {
  id: string
  position: Point
  diameter: number         // Диаметр отверстия
  padDiameter: number      // Диаметр площадки
  netName: string
  layers: string[]         // Соединяемые слои
}

// Слой платы
export interface PCBLayer {
  id: string
  name: string
  type: PCBLayerType
  color: string
  visible: boolean
  locked: boolean
}

// Печатная плата
export interface PCBBoard {
  name: string
  width: number            // Ширина платы в мм
  height: number           // Высота платы в мм
  gridSize: number         // Размер сетки
  components: PlacedComponent[]
  traces: Trace[]
  vias: Via[]
  layers: PCBLayer[]
  outline: Point[]         // Контур платы (для нестандартных форм)
  netlist?: Netlist        // Список цепей (импортированный из файла)
}

// Цепь (Net)
export interface Net {
  name: string
  pins: Array<{
    componentRef: string   // Обозначение компонента (R1, C1...)
    pinNumber: string      // Номер пина
  }>
}

// Список цепей (Netlist)
export interface Netlist {
  nets: Net[]
}

// Сетка для трассировки
export interface RoutingGrid {
  width: number
  height: number
  cellSize: number
  cells: number[][]        // 0 = свободно, 1 = занято, >1 = волна
}

// Результат размещения
export interface PlacementResult {
  components: PlacedComponent[]
  wirelength: number       // Общая длина связей
  success: boolean
  message?: string
}

// Результат трассировки
export interface RoutingResult {
  traces: Trace[]
  unrouted: Net[]          // Нетрассированные цепи
  success: boolean
  completionRate: number   // Процент завершения (0-100)
  message?: string
}

// Параметры автоматического размещения
export interface PlacementOptions {
  boardMargin: number      // Отступ от края платы
  componentSpacing: number // Минимальное расстояние между компонентами
  preferredOrientation: 'horizontal' | 'vertical' | 'auto'
  sortBy: 'connectivity' | 'size' | 'name'
}

// Параметры трассировки
export interface RoutingOptions {
  traceWidth: number       // Ширина дорожки по умолчанию
  clearance: number        // Минимальный зазор
  viaDiameter: number      // Диаметр переходного отверстия
  gridSize: number         // Размер сетки трассировки
  allowVias: boolean       // Разрешить переходные отверстия
  preferredLayers: string[] // Предпочтительные слои
}

// Экспорт типа Point для удобства
export type { Point }
