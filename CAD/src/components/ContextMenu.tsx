import { useEffect, useRef } from 'react'
import { Copy, Trash2, RotateCw, Edit, Eye, EyeOff } from 'lucide-react'

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onAction: (action: string) => void
}

export default function ContextMenu({ x, y, onClose, onAction }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])
  
  const menuItems = [
    { icon: Copy, label: 'Копировать', action: 'copy', shortcut: 'Ctrl+C' },
    { icon: Trash2, label: 'Удалить', action: 'delete', shortcut: 'Del' },
    { icon: RotateCw, label: 'Повернуть на 90°', action: 'rotate', shortcut: 'R' },
    { icon: Edit, label: 'Редактировать свойства', action: 'edit', shortcut: 'E' },
    { icon: Eye, label: 'Скрыть', action: 'hide', shortcut: 'H' },
  ]
  
  return (
    <div
      ref={menuRef}
      className="fixed bg-dark-panel border border-border-color rounded-lg shadow-2xl py-2 z-50 min-w-[220px]"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            onAction(item.action)
            onClose()
          }}
          className="w-full px-4 py-2 hover:bg-dark-hover transition-colors flex items-center gap-3 text-sm"
        >
          <item.icon size={16} />
          <span className="flex-1 text-left">{item.label}</span>
          <span className="text-xs text-gray-500">{item.shortcut}</span>
        </button>
      ))}
    </div>
  )
}

