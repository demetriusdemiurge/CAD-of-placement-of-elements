import { Component, Wire, Point, LoadedLibrary, LibraryComponent } from '../store/useStore'

// Global store for custom components
let customComponentsCache: any[] = []

// Global store for KiCad libraries
let kicadLibrariesCache: LoadedLibrary[] = []

export function setCustomComponentsCache(components: any[]) {
  customComponentsCache = components
}

export function setKicadLibrariesCache(libraries: LoadedLibrary[]) {
  kicadLibrariesCache = libraries
}

// Find KiCad component by ID format: kicad-{libraryName}-{componentName}
function findKicadComponent(componentId: string): LibraryComponent | null {
  if (!componentId.startsWith('kicad-')) return null
  
  const parts = componentId.replace('kicad-', '').split('-')
  if (parts.length < 2) return null
  
  const libraryName = parts[0]
  const componentName = parts.slice(1).join('-')
  
  const library = kicadLibrariesCache.find(l => l.name === libraryName)
  if (!library) return null
  
  return library.components.find(c => c.name === componentName) || null
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gridSize: number,
  zoom: number,
  pan: Point
) {
  const startX = Math.floor((-pan.x / zoom) / gridSize) * gridSize
  const startY = Math.floor((-pan.y / zoom) / gridSize) * gridSize
  const endX = startX + width / zoom + gridSize
  const endY = startY + height / zoom + gridSize
  
  ctx.strokeStyle = '#2a2d2e'
  ctx.lineWidth = 1 / zoom
  
  // Vertical lines
  for (let x = startX; x < endX; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, startY)
    ctx.lineTo(x, endY)
    ctx.stroke()
  }
  
  // Horizontal lines
  for (let y = startY; y < endY; y += gridSize) {
    ctx.beginPath()
    ctx.moveTo(startX, y)
    ctx.lineTo(endX, y)
    ctx.stroke()
  }
  
  // Draw origin
  ctx.strokeStyle = '#ff0000'
  ctx.lineWidth = 2 / zoom
  ctx.beginPath()
  ctx.moveTo(-10, 0)
  ctx.lineTo(10, 0)
  ctx.moveTo(0, -10)
  ctx.lineTo(0, 10)
  ctx.stroke()
}

export function drawWire(ctx: CanvasRenderingContext2D, wire: Wire, isSelected: boolean = false) {
  if (wire.points.length < 2) return
  
  ctx.strokeStyle = isSelected ? '#00ffff' : '#00ff00'
  ctx.lineWidth = isSelected ? 3 : 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  ctx.beginPath()
  ctx.moveTo(wire.points[0].x, wire.points[0].y)
  
  for (let i = 1; i < wire.points.length; i++) {
    ctx.lineTo(wire.points[i].x, wire.points[i].y)
  }
  
  ctx.stroke()
  
  // Draw selection highlight
  if (isSelected) {
    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])
  }
  
  // Draw connection points
  ctx.fillStyle = isSelected ? '#00ffff' : '#00ff00'
  wire.points.forEach(point => {
    ctx.beginPath()
    ctx.arc(point.x, point.y, isSelected ? 4 : 3, 0, Math.PI * 2)
    ctx.fill()
  })
}

/**
 * Check if a point is near a wire segment
 */
export function isPointNearWire(point: Point, wire: Wire, threshold: number = 5): boolean {
  if (wire.points.length < 2) return false
  
  for (let i = 0; i < wire.points.length - 1; i++) {
    const p1 = wire.points[i]
    const p2 = wire.points[i + 1]
    
    // Calculate distance from point to line segment
    const A = point.x - p1.x
    const B = point.y - p1.y
    const C = p2.x - p1.x
    const D = p2.y - p1.y
    
    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1
    
    if (lenSq !== 0) {
      param = dot / lenSq
    }
    
    let xx: number, yy: number
    
    if (param < 0) {
      xx = p1.x
      yy = p1.y
    } else if (param > 1) {
      xx = p2.x
      yy = p2.y
    } else {
      xx = p1.x + param * C
      yy = p1.y + param * D
    }
    
    const dx = point.x - xx
    const dy = point.y - yy
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    if (distance <= threshold) {
      return true
    }
  }
  
  return false
}

export function drawComponent(ctx: CanvasRenderingContext2D, component: Component) {
  const { x, y } = component.position
  const rotation = component.rotation || 0
  
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((rotation * Math.PI) / 180)
  
  // Draw component based on type
  switch (component.type) {
    case 'resistor':
      drawResistor(ctx)
      break
    case 'capacitor':
      drawCapacitor(ctx)
      break
    case 'inductor':
      drawInductor(ctx)
      break
    case 'diode':
      drawDiode(ctx)
      break
    case 'transistor-npn':
      drawTransistorNPN(ctx)
      break
    case 'transistor-pnp':
      drawTransistorPNP(ctx)
      break
    case 'opamp':
      drawOpAmp(ctx)
      break
    case 'ground':
      drawGround(ctx)
      break
    case 'voltage-source':
      drawVoltageSource(ctx)
      break
    case 'and-gate':
      drawANDGate(ctx)
      break
    case 'or-gate':
      drawORGate(ctx)
      break
    case 'label':
      drawLabel(ctx, component.properties.value || 'LABEL')
      break
    case 'junction':
      drawJunction(ctx)
      break
    default:
      // Check if it's a custom component
      if (component.type.startsWith('custom-')) {
        const customName = component.type.replace('custom-', '')
        const customComp = customComponentsCache.find(c => c.name === customName)
        if (customComp) {
          drawCustomComponent(ctx, customComp)
        } else {
          drawGenericComponent(ctx)
        }
      } else if (component.type.startsWith('kicad-')) {
        // Check if it's a KiCad component
        const kicadComp = findKicadComponent(component.type)
        if (kicadComp) {
          drawKicadComponent(ctx, kicadComp)
        } else {
          drawGenericComponent(ctx)
        }
      } else {
        drawGenericComponent(ctx)
      }
  }
  
  // Draw reference designator
  if (component.properties.reference) {
    ctx.fillStyle = '#ffff00'
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(component.properties.reference, 0, -25)
  }
  
  // Draw value
  if (component.properties.value) {
    ctx.fillStyle = '#00ffff'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(component.properties.value, 0, 35)
  }
  
  ctx.restore()
}

function drawResistor(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  
  ctx.beginPath()
  ctx.moveTo(-40, 0)
  ctx.lineTo(-20, 0)
  ctx.lineTo(-15, -8)
  ctx.lineTo(-5, 8)
  ctx.lineTo(5, -8)
  ctx.lineTo(15, 8)
  ctx.lineTo(20, 0)
  ctx.lineTo(40, 0)
  ctx.stroke()
  
  // Draw pins
  ctx.fillStyle = '#00ff00'
  ctx.beginPath()
  ctx.arc(-40, 0, 3, 0, Math.PI * 2)
  ctx.arc(40, 0, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawCapacitor(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  
  ctx.beginPath()
  ctx.moveTo(-40, 0)
  ctx.lineTo(-5, 0)
  ctx.moveTo(-5, -15)
  ctx.lineTo(-5, 15)
  ctx.moveTo(5, -15)
  ctx.lineTo(5, 15)
  ctx.moveTo(5, 0)
  ctx.lineTo(40, 0)
  ctx.stroke()
  
  // Draw pins
  ctx.fillStyle = '#00ff00'
  ctx.beginPath()
  ctx.arc(-40, 0, 3, 0, Math.PI * 2)
  ctx.arc(40, 0, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawInductor(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  
  ctx.beginPath()
  ctx.moveTo(-40, 0)
  ctx.lineTo(-25, 0)
  
  for (let i = 0; i < 4; i++) {
    const x = -25 + i * 12
    ctx.arc(x + 6, 0, 6, Math.PI, 0, false)
  }
  
  ctx.lineTo(40, 0)
  ctx.stroke()
  
  // Draw pins
  ctx.fillStyle = '#00ff00'
  ctx.beginPath()
  ctx.arc(-40, 0, 3, 0, Math.PI * 2)
  ctx.arc(40, 0, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawDiode(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  ctx.lineWidth = 2
  
  ctx.beginPath()
  ctx.moveTo(-40, 0)
  ctx.lineTo(-10, 0)
  ctx.stroke()
  
  // Triangle
  ctx.beginPath()
  ctx.moveTo(-10, -10)
  ctx.lineTo(-10, 10)
  ctx.lineTo(10, 0)
  ctx.closePath()
  ctx.fill()
  
  // Bar
  ctx.beginPath()
  ctx.moveTo(10, -10)
  ctx.lineTo(10, 10)
  ctx.stroke()
  
  ctx.beginPath()
  ctx.moveTo(10, 0)
  ctx.lineTo(40, 0)
  ctx.stroke()
  
  // Draw pins
  ctx.fillStyle = '#00ff00'
  ctx.beginPath()
  ctx.arc(-40, 0, 3, 0, Math.PI * 2)
  ctx.arc(40, 0, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawTransistorNPN(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  
  // Base
  ctx.beginPath()
  ctx.moveTo(-40, 0)
  ctx.lineTo(-10, 0)
  ctx.moveTo(-10, -20)
  ctx.lineTo(-10, 20)
  ctx.stroke()
  
  // Collector
  ctx.beginPath()
  ctx.moveTo(-10, -10)
  ctx.lineTo(15, -30)
  ctx.lineTo(15, -40)
  ctx.stroke()
  
  // Emitter with arrow
  ctx.beginPath()
  ctx.moveTo(-10, 10)
  ctx.lineTo(15, 30)
  ctx.lineTo(15, 40)
  ctx.stroke()
  
  // Arrow
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(15, 30)
  ctx.lineTo(10, 25)
  ctx.lineTo(15, 25)
  ctx.closePath()
  ctx.fill()
  
  // Draw pins
  ctx.fillStyle = '#00ff00'
  ctx.beginPath()
  ctx.arc(-40, 0, 3, 0, Math.PI * 2)
  ctx.arc(15, -40, 3, 0, Math.PI * 2)
  ctx.arc(15, 40, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawTransistorPNP(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  
  // Base
  ctx.beginPath()
  ctx.moveTo(-40, 0)
  ctx.lineTo(-10, 0)
  ctx.moveTo(-10, -20)
  ctx.lineTo(-10, 20)
  ctx.stroke()
  
  // Collector with arrow
  ctx.beginPath()
  ctx.moveTo(-10, -10)
  ctx.lineTo(15, -30)
  ctx.lineTo(15, -40)
  ctx.stroke()
  
  // Arrow
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(-10, -10)
  ctx.lineTo(-15, -15)
  ctx.lineTo(-10, -15)
  ctx.closePath()
  ctx.fill()
  
  // Emitter
  ctx.beginPath()
  ctx.moveTo(-10, 10)
  ctx.lineTo(15, 30)
  ctx.lineTo(15, 40)
  ctx.stroke()
  
  // Draw pins
  ctx.fillStyle = '#00ff00'
  ctx.beginPath()
  ctx.arc(-40, 0, 3, 0, Math.PI * 2)
  ctx.arc(15, -40, 3, 0, Math.PI * 2)
  ctx.arc(15, 40, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawOpAmp(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  
  // Triangle
  ctx.beginPath()
  ctx.moveTo(-30, -30)
  ctx.lineTo(-30, 30)
  ctx.lineTo(30, 0)
  ctx.closePath()
  ctx.stroke()
  
  // + and - symbols
  ctx.font = '16px Arial'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.fillText('-', -15, -10)
  ctx.fillText('+', -15, 15)
  
  // Input pins
  ctx.beginPath()
  ctx.moveTo(-50, -15)
  ctx.lineTo(-30, -15)
  ctx.moveTo(-50, 15)
  ctx.lineTo(-30, 15)
  ctx.stroke()
  
  // Output pin
  ctx.beginPath()
  ctx.moveTo(30, 0)
  ctx.lineTo(50, 0)
  ctx.stroke()
  
  // Draw pins
  ctx.fillStyle = '#00ff00'
  ctx.beginPath()
  ctx.arc(-50, -15, 3, 0, Math.PI * 2)
  ctx.arc(-50, 15, 3, 0, Math.PI * 2)
  ctx.arc(50, 0, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawGround(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  
  ctx.beginPath()
  ctx.moveTo(0, -20)
  ctx.lineTo(0, 0)
  ctx.moveTo(-15, 0)
  ctx.lineTo(15, 0)
  ctx.moveTo(-10, 5)
  ctx.lineTo(10, 5)
  ctx.moveTo(-5, 10)
  ctx.lineTo(5, 10)
  ctx.stroke()
  
  // Draw pin
  ctx.fillStyle = '#00ff00'
  ctx.beginPath()
  ctx.arc(0, -20, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawVoltageSource(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  
  // Circle
  ctx.beginPath()
  ctx.arc(0, 0, 20, 0, Math.PI * 2)
  ctx.stroke()
  
  // + and - symbols
  ctx.font = '16px Arial'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.fillText('+', 0, -5)
  ctx.fillText('-', 0, 12)
  
  // Pins
  ctx.beginPath()
  ctx.moveTo(0, -20)
  ctx.lineTo(0, -40)
  ctx.moveTo(0, 20)
  ctx.lineTo(0, 40)
  ctx.stroke()
  
  // Draw pins
  ctx.fillStyle = '#00ff00'
  ctx.beginPath()
  ctx.arc(0, -40, 3, 0, Math.PI * 2)
  ctx.arc(0, 40, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawANDGate(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  
  ctx.beginPath()
  ctx.moveTo(-30, -20)
  ctx.lineTo(-10, -20)
  ctx.arc(-10, 0, 20, -Math.PI/2, Math.PI/2)
  ctx.lineTo(-30, 20)
  ctx.closePath()
  ctx.stroke()
  
  // Input pins
  ctx.beginPath()
  ctx.moveTo(-50, -10)
  ctx.lineTo(-30, -10)
  ctx.moveTo(-50, 10)
  ctx.lineTo(-30, 10)
  ctx.stroke()
  
  // Output pin
  ctx.beginPath()
  ctx.moveTo(10, 0)
  ctx.lineTo(30, 0)
  ctx.stroke()
  
  // Draw pins
  ctx.fillStyle = '#00ff00'
  ctx.beginPath()
  ctx.arc(-50, -10, 3, 0, Math.PI * 2)
  ctx.arc(-50, 10, 3, 0, Math.PI * 2)
  ctx.arc(30, 0, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawORGate(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  
  ctx.beginPath()
  ctx.arc(-40, 0, 25, -Math.PI/3, Math.PI/3)
  ctx.quadraticCurveTo(0, 20, 10, 0)
  ctx.quadraticCurveTo(0, -20, -26, -15)
  ctx.stroke()
  
  // Input pins
  ctx.beginPath()
  ctx.moveTo(-50, -10)
  ctx.lineTo(-35, -10)
  ctx.moveTo(-50, 10)
  ctx.lineTo(-35, 10)
  ctx.stroke()
  
  // Output pin
  ctx.beginPath()
  ctx.moveTo(10, 0)
  ctx.lineTo(30, 0)
  ctx.stroke()
  
  // Draw pins
  ctx.fillStyle = '#00ff00'
  ctx.beginPath()
  ctx.arc(-50, -10, 3, 0, Math.PI * 2)
  ctx.arc(-50, 10, 3, 0, Math.PI * 2)
  ctx.arc(30, 0, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawGenericComponent(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = 'rgba(100, 100, 255, 0.3)'
  ctx.lineWidth = 2
  
  ctx.beginPath()
  ctx.rect(-20, -20, 40, 40)
  ctx.fill()
  ctx.stroke()
  
  // Draw pins
  ctx.fillStyle = '#00ff00'
  ctx.beginPath()
  ctx.arc(-20, 0, 3, 0, Math.PI * 2)
  ctx.arc(20, 0, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string) {
  ctx.fillStyle = '#ffff00'
  ctx.font = '14px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 0)
  
  // Draw bounding box for selection
  const metrics = ctx.measureText(text)
  ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)'
  ctx.lineWidth = 1
  ctx.strokeRect(-metrics.width / 2 - 5, -10, metrics.width + 10, 20)
}

function drawJunction(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#00ff00'
  ctx.beginPath()
  ctx.arc(0, 0, 6, 0, Math.PI * 2)
  ctx.fill()
}

function drawCustomComponent(ctx: CanvasRenderingContext2D, customComp: any) {
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = 'rgba(100, 100, 255, 0.3)'
  ctx.lineWidth = 2
  
  // Draw shapes
  customComp.shapes.forEach((shape: any) => {
    if (shape.type === 'line') {
      ctx.beginPath()
      // Translate from canvas coords to centered coords
      const startX = shape.start.x - 250
      const startY = shape.start.y - 250
      const endX = shape.end.x - 250
      const endY = shape.end.y - 250
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
    } else if (shape.type === 'rectangle') {
      const x = shape.x - 250
      const y = shape.y - 250
      ctx.strokeRect(x, y, shape.width, shape.height)
    } else if (shape.type === 'circle') {
      const x = shape.x - 250
      const y = shape.y - 250
      ctx.beginPath()
      ctx.arc(x, y, shape.radius, 0, Math.PI * 2)
      ctx.stroke()
    }
  })
  
  // Draw pins
  ctx.fillStyle = '#00ff00'
  customComp.pins.forEach((pin: any) => {
    const x = pin.position.x - 250
    const y = pin.position.y - 250
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawKicadComponent(ctx: CanvasRenderingContext2D, kicadComp: LibraryComponent) {
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = 'rgba(100, 100, 255, 0.2)'
  ctx.lineWidth = 2
  
  // Scale factor for KiCad coordinates (KiCad uses larger units)
  const scale = 1.5
  
  // Calculate bounding box from shapes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  
  kicadComp.shapes.forEach((shape: any) => {
    if (shape.type === 'rect') {
      minX = Math.min(minX, shape.x * scale)
      minY = Math.min(minY, shape.y * scale)
      maxX = Math.max(maxX, (shape.x + shape.width) * scale)
      maxY = Math.max(maxY, (shape.y + shape.height) * scale)
    } else if (shape.type === 'circle') {
      minX = Math.min(minX, (shape.cx - shape.r) * scale)
      minY = Math.min(minY, (shape.cy - shape.r) * scale)
      maxX = Math.max(maxX, (shape.cx + shape.r) * scale)
      maxY = Math.max(maxY, (shape.cy + shape.r) * scale)
    } else if (shape.type === 'polyline' && shape.points) {
      shape.points.forEach((p: Point) => {
        minX = Math.min(minX, p.x * scale)
        minY = Math.min(minY, p.y * scale)
        maxX = Math.max(maxX, p.x * scale)
        maxY = Math.max(maxY, p.y * scale)
      })
    }
  })
  
  // Also consider pin positions for bounding box
  kicadComp.pins.forEach((pin: any) => {
    minX = Math.min(minX, pin.position.x * scale)
    minY = Math.min(minY, pin.position.y * scale)
    maxX = Math.max(maxX, pin.position.x * scale)
    maxY = Math.max(maxY, pin.position.y * scale)
  })
  
  // Calculate center offset
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  
  // Draw shapes
  kicadComp.shapes.forEach((shape: any) => {
    ctx.strokeStyle = '#ffffff'
    ctx.fillStyle = shape.fill ? 'rgba(100, 100, 255, 0.3)' : 'transparent'
    ctx.lineWidth = (shape.strokeWidth || 1) * 1.5
    
    if (shape.type === 'rect') {
      const x = shape.x * scale - centerX
      const y = shape.y * scale - centerY
      const w = shape.width * scale
      const h = shape.height * scale
      
      ctx.beginPath()
      ctx.rect(x, y, w, h)
      if (shape.fill) ctx.fill()
      ctx.stroke()
    } else if (shape.type === 'circle') {
      const cx = shape.cx * scale - centerX
      const cy = shape.cy * scale - centerY
      const r = shape.r * scale
      
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      if (shape.fill) ctx.fill()
      ctx.stroke()
    } else if (shape.type === 'polyline' && shape.points && shape.points.length > 0) {
      ctx.beginPath()
      const firstPoint = shape.points[0]
      ctx.moveTo(firstPoint.x * scale - centerX, firstPoint.y * scale - centerY)
      
      for (let i = 1; i < shape.points.length; i++) {
        const p = shape.points[i]
        ctx.lineTo(p.x * scale - centerX, p.y * scale - centerY)
      }
      
      if (shape.fill) {
        ctx.closePath()
        ctx.fill()
      }
      ctx.stroke()
    } else if (shape.type === 'arc') {
      // Handle arc drawing
      if (shape.points && shape.points.length >= 3) {
        // KiCad 6+ arc format with start, mid, end points
        const start = shape.points[0]
        const mid = shape.points[1]
        const end = shape.points[2]
        
        ctx.beginPath()
        ctx.moveTo(start.x * scale - centerX, start.y * scale - centerY)
        ctx.quadraticCurveTo(
          mid.x * scale - centerX, 
          mid.y * scale - centerY,
          end.x * scale - centerX, 
          end.y * scale - centerY
        )
        ctx.stroke()
      } else if (shape.cx !== undefined) {
        // Old format with center, radius, angles
        const cx = shape.cx * scale - centerX
        const cy = shape.cy * scale - centerY
        const r = shape.r * scale
        const startAngle = (shape.startAngle || 0) * Math.PI / 180
        const endAngle = (shape.endAngle || 360) * Math.PI / 180
        
        ctx.beginPath()
        ctx.arc(cx, cy, r, startAngle, endAngle)
        ctx.stroke()
      }
    } else if (shape.type === 'text') {
      ctx.fillStyle = '#aaaaaa'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(shape.text || '', shape.x * scale - centerX, shape.y * scale - centerY)
    }
  })
  
  // Draw pins
  ctx.fillStyle = '#00ff00'
  ctx.strokeStyle = '#00ff00'
  ctx.lineWidth = 1
  
  kicadComp.pins.forEach((pin: any) => {
    const x = pin.position.x * scale - centerX
    const y = pin.position.y * scale - centerY
    
    // Draw pin circle
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
    
    // Draw pin name
    ctx.fillStyle = '#88ff88'
    ctx.font = '8px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    if (pin.name && pin.name !== '~') {
      ctx.fillText(pin.name, x, y - 6)
    }
    
    // Draw pin number
    ctx.fillStyle = '#ffff88'
    ctx.textBaseline = 'top'
    ctx.fillText(pin.number, x, y + 6)
    
    ctx.fillStyle = '#00ff00'
  })
  
  // Draw component name in center if no shapes
  if (kicadComp.shapes.length === 0) {
    ctx.fillStyle = 'rgba(100, 100, 255, 0.3)'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.rect(-30, -20, 60, 40)
    ctx.fill()
    ctx.stroke()
    
    ctx.fillStyle = '#ffffff'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(kicadComp.name, 0, 0)
  }
}

