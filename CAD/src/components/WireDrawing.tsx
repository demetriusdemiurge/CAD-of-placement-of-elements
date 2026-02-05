import { useState, useRef, useEffect } from 'react'
import { useStore, Point } from '../store/useStore'

interface WireDrawingProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
}

export default function WireDrawing({ canvasRef }: WireDrawingProps) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentWire, setCurrentWire] = useState<Point[]>([])
  const { activeTool, addWire, zoom, pan, gridSize, snapToGrid } = useStore()
  
  const getCanvasCoordinates = (e: MouseEvent): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - pan.x) / zoom
    const y = (e.clientY - rect.top - pan.y) / zoom
    
    if (snapToGrid) {
      return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize,
      }
    }
    
    return { x, y }
  }
  
  useEffect(() => {
    if (activeTool !== 'wire') {
      setIsDrawing(false)
      setCurrentWire([])
      return
    }
    
    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return
      
      const pos = getCanvasCoordinates(e)
      
      if (!isDrawing) {
        setIsDrawing(true)
        setCurrentWire([pos])
      } else {
        setCurrentWire(prev => [...prev, pos])
      }
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawing) {
        setIsDrawing(false)
        setCurrentWire([])
      } else if (e.key === 'Enter' && isDrawing && currentWire.length >= 2) {
        addWire({
          id: `wire-${Date.now()}`,
          points: currentWire,
          layer: '1',
        })
        setIsDrawing(false)
        setCurrentWire([])
      }
    }
    
    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener('click', handleClick)
    }
    
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      if (canvas) {
        canvas.removeEventListener('click', handleClick)
      }
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeTool, isDrawing, currentWire, canvasRef, addWire, zoom, pan, gridSize, snapToGrid])
  
  return null
}

