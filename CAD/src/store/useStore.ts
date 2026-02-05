import { create } from 'zustand'
import { LoadedLibrary, LibraryComponent, loadAllLibrariesFromData, loadLibraryFromFile, saveLibrariesToLocalStorage, loadLibrariesFromLocalStorage } from '../utils/libraryLoader'

export type Tool = 'select' | 'wire' | 'component' | 'label' | 'junction' | 'bus' | 'delete' | 'move' | 'rotate'
export type Mode = 'schematic' | 'pcb' | 'library'

export interface Point {
  x: number
  y: number
}

export interface Component {
  id: string
  type: string
  position: Point
  rotation: number
  properties: {
    value?: string
    reference?: string
    [key: string]: any
  }
  pins: Pin[]
}

export interface Pin {
  id: string
  position: Point
  name: string
  number: string
  type: 'input' | 'output' | 'bidirectional' | 'power'
}

export interface Wire {
  id: string
  points: Point[]
  layer: string
}

export interface Layer {
  id: string
  name: string
  color: string
  visible: boolean
  locked: boolean
}

interface HistoryState {
  components: Component[]
  wires: Wire[]
}

export interface CustomComponent {
  name: string
  prefix: string
  shapes: any[]
  pins: Pin[]
  category: string
}

export type { LoadedLibrary, LibraryComponent }

interface Store {
  // UI State
  activeTool: Tool
  activeMode: Mode
  selectedComponentType: string | null
  selectedObjects: string[]
  
  // Canvas State
  zoom: number
  pan: Point
  gridSize: number
  showGrid: boolean
  snapToGrid: boolean
  
  // Project Data
  components: Component[]
  wires: Wire[]
  layers: Layer[]
  activeLayer: string
  
  // History
  history: HistoryState[]
  historyIndex: number
  clipboard: Component[]
  
  // Custom Components
  customComponents: CustomComponent[]
  
  // KiCad Libraries
  kicadLibraries: LoadedLibrary[]
  librariesLoading: boolean
  
  // Actions
  setActiveTool: (tool: Tool) => void
  setActiveMode: (mode: Mode) => void
  setSelectedComponentType: (type: string | null) => void
  setSelectedObjects: (ids: string[]) => void
  setZoom: (zoom: number) => void
  setPan: (pan: Point) => void
  setGridSize: (size: number) => void
  toggleGrid: () => void
  toggleSnapToGrid: () => void
  addComponent: (component: Component) => void
  removeComponent: (id: string) => void
  updateComponent: (id: string, updates: Partial<Component>) => void
  addWire: (wire: Wire) => void
  removeWire: (id: string) => void
  toggleLayer: (id: string) => void
  setActiveLayer: (id: string) => void
  undo: () => void
  redo: () => void
  copy: () => void
  paste: () => void
  saveHistory: () => void
  addCustomComponent: (component: CustomComponent) => void
  removeCustomComponent: (name: string) => void
  
  // KiCad Library Actions
  loadKicadLibrariesFromData: () => Promise<void>
  loadKicadLibraryFromFile: (file: File) => Promise<boolean>
  removeKicadLibrary: (name: string) => void
  getKicadComponent: (libraryName: string, componentName: string) => LibraryComponent | undefined
  
  // Project Actions
  newProject: () => void
  deleteSelected: () => void
  clearAll: () => void
}

export const useStore = create<Store>((set, get) => ({
  // Initial State
  activeTool: 'select',
  activeMode: 'schematic',
  selectedComponentType: null,
  selectedObjects: [],
  
  zoom: 1,
  pan: { x: 0, y: 0 },
  gridSize: 20,
  showGrid: true,
  snapToGrid: true,
  
  components: [],
  wires: [],
  layers: [
    { id: '1', name: 'Schematic', color: '#00ff00', visible: true, locked: false },
    { id: '2', name: 'Annotations', color: '#ffff00', visible: true, locked: false },
    { id: '3', name: 'Reference', color: '#00ffff', visible: true, locked: false },
  ],
  activeLayer: '1',
  
  history: [],
  historyIndex: -1,
  clipboard: [],
  customComponents: [],
  kicadLibraries: loadLibrariesFromLocalStorage(),
  librariesLoading: false,
  
  // Actions
  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveMode: (mode) => set({ activeMode: mode }),
  setSelectedComponentType: (type) => set({ selectedComponentType: type }),
  setSelectedObjects: (ids) => set({ selectedObjects: ids }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),
  setPan: (pan) => set({ pan }),
  setGridSize: (size) => set({ gridSize: size }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
  
  saveHistory: () => {
    const state = get()
    const newHistory = state.history.slice(0, state.historyIndex + 1)
    newHistory.push({
      components: JSON.parse(JSON.stringify(state.components)),
      wires: JSON.parse(JSON.stringify(state.wires))
    })
    
    // Limit history to 50 states
    if (newHistory.length > 50) {
      newHistory.shift()
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1
    })
  },
  
  addComponent: (component) => {
    get().saveHistory()
    set((state) => ({
      components: [...state.components, component]
    }))
  },
  
  removeComponent: (id) => {
    get().saveHistory()
    set((state) => ({
      components: state.components.filter(c => c.id !== id)
    }))
  },
  
  updateComponent: (id, updates) => {
    set((state) => ({
      components: state.components.map(c => 
        c.id === id ? { ...c, ...updates } : c
      )
    }))
  },
  
  addWire: (wire) => {
    get().saveHistory()
    set((state) => ({
      wires: [...state.wires, wire]
    }))
  },
  
  removeWire: (id) => {
    get().saveHistory()
    set((state) => ({
      wires: state.wires.filter(w => w.id !== id)
    }))
  },
  
  toggleLayer: (id) => set((state) => ({
    layers: state.layers.map(l =>
      l.id === id ? { ...l, visible: !l.visible } : l
    )
  })),
  
  setActiveLayer: (id) => set({ activeLayer: id }),
  
  undo: () => {
    const state = get()
    if (state.historyIndex > 0) {
      const prevState = state.history[state.historyIndex - 1]
      set({
        components: JSON.parse(JSON.stringify(prevState.components)),
        wires: JSON.parse(JSON.stringify(prevState.wires)),
        historyIndex: state.historyIndex - 1
      })
    }
  },
  
  redo: () => {
    const state = get()
    if (state.historyIndex < state.history.length - 1) {
      const nextState = state.history[state.historyIndex + 1]
      set({
        components: JSON.parse(JSON.stringify(nextState.components)),
        wires: JSON.parse(JSON.stringify(nextState.wires)),
        historyIndex: state.historyIndex + 1
      })
    }
  },
  
  copy: () => {
    const state = get()
    const selectedComponents = state.components.filter(c => 
      state.selectedObjects.includes(c.id)
    )
    set({
      clipboard: JSON.parse(JSON.stringify(selectedComponents))
    })
  },
  
  paste: () => {
    const state = get()
    if (state.clipboard.length === 0) return
    
    get().saveHistory()
    
    const newComponents = state.clipboard.map(c => ({
      ...c,
      id: `comp-${Date.now()}-${Math.random()}`,
      position: {
        x: c.position.x + 40,
        y: c.position.y + 40
      }
    }))
    
    set((state) => ({
      components: [...state.components, ...newComponents],
      selectedObjects: newComponents.map(c => c.id)
    }))
  },
  
  addCustomComponent: (component) => set((state) => ({
    customComponents: [...state.customComponents, component]
  })),
  
  removeCustomComponent: (name) => set((state) => ({
    customComponents: state.customComponents.filter(c => c.name !== name)
  })),
  
  // KiCad Library Methods
  loadKicadLibrariesFromData: async () => {
    set({ librariesLoading: true })
    try {
      const libraries = await loadAllLibrariesFromData()
      set((state) => {
        // Merge new libraries with existing, avoiding duplicates
        const existingNames = new Set(state.kicadLibraries.map(l => l.name))
        const newLibraries = libraries.filter(l => !existingNames.has(l.name))
        const merged = [...state.kicadLibraries, ...newLibraries]
        saveLibrariesToLocalStorage(merged)
        return { kicadLibraries: merged, librariesLoading: false }
      })
    } catch (error) {
      console.error('Error loading libraries:', error)
      set({ librariesLoading: false })
    }
  },
  
  loadKicadLibraryFromFile: async (file: File) => {
    set({ librariesLoading: true })
    try {
      const library = await loadLibraryFromFile(file)
      if (library) {
        set((state) => {
          // Replace if library with same name exists, otherwise add
          const filtered = state.kicadLibraries.filter(l => l.name !== library.name)
          const merged = [...filtered, library]
          saveLibrariesToLocalStorage(merged)
          return { kicadLibraries: merged, librariesLoading: false }
        })
        return true
      }
      set({ librariesLoading: false })
      return false
    } catch (error) {
      console.error('Error loading library file:', error)
      set({ librariesLoading: false })
      return false
    }
  },
  
  removeKicadLibrary: (name: string) => {
    set((state) => {
      const filtered = state.kicadLibraries.filter(l => l.name !== name)
      saveLibrariesToLocalStorage(filtered)
      return { kicadLibraries: filtered }
    })
  },
  
  getKicadComponent: (libraryName: string, componentName: string) => {
    const state = get()
    const library = state.kicadLibraries.find(l => l.name === libraryName)
    if (library) {
      return library.components.find(c => c.name === componentName)
    }
    return undefined
  },
  
  // Project Actions
  newProject: () => {
    if (confirm('Создать новый проект? Все несохраненные изменения будут потеряны.')) {
      get().saveHistory()
      set({
        components: [],
        wires: [],
        selectedObjects: [],
        selectedComponentType: null,
        pan: { x: 0, y: 0 },
        zoom: 1,
        history: [],
        historyIndex: -1
      })
    }
  },
  
  deleteSelected: () => {
    const state = get()
    if (state.selectedObjects.length === 0) return
    
    get().saveHistory()
    
    // Separate component IDs and wire IDs
    const componentIds = state.selectedObjects.filter(id => !id.startsWith('wire-'))
    const wireIds = state.selectedObjects
      .filter(id => id.startsWith('wire-'))
      .map(id => id.replace('wire-', ''))
    
    // Remove components
    if (componentIds.length > 0) {
      set((state) => ({
        components: state.components.filter(c => !componentIds.includes(c.id))
      }))
    }
    
    // Remove wires
    if (wireIds.length > 0) {
      set((state) => ({
        wires: state.wires.filter(w => !wireIds.includes(w.id))
      }))
    }
    
    // Clear selection
    set({ selectedObjects: [] })
  },
  
  clearAll: () => {
    set({
      components: [],
      wires: [],
      selectedObjects: [],
      selectedComponentType: null
    })
  },
}))

