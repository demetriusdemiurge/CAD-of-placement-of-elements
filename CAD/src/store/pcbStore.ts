/**
 * Zustand store для PCB режима
 */

import { create } from 'zustand'
import {
  PCBBoard,
  PlacedComponent,
  Trace,
  Via,
  Footprint,
  PCBLayer,
  Netlist,
  PlacementOptions,
  RoutingOptions,
  Point
} from '../types/pcb'
import {
  LoadedFootprintLibrary,
  loadLibrariesFromLocalStorage,
  saveLibrariesToLocalStorage,
  loadLibraryFromFile,
  loadAllLibrariesFromData,
  createStandardLibrary,
  findFootprintById
} from '../utils/mdLibraryManager'

// Типы инструментов PCB
export type PCBTool = 
  | 'select'
  | 'place'
  | 'trace'
  | 'via'
  | 'measure'
  | 'delete'
  | 'move'
  | 'rotate'

// Начальные слои платы
const defaultLayers: PCBLayer[] = [
  { id: 'top-copper', name: 'Top Copper', type: 'top', color: '#ff0000', visible: true, locked: false },
  { id: 'bottom-copper', name: 'Bottom Copper', type: 'bottom', color: '#0000ff', visible: true, locked: false },
  { id: 'top-silk', name: 'Top Silkscreen', type: 'silkscreen_top', color: '#ffffff', visible: true, locked: false },
  { id: 'bottom-silk', name: 'Bottom Silkscreen', type: 'silkscreen_bottom', color: '#ffff00', visible: true, locked: false },
  { id: 'top-mask', name: 'Top Soldermask', type: 'soldermask_top', color: '#00ff0080', visible: false, locked: false },
  { id: 'bottom-mask', name: 'Bottom Soldermask', type: 'soldermask_bottom', color: '#0000ff80', visible: false, locked: false },
]

// Начальная плата
const defaultBoard: PCBBoard = {
  name: 'Новая плата',
  width: 100,
  height: 80,
  gridSize: 1.27, // 50 mil
  components: [],
  traces: [],
  vias: [],
  layers: defaultLayers,
  outline: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 80 },
    { x: 0, y: 80 }
  ]
}

// Параметры по умолчанию
const defaultPlacementOptions: PlacementOptions = {
  boardMargin: 5,
  componentSpacing: 2,
  preferredOrientation: 'auto',
  sortBy: 'connectivity'
}

const defaultRoutingOptions: RoutingOptions = {
  traceWidth: 0.5,
  clearance: 0.3,
  viaDiameter: 0.8,
  gridSize: 0.5,
  allowVias: true,
  preferredLayers: ['top-copper', 'bottom-copper']
}

interface PCBState {
  // Данные платы
  board: PCBBoard
  netlist: Netlist | null
  
  // Библиотеки корпусов
  footprintLibraries: LoadedFootprintLibrary[]
  librariesLoading: boolean
  
  // UI состояние
  activeTool: PCBTool
  activeLayer: string
  selectedComponents: string[]
  selectedTraces: string[]
  selectedFootprint: Footprint | null
  
  // Параметры canvas
  zoom: number
  pan: Point
  showGrid: boolean
  showRatsnest: boolean
  snapToGrid: boolean
  canvasSize: { width: number; height: number }
  
  // Параметры алгоритмов
  placementOptions: PlacementOptions
  routingOptions: RoutingOptions
  
  // История для undo/redo
  history: PCBBoard[]
  historyIndex: number
  
  // Actions - Управление платой
  setBoard: (board: PCBBoard, fitToScreen?: boolean) => void
  setCanvasSize: (width: number, height: number) => void
  fitBoardToScreen: () => void
  setBoardSize: (width: number, height: number) => void
  setBoardName: (name: string) => void
  setGridSize: (size: number) => void
  newBoard: () => void
  
  // Actions - Компоненты
  addComponent: (component: PlacedComponent) => void
  removeComponent: (id: string) => void
  updateComponent: (id: string, updates: Partial<PlacedComponent>) => void
  moveComponent: (id: string, position: Point) => void
  rotateComponent: (id: string) => void
  
  // Actions - Дорожки
  addTrace: (trace: Trace) => void
  removeTrace: (id: string) => void
  updateTrace: (id: string, updates: Partial<Trace>) => void
  
  // Actions - Переходные отверстия
  addVia: (via: Via) => void
  removeVia: (id: string) => void
  
  // Actions - Слои
  setActiveLayer: (layerId: string) => void
  toggleLayerVisibility: (layerId: string) => void
  toggleLayerLock: (layerId: string) => void
  
  // Actions - Библиотеки
  loadFootprintLibraries: () => Promise<void>
  loadFootprintLibraryFromFile: (file: File) => Promise<boolean>
  removeFootprintLibrary: (name: string) => void
  setSelectedFootprint: (footprint: Footprint | null) => void
  getFootprintById: (id: string) => Footprint | null
  
  // Actions - UI
  setActiveTool: (tool: PCBTool) => void
  setSelectedComponents: (ids: string[]) => void
  setSelectedTraces: (ids: string[]) => void
  setZoom: (zoom: number) => void
  setPan: (pan: Point) => void
  toggleGrid: () => void
  toggleRatsnest: () => void
  toggleSnapToGrid: () => void
  
  // Actions - Netlist
  setNetlist: (netlist: Netlist) => void
  
  // Actions - Алгоритмы
  setPlacementOptions: (options: Partial<PlacementOptions>) => void
  setRoutingOptions: (options: Partial<RoutingOptions>) => void
  
  // Actions - История
  saveHistory: () => void
  undo: () => void
  redo: () => void
  
  // Actions - Удаление выделенного
  deleteSelected: () => void
}

// Масштаб мм в пиксели (должен совпадать с pcbCanvasUtils)
const MM_TO_PX = 5

export const usePCBStore = create<PCBState>((set, get) => ({
  // Initial state
  board: defaultBoard,
  netlist: null,
  footprintLibraries: loadLibrariesFromLocalStorage(),
  librariesLoading: false,
  activeTool: 'select',
  activeLayer: 'top-copper',
  selectedComponents: [],
  selectedTraces: [],
  selectedFootprint: null,
  zoom: 1,
  pan: { x: 50, y: 50 },
  showGrid: true,
  showRatsnest: true,
  snapToGrid: true,
  canvasSize: { width: 800, height: 600 },
  placementOptions: defaultPlacementOptions,
  routingOptions: defaultRoutingOptions,
  history: [],
  historyIndex: -1,

  // Board actions
  setBoard: (board, fitToScreen = true) => {
    set({ board })
    if (fitToScreen) {
      // Вызываем fitBoardToScreen после установки board
      setTimeout(() => get().fitBoardToScreen(), 0)
    }
  },
  
  setCanvasSize: (width, height) => set({ canvasSize: { width, height } }),
  
  fitBoardToScreen: () => {
    const state = get()
    const { board, canvasSize } = state
    
    // Размеры платы в пикселях
    const boardWidthPx = board.width * MM_TO_PX
    const boardHeightPx = board.height * MM_TO_PX
    
    // Отступы для комфортного отображения
    const padding = 80
    
    // Доступное пространство
    const availableWidth = canvasSize.width - padding * 2
    const availableHeight = canvasSize.height - padding * 2
    
    // Вычисляем масштаб, чтобы плата поместилась на экране
    const scaleX = availableWidth / boardWidthPx
    const scaleY = availableHeight / boardHeightPx
    const optimalZoom = Math.min(scaleX, scaleY, 2) // Не более 200%
    
    // Вычисляем pan для центрирования платы
    const scaledBoardWidth = boardWidthPx * optimalZoom
    const scaledBoardHeight = boardHeightPx * optimalZoom
    const panX = (canvasSize.width - scaledBoardWidth) / 2
    const panY = (canvasSize.height - scaledBoardHeight) / 2
    
    set({
      zoom: Math.max(0.1, optimalZoom),
      pan: { x: panX, y: panY }
    })
  },
  
  setBoardSize: (width, height) => set((state) => ({
    board: {
      ...state.board,
      width,
      height,
      outline: [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height }
      ]
    }
  })),
  
  setBoardName: (name) => set((state) => ({
    board: { ...state.board, name }
  })),
  
  setGridSize: (gridSize) => set((state) => ({
    board: { ...state.board, gridSize }
  })),
  
  newBoard: () => {
    if (confirm('Создать новую плату? Все несохраненные изменения будут потеряны.')) {
      set({
        board: { ...defaultBoard },
        selectedComponents: [],
        selectedTraces: [],
        netlist: null,
        history: [],
        historyIndex: -1
      })
    }
  },

  // Component actions
  addComponent: (component) => {
    get().saveHistory()
    set((state) => ({
      board: {
        ...state.board,
        components: [...state.board.components, component]
      }
    }))
  },
  
  removeComponent: (id) => {
    get().saveHistory()
    set((state) => ({
      board: {
        ...state.board,
        components: state.board.components.filter(c => c.id !== id)
      },
      selectedComponents: state.selectedComponents.filter(cid => cid !== id)
    }))
  },
  
  updateComponent: (id, updates) => {
    set((state) => ({
      board: {
        ...state.board,
        components: state.board.components.map(c =>
          c.id === id ? { ...c, ...updates } : c
        )
      }
    }))
  },
  
  moveComponent: (id, position) => {
    set((state) => ({
      board: {
        ...state.board,
        components: state.board.components.map(c =>
          c.id === id ? { ...c, position } : c
        )
      }
    }))
  },
  
  rotateComponent: (id) => {
    get().saveHistory()
    set((state) => ({
      board: {
        ...state.board,
        components: state.board.components.map(c =>
          c.id === id ? { ...c, rotation: (c.rotation + 90) % 360 } : c
        )
      }
    }))
  },

  // Trace actions
  addTrace: (trace) => {
    get().saveHistory()
    set((state) => ({
      board: {
        ...state.board,
        traces: [...state.board.traces, trace]
      }
    }))
  },
  
  removeTrace: (id) => {
    get().saveHistory()
    set((state) => ({
      board: {
        ...state.board,
        traces: state.board.traces.filter(t => t.id !== id)
      },
      selectedTraces: state.selectedTraces.filter(tid => tid !== id)
    }))
  },
  
  updateTrace: (id, updates) => {
    set((state) => ({
      board: {
        ...state.board,
        traces: state.board.traces.map(t =>
          t.id === id ? { ...t, ...updates } : t
        )
      }
    }))
  },

  // Via actions
  addVia: (via) => {
    get().saveHistory()
    set((state) => ({
      board: {
        ...state.board,
        vias: [...state.board.vias, via]
      }
    }))
  },
  
  removeVia: (id) => {
    get().saveHistory()
    set((state) => ({
      board: {
        ...state.board,
        vias: state.board.vias.filter(v => v.id !== id)
      }
    }))
  },

  // Layer actions
  setActiveLayer: (layerId) => set({ activeLayer: layerId }),
  
  toggleLayerVisibility: (layerId) => set((state) => ({
    board: {
      ...state.board,
      layers: state.board.layers.map(l =>
        l.id === layerId ? { ...l, visible: !l.visible } : l
      )
    }
  })),
  
  toggleLayerLock: (layerId) => set((state) => ({
    board: {
      ...state.board,
      layers: state.board.layers.map(l =>
        l.id === layerId ? { ...l, locked: !l.locked } : l
      )
    }
  })),

  // Library actions
  loadFootprintLibraries: async () => {
    set({ librariesLoading: true })
    try {
      let libraries = await loadAllLibrariesFromData()
      
      // Если библиотеки пустые, добавляем стандартную
      if (libraries.length === 0) {
        const standardLib = createStandardLibrary()
        libraries = [{
          name: standardLib.name,
          fileName: 'standard.md',
          library: standardLib,
          loadedAt: new Date()
        }]
      }
      
      set((state) => {
        const existingNames = new Set(state.footprintLibraries.map(l => l.name))
        const newLibraries = libraries.filter(l => !existingNames.has(l.name))
        const merged = [...state.footprintLibraries, ...newLibraries]
        saveLibrariesToLocalStorage(merged)
        return { footprintLibraries: merged, librariesLoading: false }
      })
    } catch (error) {
      console.error('Error loading footprint libraries:', error)
      set({ librariesLoading: false })
    }
  },
  
  loadFootprintLibraryFromFile: async (file) => {
    set({ librariesLoading: true })
    try {
      const library = await loadLibraryFromFile(file)
      if (library) {
        set((state) => {
          const filtered = state.footprintLibraries.filter(l => l.name !== library.name)
          const merged = [...filtered, library]
          saveLibrariesToLocalStorage(merged)
          return { footprintLibraries: merged, librariesLoading: false }
        })
        return true
      }
      set({ librariesLoading: false })
      return false
    } catch (error) {
      console.error('Error loading footprint library from file:', error)
      set({ librariesLoading: false })
      return false
    }
  },
  
  removeFootprintLibrary: (name) => {
    set((state) => {
      const filtered = state.footprintLibraries.filter(l => l.name !== name)
      saveLibrariesToLocalStorage(filtered)
      return { footprintLibraries: filtered }
    })
  },
  
  setSelectedFootprint: (footprint) => set({ selectedFootprint: footprint }),
  
  getFootprintById: (id) => {
    const state = get()
    return findFootprintById(state.footprintLibraries, id)
  },

  // UI actions
  setActiveTool: (tool) => set({ activeTool: tool }),
  
  setSelectedComponents: (ids) => set({ selectedComponents: ids }),
  
  setSelectedTraces: (ids) => set({ selectedTraces: ids }),
  
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),
  
  setPan: (pan) => set({ pan }),
  
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  
  toggleRatsnest: () => set((state) => ({ showRatsnest: !state.showRatsnest })),
  
  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

  // Netlist actions
  setNetlist: (netlist) => set({ netlist }),

  // Algorithm options
  setPlacementOptions: (options) => set((state) => ({
    placementOptions: { ...state.placementOptions, ...options }
  })),
  
  setRoutingOptions: (options) => set((state) => ({
    routingOptions: { ...state.routingOptions, ...options }
  })),

  // History actions
  saveHistory: () => {
    const state = get()
    const newHistory = state.history.slice(0, state.historyIndex + 1)
    newHistory.push(JSON.parse(JSON.stringify(state.board)))
    
    if (newHistory.length > 50) {
      newHistory.shift()
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1
    })
  },
  
  undo: () => {
    const state = get()
    if (state.historyIndex > 0) {
      const prevBoard = state.history[state.historyIndex - 1]
      set({
        board: JSON.parse(JSON.stringify(prevBoard)),
        historyIndex: state.historyIndex - 1
      })
    }
  },
  
  redo: () => {
    const state = get()
    if (state.historyIndex < state.history.length - 1) {
      const nextBoard = state.history[state.historyIndex + 1]
      set({
        board: JSON.parse(JSON.stringify(nextBoard)),
        historyIndex: state.historyIndex + 1
      })
    }
  },

  // Delete selected
  deleteSelected: () => {
    const state = get()
    if (state.selectedComponents.length === 0 && state.selectedTraces.length === 0) return
    
    get().saveHistory()
    
    set((state) => ({
      board: {
        ...state.board,
        components: state.board.components.filter(c => !state.selectedComponents.includes(c.id)),
        traces: state.board.traces.filter(t => !state.selectedTraces.includes(t.id))
      },
      selectedComponents: [],
      selectedTraces: []
    }))
  }
}))
