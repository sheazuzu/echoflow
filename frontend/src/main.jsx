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
import AuthPage from './components/auth/AuthPage.jsx'
import AccountSettingsPage from './components/auth/AccountSettingsPage.jsx'
import UserHistoryPage from './components/history/UserHistoryPage.jsx'
import RequireAuth from './components/auth/RequireAuth.jsx'

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
                <Route path="/" element={<LanguageRouter><RequireAuth><App /></RequireAuth></LanguageRouter>} />
                
                {/* 管理页 */}
                <Route path="/admin" element={<RequireAuth requireAdmin><AdminDashboard /></RequireAuth>} />
                 
                {/* 产品功能页面 */}
                <Route path="/:lang/feature" element={<LanguageRouter><FeaturePage /></LanguageRouter>} />

                <Route path="/:lang/login" element={<LanguageRouter><AuthPage mode="login" /></LanguageRouter>} />
                <Route path="/:lang/register" element={<LanguageRouter><AuthPage mode="register" /></LanguageRouter>} />
                <Route path="/:lang/forgot-password" element={<LanguageRouter><AuthPage mode="forgot" /></LanguageRouter>} />
                <Route path="/:lang/reset-password" element={<LanguageRouter><AuthPage mode="reset" /></LanguageRouter>} />
                <Route path="/:lang/account" element={<LanguageRouter><RequireAuth><AccountSettingsPage /></RequireAuth></LanguageRouter>} />
                <Route path="/:lang/history" element={<LanguageRouter><RequireAuth><UserHistoryPage /></RequireAuth></LanguageRouter>} />

                {/* 带语言前缀的路径 */}
                <Route path="/:lang/*" element={<LanguageRouter><RequireAuth><App /></RequireAuth></LanguageRouter>} />
              </Routes>
            </AudioProvider>
          </AuthProvider>
        </NotificationProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)