# Особенности KiCad Analog

## Архитектура приложения

### Технологический стек
- **React 18** - Современная UI библиотека с hooks
- **TypeScript** - Строгая типизация для надежности кода
- **Vite** - Молниеносная сборка и HMR
- **Tailwind CSS** - Utility-first CSS фреймворк
- **Zustand** - Минималистичный state management
- **HTML5 Canvas** - Высокопроизводительный рендеринг

### Управление состоянием (Zustand)

Приложение использует Zustand для управления глобальным состоянием:

```typescript
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
}
```

## Компоненты приложения

### 1. Header (Шапка)
- Меню Файл/Правка/Вид
- Быстрые действия (отмена, повтор, копирование)
- Настройки

### 2. Toolbar (Панель инструментов)
Вертикальная панель слева с инструментами:
- Select (Выбор) - `V`
- Move (Перемещение) - `M`
- Rotate (Поворот) - `R`
- Wire (Провод) - `W`
- Bus (Шина)
- Label (Метка) - `L`
- Junction (Узел) - `J`
- Delete (Удаление)

### 3. ComponentLibrary (Библиотека компонентов)
Организованная библиотека с категориями:
- Пассивные компоненты
- Активные компоненты
- Цифровые компоненты
- Источники питания
- Соединители

### 4. SchematicCanvas (Основной холст)
HTML5 Canvas с функционалом:
- Зум и панорамирование
- Сетка с настраиваемым размером
- Привязка к сетке
- Размещение компонентов
- Рисование проводов
- Выделение объектов

### 5. PropertiesPanel (Панель свойств)
Редактирование свойств выбранных объектов:
- Обозначение (Reference)
- Значение (Value)
- Позиция (X, Y)
- Поворот (Rotation)

### 6. LayerManager (Менеджер слоев)
Управление слоями схемы:
- Видимость слоя
- Блокировка слоя
- Цвет слоя
- Активный слой

### 7. StatusBar (Строка состояния)
Отображение информации:
- Активный инструмент
- Параметры сетки
- Количество объектов
- Версия приложения

## Функциональность Canvas

### Рендеринг компонентов

Каждый тип компонента отрисовывается специальной функцией:

```typescript
function drawComponent(ctx: CanvasRenderingContext2D, component: Component) {
  // Трансформации (позиция, поворот)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((rotation * Math.PI) / 180)
  
  // Отрисовка в зависимости от типа
  switch (component.type) {
    case 'resistor': drawResistor(ctx); break
    case 'capacitor': drawCapacitor(ctx); break
    // ...
  }
  
  ctx.restore()
}
```

### Система координат

- **World coordinates** - абсолютные координаты на холсте
- **Screen coordinates** - пиксельные координаты экрана
- Преобразование: `worldX = (screenX - panX) / zoom`

### Привязка к сетке

```typescript
if (snapToGrid) {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  }
}
```

## Система компонентов

### Структура компонента

```typescript
interface Component {
  id: string              // Уникальный идентификатор
  type: string            // Тип компонента
  position: Point         // Позиция на холсте
  rotation: number        // Поворот (0, 90, 180, 270)
  properties: {
    reference?: string    // Обозначение (R1, C2, и т.д.)
    value?: string        // Значение (10k, 100nF)
    [key: string]: any    // Дополнительные свойства
  }
  pins: Pin[]            // Контакты для соединения
}
```

### Пины (контакты)

```typescript
interface Pin {
  id: string
  position: Point
  name: string           // Имя контакта (VCC, GND, IN, OUT)
  number: string         // Номер контакта
  type: 'input' | 'output' | 'bidirectional' | 'power'
}
```

## Провода и соединения

### Структура провода

```typescript
interface Wire {
  id: string
  points: Point[]        // Массив точек (полилиния)
  layer: string          // ID слоя
}
```

### Рисование проводов

1. Клик начинает провод
2. Каждый клик добавляет точку
3. Enter завершает провод
4. Escape отменяет

## Экспорт и импорт

### Формат JSON проекта

```json
{
  "name": "my-schematic",
  "version": "1.0.0",
  "created": "2025-11-18T12:00:00.000Z",
  "modified": "2025-11-18T12:00:00.000Z",
  "components": [...],
  "wires": [...],
  "layers": [...]
}
```

### Экспорт в SVG

Генерирует масштабируемую векторную графику:
- Расчет bounding box
- SVG path для проводов
- SVG shapes для компонентов
- Текст для обозначений

### Экспорт в PNG

Конвертирует canvas в растровое изображение:
```typescript
canvas.toBlob((blob) => {
  // Скачивание файла
})
```

## Горячие клавиши

### Система горячих клавиш

Реализована через custom hook `useKeyboardShortcuts`:

```typescript
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Игнорирование в input полях
      if (e.target instanceof HTMLInputElement) return
      
      // Обработка клавиш
      switch (e.key) {
        case 'v': setActiveTool('select'); break
        case 'w': setActiveTool('wire'); break
        // ...
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
```

## Производительность

### Оптимизации Canvas

1. **Debouncing** - ограничение частоты перерисовки
2. **Clipping** - отрисовка только видимой области
3. **Layer caching** - кэширование статичных слоев
4. **RequestAnimationFrame** - плавная анимация

### Оптимизации React

1. **useMemo** для дорогих вычислений
2. **useCallback** для стабильных функций
3. **React.memo** для компонентов
4. **Zustand** вместо Context API (меньше ререндеров)

## Будущие улучшения

### Планируемые функции

1. **Отмена/Повтор (Undo/Redo)**
   - История действий
   - Command pattern

2. **Выделение области**
   - Прямоугольное выделение
   - Множественный выбор

3. **Копирование/Вставка**
   - Clipboard API
   - Буфер обмена компонентов

4. **Автосоединение**
   - Автоматическая трассировка проводов
   - Обнаружение пересечений

5. **DRC (Design Rule Check)**
   - Проверка правил проектирования
   - Обнаружение ошибок

6. **PCB редактор**
   - Переход от схемы к печатной плате
   - Размещение компонентов на плате
   - Трассировка дорожек

7. **3D Viewer**
   - Three.js интеграция
   - 3D модели компонентов

8. **Симуляция**
   - SPICE интеграция
   - Анализ схем

## Отладка

### Debug режим

Включите debug логирование:

```typescript
// В store
if (process.env.NODE_ENV === 'development') {
  console.log('Component added:', component)
}
```

### React DevTools

Используйте React DevTools для:
- Инспекции компонентов
- Профилирования
- Отслеживания обновлений

### Canvas Debug

Отрисовка debug информации:

```typescript
// Показать bounding boxes
ctx.strokeStyle = 'red'
ctx.strokeRect(x - width/2, y - height/2, width, height)

// Показать оси координат
ctx.strokeStyle = 'blue'
ctx.moveTo(0, -1000)
ctx.lineTo(0, 1000)
```

## Лучшие практики

### Работа с координатами

```typescript
// ❌ Плохо
const x = e.clientX
const y = e.clientY

// ✅ Хорошо
const pos = getCanvasCoordinates(e)
```

### Управление состоянием

```typescript
// ❌ Плохо - прямая мутация
components.push(newComponent)

// ✅ Хорошо - иммутабельное обновление
setComponents([...components, newComponent])
```

### Типизация

```typescript
// ❌ Плохо
function drawComponent(ctx: any, component: any)

// ✅ Хорошо
function drawComponent(
  ctx: CanvasRenderingContext2D, 
  component: Component
): void
```

