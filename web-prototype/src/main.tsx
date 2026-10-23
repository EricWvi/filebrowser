// PROTOTYPE: throwaway UI exploration for the mobile file browser. Not production code.
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './index.css'
import './press'
import { App } from './App'

createRoot(document.getElementById('root')!).render(<App />)
