import { FileText, FolderOpen, BookOpen, Zap } from 'lucide-react'

interface WelcomeScreenProps {
  onClose: () => void
  onNewProject: () => void
  onOpenProject: () => void
}

export default function WelcomeScreen({ onClose, onNewProject, onOpenProject }: WelcomeScreenProps) {
  return (
    <div className="fixed inset-0 bg-dark-bg/95 flex items-center justify-center z-50">
      <div className="max-w-2xl w-full mx-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Zap size={48} className="text-blue-500" />
            <h1 className="text-4xl font-bold text-white">KiCad Analog</h1>
          </div>
          <p className="text-gray-400 text-lg">
            Современный схемотехнический редактор
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-white">
          <button
            onClick={onNewProject}
            className="bg-dark-panel hover:bg-dark-hover border border-border-color rounded-lg p-6 transition-all hover:border-blue-500 group"
          >
            <FileText size={32} className="mx-auto mb-3 text-blue-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold mb-2">Новый проект</h3>
            <p className="text-sm text-gray-400">Создать новую схему с нуля</p>
          </button>
          
          <button
            onClick={onOpenProject}
            className="bg-dark-panel hover:bg-dark-hover border border-border-color rounded-lg p-6 transition-all hover:border-blue-500 group"
          >
            <FolderOpen size={32} className="mx-auto mb-3 text-green-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold mb-2">Открыть проект</h3>
            <p className="text-sm text-gray-400">Загрузить существующую схему</p>
          </button>
          
          <button
            onClick={onClose}
            className="bg-dark-panel hover:bg-dark-hover border border-border-color rounded-lg p-6 transition-all hover:border-blue-500 group"
          >
            <BookOpen size={32} className="mx-auto mb-3 text-purple-500 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold mb-2">Начать работу</h3>
            <p className="text-sm text-gray-400">Перейти к редактору</p>
          </button>
        </div>
        
        <div className="bg-dark-panel border border-border-color rounded-lg p-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-white">
            <Zap size={20} className="text-blue-500" />
            Быстрый старт
          </h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">•</span>
              <span>Выберите компонент из библиотеки слева и кликните на canvas для размещения</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">•</span>
              <span>Используйте инструмент "Провод" (W) для соединения компонентов</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">•</span>
              <span>Нажмите среднюю кнопку мыши для панорамирования, колесико для масштабирования</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">•</span>
              <span>Используйте горячие клавиши для быстрого доступа к инструментам</span>
            </li>
          </ul>
        </div>
        
        <div className="text-center mt-6">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-white transition-colors"
          >
            Больше не показывать
          </button>
        </div>
      </div>
    </div>
  )
}

