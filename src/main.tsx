import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

import { initTheme } from './lib/theme'

initTheme()   // light / dark / match device, chosen in the header or Settings

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
