import { X } from 'lucide-react'

interface HelpPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function HelpPanel({ isOpen, onClose }: HelpPanelProps) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center text-white z-50">
      <div className="bg-dark-panel border border-border-color rounded-lg w-[600px] max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-dark-panel border-b border-border-color p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Справка</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-hover rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-3 text-blue-400">Инструменты</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Выбор объектов</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">V</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Рисование проводов</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">W</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Перемещение</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">M</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Поворот</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">R</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Метка</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">L</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Узел соединения</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">J</kbd>
              </div>
            </div>
          </section>
          
          <section>
            <h3 className="text-lg font-semibold mb-3 text-blue-400">Работа с объектами</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Удалить выбранное</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">Delete</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Повернуть выбранное на 90°</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">R</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Отменить действие</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">Escape</kbd>
              </div>
            </div>
          </section>
          
          <section>
            <h3 className="text-lg font-semibold mb-3 text-blue-400">Навигация</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Панорамирование</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">Средняя кнопка мыши</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Масштабирование</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">Колесо мыши</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Увеличить</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">Ctrl + +</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Уменьшить</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">Ctrl + -</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Сбросить масштаб</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">Ctrl + 0</kbd>
              </div>
            </div>
          </section>
          
          <section>
            <h3 className="text-lg font-semibold mb-3 text-blue-400">Вид</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Переключить сетку</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">Ctrl + G</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Переключить привязку</span>
                <kbd className="px-2 py-1 bg-dark-bg rounded text-xs">Ctrl + Shift + G</kbd>
              </div>
            </div>
          </section>
          
          <section>
            <h3 className="text-lg font-semibold mb-3 text-blue-400">Размещение компонентов</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>1. Выберите компонент из библиотеки слева</p>
              <p>2. Кликните на canvas для размещения</p>
              <p>3. Нажмите ESC для отмены размещения</p>
              <p>4. Используйте клавишу R для поворота выбранного компонента</p>
            </div>
          </section>
          
          <section>
            <h3 className="text-lg font-semibold mb-3 text-blue-400">Рисование проводов</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>1. Нажмите W или выберите инструмент "Провод"</p>
              <p>2. Кликните для начала провода</p>
              <p>3. Кликните для добавления точек</p>
              <p>4. Нажмите Enter для завершения или ESC для отмены</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

