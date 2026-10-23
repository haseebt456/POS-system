import React from 'react'
import App from './App.jsx'
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'

// Tokens must load before base — base's rules reference the custom properties.
import './styles/tokens.css'
import './styles/base.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)