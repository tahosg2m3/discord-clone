import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { applyAccessibilityPreferences, readAccessibilityPreferences } from './utils/accessibilityPreferences.js'

const savedTheme = localStorage.getItem('chat:theme') || 'dark'
const savedLocale = localStorage.getItem('chat:locale') || 'tr'
document.documentElement.dataset.theme = savedTheme
document.documentElement.lang = savedLocale
applyAccessibilityPreferences(readAccessibilityPreferences())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
