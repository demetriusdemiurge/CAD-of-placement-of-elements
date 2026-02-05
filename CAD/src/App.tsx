import { useState } from 'react'
import Header from './components/Header'
import Toolbar from './components/Toolbar'
import PCBToolbar from './components/PCBToolbar'
import ComponentLibrary from './components/ComponentLibrary'
import FootprintLibrary from './components/FootprintLibrary'
import SchematicCanvas from './components/SchematicCanvas'
import PCBCanvas from './components/PCBCanvas'
import PropertiesPanel from './components/PropertiesPanel'
import PCBPropertiesPanel from './components/PCBPropertiesPanel'
import LayerManager from './components/LayerManager'
import StatusBar from './components/StatusBar'
import WelcomeScreen from './components/WelcomeScreen'
import HelpPanel from './components/HelpPanel'
import { useStore } from './store/useStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

function App() {
  const { activeMode, setActiveMode } = useStore()
  const [showWelcome, setShowWelcome] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  
  useKeyboardShortcuts()

  const isPCBMode = activeMode === 'pcb'

  return (
    <>
    <div className="flex flex-col h-screen bg-dark-bg text-white">
      <Header />
      
      {/* Mode Switcher */}
      <div className="flex bg-dark-panel border-b border-border-color">
        <button
          onClick={() => setActiveMode('schematic')}
          className={`px-6 py-2 text-sm font-medium transition-colors ${
            activeMode === 'schematic'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-dark-hover'
          }`}
        >
          📐 Схема
        </button>
        <button
          onClick={() => setActiveMode('pcb')}
          className={`px-6 py-2 text-sm font-medium transition-colors ${
            activeMode === 'pcb'
              ? 'bg-green-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-dark-hover'
          }`}
        >
          🔲 Плата (PCB)
        </button>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Toolbar */}
        {isPCBMode ? <PCBToolbar /> : <Toolbar />}
        
        {/* Component/Footprint Library */}
        <div className="w-64 bg-dark-panel border-r border-border-color flex flex-col">
          {isPCBMode ? <FootprintLibrary /> : <ComponentLibrary />}
        </div>
        
        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col">
          {isPCBMode ? <PCBCanvas /> : <SchematicCanvas />}
        </div>
        
        {/* Right Sidebar */}
        <div className="w-80 bg-dark-panel border-l border-border-color flex flex-col">
          {isPCBMode ? (
            <PCBPropertiesPanel />
          ) : (
            <>
              <PropertiesPanel />
              <LayerManager />
            </>
          )}
        </div>
      </div>
      
      <StatusBar />
    </div>
    
    {showWelcome && (
      <WelcomeScreen
        onClose={() => setShowWelcome(false)}
        onNewProject={() => setShowWelcome(false)}
        onOpenProject={() => setShowWelcome(false)}
      />
    )}
    
    <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} />
    
    {/* Help button */}
    <button
      onClick={() => setShowHelp(true)}
      className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-lg transition-all z-40"
      title="Справка"
    >
      <span className="text-xl font-bold">?</span>
    </button>
    </>
  )
}

export default App

