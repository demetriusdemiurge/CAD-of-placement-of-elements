import { useEffect } from 'react'
import { useStore } from '../store/useStore'

export function useKeyboardShortcuts() {
  const {
    setActiveTool,
    selectedObjects,
    components,
    removeComponent,
    updateComponent,
    toggleGrid,
    toggleSnapToGrid,
    setZoom,
    zoom,
    undo,
    redo,
    copy,
    paste,
  } = useStore()
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      // Tool shortcuts
      if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select')
      } else if (e.key === 'w' || e.key === 'W') {
        setActiveTool('wire')
      } else if (e.key === 'm' || e.key === 'M') {
        setActiveTool('move')
      } else if (e.key === 'r' || e.key === 'R') {
        // Rotate selected components
        if (selectedObjects.length > 0) {
          selectedObjects.forEach(id => {
            const component = components.find(c => c.id === id)
            if (component) {
              updateComponent(id, {
                rotation: (component.rotation + 90) % 360
              })
            }
          })
        } else {
          setActiveTool('rotate')
        }
      } else if (e.key === 'l' || e.key === 'L') {
        setActiveTool('label')
      } else if (e.key === 'j' || e.key === 'J') {
        setActiveTool('junction')
      }
      
      // Delete - только если не в canvas (canvas сам обрабатывает)
      // Удалено, т.к. обрабатывается в SchematicCanvas
      
      // Undo/Redo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      
      if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
      
      // Copy/Paste
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault()
        copy()
      }
      
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault()
        paste()
      }
      
      // Grid shortcuts
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault()
        toggleGrid()
      }
      
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault()
        toggleSnapToGrid()
      }
      
      // Zoom shortcuts
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        setZoom(zoom * 1.2)
      }
      
      if (e.ctrlKey && (e.key === '-' || e.key === '_')) {
        e.preventDefault()
        setZoom(zoom / 1.2)
      }
      
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault()
        setZoom(1)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    setActiveTool,
    selectedObjects,
    components,
    removeComponent,
    updateComponent,
    toggleGrid,
    toggleSnapToGrid,
    setZoom,
    zoom,
    undo,
    redo,
    copy,
    paste,
  ])
}

