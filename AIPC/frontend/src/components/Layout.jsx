import React, { useState, useEffect } from 'react'
import { Layout, Menu, Button, Drawer } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
    DashboardOutlined,
    RobotOutlined,
    DatabaseOutlined,
    FileTextOutlined,
    ExperimentOutlined,
    TrophyOutlined,
    ThunderboltOutlined,
    BulbOutlined,
    BulbFilled,
    InfoCircleOutlined,
    CheckCircleOutlined,
    MessageOutlined,
    MenuOutlined
} from '@ant-design/icons'
import { Modal, Tooltip } from 'antd'
import { useTheme } from '../ThemeContext'
import HelpDocs from './HelpDocs'


const { Sider, Header, Content } = Layout

const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: '/models', icon: <RobotOutlined />, label: '模型管理' },
    { key: '/test-suites', icon: <DatabaseOutlined />, label: '测试集管理' },
    { key: '/prompt-templates', icon: <FileTextOutlined />, label: 'Prompt模板' },
    { key: '/jobs/create', icon: <ExperimentOutlined />, label: '创建评测' },
    { key: '/offline-judge', icon: <CheckCircleOutlined />, label: 'AI 裁判打分' },
    { key: '/leaderboard', icon: <TrophyOutlined />, label: '排行榜' },
    { key: '/chat', icon: <MessageOutlined />, label: '模型体验' },
    { key: '/about', icon: <InfoCircleOutlined />, label: '关于系统' },
]

const pageTitles = {
    '/': '仪表盘',
    '/models': '模型管理',
    '/test-suites': '测试集管理',
    '/prompt-templates': 'Prompt模板管理',
    '/jobs/create': '创建评测任务',
    '/offline-judge': 'AI 裁判打分 (离线)',
    '/leaderboard': '排行榜',
    '/chat': '模型体验广场 (Playground)',
    '/about': '关于 AIPC 评测系统',
}

export default function AppLayout() {
    const navigate = useNavigate()
    const location = useLocation()
    const [collapsed, setCollapsed] = useState(false)
    const [helpVisible, setHelpVisible] = useState(false)
    const { isDarkMode, toggleTheme } = useTheme()

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])


    const currentPath = location.pathname
    const isJobDetail = currentPath.startsWith('/jobs/') && currentPath !== '/jobs/create'
    const isOfflineJobDetail = currentPath.startsWith('/offline-jobs/')
    const pageTitle = isJobDetail ? '任务详情' : (isOfflineJobDetail ? '离线判卷详情' : (pageTitles[currentPath] || 'AIPC'))

    return (
        <Layout className="app-layout" style={{ minHeight: '100vh' }}>
            {!isMobile && (
                <Sider
                    className="app-sider"
                    collapsible
                    collapsed={collapsed}
                    onCollapse={setCollapsed}
                    width={240}
                    theme={isDarkMode ? "dark" : "light"}
                    style={{
                        position: 'fixed',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        zIndex: 100,
                        overflow: 'auto',
                    }}
                >
                    <div className="logo-container">
                        <div className="logo-icon">
                            <ThunderboltOutlined />
                        </div>
                        {!collapsed && <span className="logo-text">AIPC</span>}
                    </div>
                    <Menu
                        theme={isDarkMode ? "dark" : "light"}
                        mode="inline"
                        selectedKeys={[isJobDetail ? '/jobs/create' : (isOfflineJobDetail ? '/offline-judge' : currentPath)]}
                        items={menuItems}
                        onClick={({ key }) => navigate(key)}
                        style={{ borderRight: 0 }}
                    />
                </Sider>
            )}

            <Drawer
                title={
                    <div className="logo-container" style={{ padding: 0, border: 'none', marginBottom: 0 }}>
                        <div className="logo-icon">
                            <ThunderboltOutlined />
                        </div>
                        <span className="logo-text">AIPC</span>
                    </div>
                }
                placement="left"
                onClose={() => setMobileMenuOpen(false)}
                open={mobileMenuOpen}
                styles={{ body: { padding: 0 }, header: { background: isDarkMode ? '#16213e' : '#fff', borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` } }}
                width={240}
                style={{ background: isDarkMode ? '#1a1a2e' : '#f0f2f5' }}
            >
                <Menu
                    theme={isDarkMode ? "dark" : "light"}
                    mode="inline"
                    selectedKeys={[isJobDetail ? '/jobs/create' : (isOfflineJobDetail ? '/offline-judge' : currentPath)]}
                    items={menuItems}
                    onClick={({ key }) => { navigate(key); setMobileMenuOpen(false); }}
                    style={{ borderRight: 0, background: 'transparent' }}
                />
            </Drawer>

            <Layout style={{ marginLeft: isMobile ? 0 : (collapsed ? 80 : 240), transition: 'margin-left 0.2s', width: isMobile ? '100%' : 'auto' }}>
                <Header className="app-header" style={{ padding: isMobile ? '0 16px' : '0 24px', display: 'flex', alignItems: 'center' }}>
                    {isMobile && (
                        <Button
                            type="text"
                            icon={<MenuOutlined />}
                            onClick={() => setMobileMenuOpen(true)}
                            style={{ fontSize: '18px', marginRight: '16px', color: 'var(--text-primary)', padding: '0 8px' }}
                        />
                    )}
                    <h1 className="header-title" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: isMobile ? '16px' : '20px', margin: 0 }}>{pageTitle}</h1>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!isMobile && (
                            <div
                                onClick={() => window.open('http://39.106.4.251/aboutMe', '_blank')}
                                style={{
                                    fontSize: '13px',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    opacity: 0.8,
                                    transition: 'all 0.3s',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.opacity = 1;
                                    e.currentTarget.style.color = 'var(--primary)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.opacity = 0.8;
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                }}
                            >
                                制作者：田长金（Tavian）
                            </div>
                        )}
                        <Tooltip title="帮助与文档">
                            <Button
                                type="text"
                                icon={<InfoCircleOutlined />}
                                onClick={() => setHelpVisible(true)}
                                style={{ fontSize: '18px', color: 'var(--text-secondary)' }}
                            />
                        </Tooltip>
                        <Tooltip title={isDarkMode ? "切换亮色模式" : "切换暗色模式"}>
                            <Button
                                type="text"
                                icon={isDarkMode ? <BulbFilled /> : <BulbOutlined />}
                                onClick={toggleTheme}
                                style={{ fontSize: '18px', color: 'var(--text-primary)' }}
                            />
                        </Tooltip>
                    </div>
                </Header>
                <Modal
                    title={null}
                    open={helpVisible}
                    onCancel={() => setHelpVisible(false)}
                    footer={null}
                    width={1000}
                    centered
                    styles={{ body: { padding: '24px 12px' } }}
                    destroyOnHidden
                >
                    <HelpDocs />
                </Modal>

                <Content className="app-content">
                    <div className="fade-in">
                        <Outlet />
                    </div>
                </Content>
            </Layout>
        </Layout>
    )
}
