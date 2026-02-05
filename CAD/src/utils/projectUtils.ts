import { Component, Wire, Layer } from '../store/useStore'

export interface Project {
  name: string
  version: string
  created: string
  modified: string
  components: Component[]
  wires: Wire[]
  layers: Layer[]
}

export function exportProject(
  name: string,
  components: Component[],
  wires: Wire[],
  layers: Layer[]
): void {
  const project: Project = {
    name,
    version: '1.0.0',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    components,
    wires,
    layers,
  }
  
  const json = JSON.stringify(project, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.kicad.json`
  a.click()
  
  URL.revokeObjectURL(url)
}

export function importProject(file: File): Promise<Project> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const project = JSON.parse(e.target?.result as string) as Project
        resolve(project)
      } catch (error) {
        reject(new Error('Ошибка при чтении файла проекта'))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Ошибка при чтении файла'))
    }
    
    reader.readAsText(file)
  })
}

export function exportToSVG(
  components: Component[],
  wires: Wire[]
): void {
  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  
  components.forEach(comp => {
    minX = Math.min(minX, comp.position.x - 50)
    minY = Math.min(minY, comp.position.y - 50)
    maxX = Math.max(maxX, comp.position.x + 50)
    maxY = Math.max(maxY, comp.position.y + 50)
  })
  
  wires.forEach(wire => {
    wire.points.forEach(point => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  })
  
  const width = maxX - minX + 100
  const height = maxY - minY + 100
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX - 50} ${minY - 50} ${width} ${height}">
  <rect width="100%" height="100%" fill="#1e1e1e"/>
`
  
  // Add wires
  wires.forEach(wire => {
    if (wire.points.length >= 2) {
      svg += `  <polyline points="`
      wire.points.forEach(p => {
        svg += `${p.x},${p.y} `
      })
      svg += `" stroke="#00ff00" stroke-width="2" fill="none"/>\n`
    }
  })
  
  // Add components (simplified)
  components.forEach(comp => {
    svg += `  <rect x="${comp.position.x - 20}" y="${comp.position.y - 20}" width="40" height="40" stroke="#ffffff" stroke-width="2" fill="rgba(100, 100, 255, 0.3)"/>\n`
    if (comp.properties.reference) {
      svg += `  <text x="${comp.position.x}" y="${comp.position.y - 25}" text-anchor="middle" fill="#ffff00" font-size="12">${comp.properties.reference}</text>\n`
    }
  })
  
  svg += '</svg>'
  
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = 'schematic.svg'
  a.click()
  
  URL.revokeObjectURL(url)
}

export function exportToPNG(
  canvas: HTMLCanvasElement,
  filename: string = 'schematic.png'
): void {
  canvas.toBlob((blob) => {
    if (!blob) return
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    
    URL.revokeObjectURL(url)
  })
}

