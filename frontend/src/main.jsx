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
import { AuthProvider } from './contexts/AuthContext.jsx'
import FeaturePage from './components/FeaturePage.jsx'
import AdminDashboard from './components/AdminDashboard.jsx'
import AuthPage from './components/AuthPage.jsx'

// 获取初始语言
const initialLanguage = getCurrentLanguage()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider initialLanguage={initialLanguage}>
        <NotificationProvider>
          <AuthProvider>
            <AudioProvider>
              <Routes>
                {/* 根路径 - 将重定向到带语言前缀的路径 */}
                <Route path="/" element={<LanguageRouter><App /></LanguageRouter>} />

                {/* 登录/注册 */}
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/login" element={<AuthPage initialMode="login" />} />
                <Route path="/register" element={<AuthPage initialMode="register" />} />

                {/* 管理页 */}
                <Route path="/admin" element={<AdminDashboard />} />
                 
                {/* 产品功能页面 */}
                <Route path="/:lang/feature" element={<LanguageRouter><FeaturePage /></LanguageRouter>} />
                <Route path="/:lang/auth" element={<LanguageRouter><AuthPage /></LanguageRouter>} />
                <Route path="/:lang/login" element={<LanguageRouter><AuthPage initialMode="login" /></LanguageRouter>} />
                <Route path="/:lang/register" element={<LanguageRouter><AuthPage initialMode="register" /></LanguageRouter>} />

                {/* 带语言前缀的路径 */}
                <Route path="/:lang/*" element={<LanguageRouter><App /></LanguageRouter>} />
              </Routes>
            </AudioProvider>
          </AuthProvider>
        </NotificationProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)
