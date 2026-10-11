import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { ThemeProvider } from './lib/theme'
import { ImageProvider } from './lib/images'
import { BackendProvider } from './lib/backend'
import { AuthProvider } from './lib/auth'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BackendProvider>
        <ImageProvider>
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </ImageProvider>
      </BackendProvider>
    </ThemeProvider>
  </StrictMode>,
)
