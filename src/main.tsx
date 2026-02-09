import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './lib/pushNotifications.ts'

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
    registerServiceWorker().catch(err => console.error('SW registration failed:', err))
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
