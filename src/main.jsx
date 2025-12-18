import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Use HashRouter for GitHub Pages to avoid 404s on refresh if SPA fallback isn't configured,
// BUT standard practice involves a 404.html hack. 
// However, considering the user might not want complex hacks, HashRouter is safer for GH Pages.
// BUT I configured 'base' so Browser Router should work if we handle 404s.
// Let's stick to BrowserRouter but use the basename from vite config if needed.
// Actually, with GH Pages, HashRouter is the robust "it just works" solution for sub-directories without server config.
// The user asked for professional. Browser Router is more professional URL-wise.
// I will use BrowserRouter with the basename.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/oltest/">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
