import { 
  FileText, Save, FolderOpen, Settings, 
  Undo, Redo, Copy, Clipboard, Trash2 
} from 'lucide-react'
import MenuBar from './MenuBar'
import { useStore } from '../store/useStore'

export default function Header() {
  const { 
    undo, 
    redo, 
    copy, 
    paste, 
    selectedObjects, 
    removeComponent,
    history,
    historyIndex 
  } = useStore()
  
  const handleDelete = () => {
    selectedObjects.forEach(id => {
      removeComponent(id)
    })
  }
  
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1
  
  return (
    <header className="h-12 bg-dark-panel border-b border-border-color flex items-center px-4 gap-2">
      <div className="flex items-center gap-2 mr-4">
        <div className="text-xl font-bold text-blue-500">⚡</div>
        <span className="font-semibold text-lg">KiCad Analog</span>
      </div>
      
      <MenuBar />
      
      <div className="w-px h-6 bg-border-color mx-2" />
      
      <div className="flex items-center gap-1">
        <button className="p-2 hover:bg-dark-hover rounded transition-colors" title="Новый проект">
          <FileText size={18} />
        </button>
        <button className="p-2 hover:bg-dark-hover rounded transition-colors" title="Открыть">
          <FolderOpen size={18} />
        </button>
        <button className="p-2 hover:bg-dark-hover rounded transition-colors" title="Сохранить">
          <Save size={18} />
        </button>
      </div>
      
      <div className="w-px h-6 bg-border-color mx-2" />
      
      <div className="flex items-center gap-1">
        <button 
          onClick={undo}
          disabled={!canUndo}
          className={`p-2 rounded transition-colors ${
            canUndo ? 'hover:bg-dark-hover' : 'opacity-30 cursor-not-allowed'
          }`} 
          title="Отменить (Ctrl+Z)"
        >
          <Undo size={18} />
        </button>
        <button 
          onClick={redo}
          disabled={!canRedo}
          className={`p-2 rounded transition-colors ${
            canRedo ? 'hover:bg-dark-hover' : 'opacity-30 cursor-not-allowed'
          }`}
          title="Повторить (Ctrl+Y)"
        >
          <Redo size={18} />
        </button>
      </div>
      
      <div className="w-px h-6 bg-border-color mx-2" />
      
      <div className="flex items-center gap-1">
        <button 
          onClick={copy}
          disabled={selectedObjects.length === 0}
          className={`p-2 rounded transition-colors ${
            selectedObjects.length > 0 ? 'hover:bg-dark-hover' : 'opacity-30 cursor-not-allowed'
          }`}
          title="Копировать (Ctrl+C)"
        >
          <Copy size={18} />
        </button>
        <button 
          onClick={paste}
          className="p-2 hover:bg-dark-hover rounded transition-colors" 
          title="Вставить (Ctrl+V)"
        >
          <Clipboard size={18} />
        </button>
        <button 
          onClick={handleDelete}
          disabled={selectedObjects.length === 0}
          className={`p-2 rounded transition-colors ${
            selectedObjects.length > 0 ? 'hover:bg-dark-hover text-red-400' : 'opacity-30 cursor-not-allowed'
          }`}
          title="Удалить (Delete)"
        >
          <Trash2 size={18} />
        </button>
      </div>
      
      <div className="flex-1" />
      
      <button className="p-2 hover:bg-dark-hover rounded transition-colors" title="Настройки">
        <Settings size={18} />
      </button>
    </header>
  )
}

