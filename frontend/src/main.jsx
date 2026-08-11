import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const savedTheme = localStorage.getItem('chat:theme') || 'dark'
const savedLocale = localStorage.getItem('chat:locale') || 'tr'
document.documentElement.dataset.theme = savedTheme
document.documentElement.lang = savedLocale

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
