import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { I18nProvider } from './i18n/index.js'
import { LanguageRouter } from './components/LanguageRouter.jsx'
import { getCurrentLanguage } from './i18n/utils.js'
import { AudioProvider } from './contexts/AudioContext.jsx'
import { NotificationProvider } from './contexts/NotificationContext.jsx'

// 获取初始语言
const initialLanguage = getCurrentLanguage()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider initialLanguage={initialLanguage}>
        <NotificationProvider>
          <AudioProvider>
            <Routes>
              {/* 根路径 - 将重定向到带语言前缀的路径 */}
              <Route path="/" element={<LanguageRouter><App /></LanguageRouter>} />
              
              {/* 带语言前缀的路径 */}
              <Route path="/:lang/*" element={<LanguageRouter><App /></LanguageRouter>} />
            </Routes>
          </AudioProvider>
        </NotificationProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)
