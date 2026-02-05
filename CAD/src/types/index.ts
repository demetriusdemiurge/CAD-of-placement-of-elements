export interface Point {
  x: number
  y: number
}

export interface Pin {
  id: string
  position: Point
  name: string
  number: string
  type: 'input' | 'output' | 'bidirectional' | 'power'
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

export type Tool = 
  | 'select' 
  | 'wire' 
  | 'component' 
  | 'label' 
  | 'junction' 
  | 'bus' 
  | 'delete' 
  | 'move' 
  | 'rotate'

export type Mode = 'schematic' | 'pcb' | 'library'

export interface Project {
  name: string
  version: string
  created: string
  modified: string
  components: Component[]
  wires: Wire[]
  layers: Layer[]
}

