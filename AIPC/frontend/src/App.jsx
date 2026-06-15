import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import AppLayout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Models from './pages/Models'
import TestSuites from './pages/TestSuites'
import PromptTemplates from './pages/PromptTemplates'
import CreateJob from './pages/CreateJob'
import JobDetail from './pages/JobDetail'
import Leaderboard from './pages/Leaderboard'
import OfflineJudge from './pages/OfflineJudge'
import OfflineJobDetail from './pages/OfflineJobDetail'
import ModelChat from './pages/ModelChat'
import About from './pages/About'
import { ThemeProvider, useTheme } from './ThemeContext'

function AppContent() {
    const { isDarkMode } = useTheme();

    return (
        <ConfigProvider
            locale={zhCN}
            theme={{
                algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
                token: {
                    colorPrimary: '#6C5CE7',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    colorLink: '#a29bfe',
                    colorSuccess: '#00cec9',
                    colorWarning: '#fdcb6e',
                    colorError: '#ff7675',
                    colorInfo: '#74b9ff',
                    borderRadius: 12,
                    ...(isDarkMode ? {
                        colorBgContainer: '#1a1a2e',
                        colorBgElevated: '#16213e',
                        colorBgLayout: '#0f0f23',
                    } : {})
                },
                components: {
                    Menu: isDarkMode ? {
                        darkItemBg: 'transparent',
                        darkSubMenuItemBg: 'transparent',
                        darkItemSelectedBg: 'rgba(108, 92, 231, 0.2)',
                    } : {},
                    Card: isDarkMode ? {
                        colorBgContainer: '#16213e',
                    } : {},
                    Table: isDarkMode ? {
                        colorBgContainer: '#16213e',
                        headerBg: '#1a1a3e',
                    } : {},
                    Modal: isDarkMode ? {
                        contentBg: '#16213e',
                        headerBg: '#16213e',
                    } : {},
                },
            }}
        >
            <Routes>
                <Route path="/" element={<AppLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="models" element={<Models />} />
                    <Route path="test-suites" element={<TestSuites />} />
                    <Route path="prompt-templates" element={<PromptTemplates />} />
                    <Route path="jobs/create" element={<CreateJob />} />
                    <Route path="jobs/:id" element={<JobDetail />} />
                    <Route path="offline-judge" element={<OfflineJudge />} />
                    <Route path="offline-jobs/:id" element={<OfflineJobDetail />} />
                    <Route path="leaderboard" element={<Leaderboard />} />
                    <Route path="chat" element={<ModelChat />} />
                    <Route path="about" element={<About />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </ConfigProvider>
    )
}

export default function App() {
    return (
        <ThemeProvider>
            <AppContent />
        </ThemeProvider>
    )
}
