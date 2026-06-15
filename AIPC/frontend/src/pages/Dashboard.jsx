import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Tag, Progress, Button, Table, Empty, Statistic, Popconfirm, message, Space } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
    RobotOutlined,
    ExperimentOutlined,
    TrophyOutlined,
    DatabaseOutlined,
    PlusOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    SyncOutlined,
    DeleteOutlined,
} from '@ant-design/icons'

import { getJobs, getModelCount, getJobCount, getLeaderboard, deleteJob } from '../api'
import { useTheme } from '../ThemeContext'

import dayjs from 'dayjs'

const statusConfig = {
    pending: { color: 'default', text: '等待中' },
    running: { color: 'processing', text: '运行中', className: 'status-running' },
    completed: { color: 'success', text: '已完成' },
    failed: { color: 'error', text: '失败' },
    cancelled: { color: 'warning', text: '已取消' },
    paused: { color: 'warning', text: '已暂停' },
}

export default function Dashboard() {
    const { isDarkMode } = useTheme()
    const navigate = useNavigate()
    const [jobs, setJobs] = useState([])
    const [stats, setStats] = useState({ models: 0, jobs: 0, running: 0, completed: 0 })
    const [leaderboard, setLeaderboard] = useState([])
    const [loading, setLoading] = useState(true)



    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            const [jobsRes, modelCountRes, jobCountRes, lbRes] = await Promise.all([
                getJobs({ limit: 6 }).catch(() => ({ data: [] })),
                getModelCount().catch(() => ({ data: { count: 0 } })),
                getJobCount().catch(() => ({ data: { total: 0, running: 0, completed: 0 } })),
                getLeaderboard({ limit: 5 }).catch(() => ({ data: [] })),
            ])
            setJobs(jobsRes.data)
            setStats({
                models: modelCountRes.data.count,
                jobs: jobCountRes.data.total,
                running: jobCountRes.data.running,
                completed: jobCountRes.data.completed,
            })
            setLeaderboard(lbRes.data)
        } catch (e) {
            console.error(e)
        }
        setLoading(false)
    }

    const statCards = [
        { label: '已注册模型', value: stats.models, icon: <RobotOutlined />, color: '#6C5CE7' },
        { label: '评测任务', value: stats.jobs, icon: <ExperimentOutlined />, color: '#00cec9' },
        { label: '运行中', value: stats.running, icon: <SyncOutlined spin={stats.running > 0} />, color: '#fdcb6e' },
        { label: '已完成', value: stats.completed, icon: <CheckCircleOutlined />, color: '#00b894' },
    ]

    const jobColumns = [
        { title: '任务名称', dataIndex: 'name', key: 'name', ellipsis: true },
        {
            title: '状态', dataIndex: 'status', key: 'status',
            render: (s) => {
                const cfg = statusConfig[s] || {}
                return <Tag color={cfg.color} className={cfg.className}>{cfg.text || s}</Tag>
            },
        },
        {
            title: '进度', key: 'progress',
            render: (_, r) => {
                const pct = r.total_cases > 0 ? Math.round(r.processed_cases / r.total_cases * 100) : 0
                return <Progress percent={pct} size="small" strokeColor="#6C5CE7" />
            },
        },
        {
            title: '创建时间', dataIndex: 'created_at', key: 'created_at',
            render: (t) => t ? dayjs(t).format('MM-DD HH:mm') : '-',
        },
        {
            title: '操作', key: 'action',
            render: (_, r) => (
                <Space>
                    <Button type="link" onClick={() => navigate(`/jobs/${r.id}`)}>查看</Button>
                    <Popconfirm title="确定要删除此段评测任务及其所有结果吗？" onConfirm={() => handleDeleteJob(r.id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ]

    const handleDeleteJob = async (id) => {
        try {
            await deleteJob(id)
            message.success('任务已删除')
            loadData() // Refresh list
        } catch (e) {
            message.error('删除任务失败')
        }
    }

    return (
        <div>
            {/* Stats Grid */}
            <div className="dashboard-grid">
                {statCards.map((s, i) => (
                    <Card key={i} className="stat-card" variant="borderless">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div className="stat-value">{s.value}</div>
                                <div className="stat-label">{s.label}</div>
                            </div>
                            <div className="stat-icon" style={{ color: s.color }}>{s.icon}</div>
                        </div>
                    </Card>
                ))}
            </div>

            <Row gutter={20}>
                {/* Recent Jobs */}
                <Col xs={24} lg={16}>
                    <Card
                        className="page-card"
                        title="最近评测任务"
                        extra={
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/jobs/create')}>
                                新建任务
                            </Button>
                        }
                    >
                        {jobs.length > 0 ? (
                            <Table 
                                dataSource={jobs}
                                columns={jobColumns}
                                rowKey="id"
                                pagination={false}
                                size="small"
                            />
                        ) : (
                            <Empty description="暂无评测任务" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                                <Button type="primary" onClick={() => navigate('/jobs/create')}>创建第一个任务</Button>
                            </Empty>
                        )}
                    </Card>
                </Col>

                {/* Leaderboard Preview */}
                <Col xs={24} lg={8}>
                    <Card
                        className="page-card"
                        title={<><TrophyOutlined style={{ color: '#fdcb6e' }} /> 排行榜</>}
                        extra={<Button type="link" onClick={() => navigate('/leaderboard')}>查看全部</Button>}
                    >
                        {leaderboard.length > 0 ? (
                            leaderboard.map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '12px 0', borderBottom: i < leaderboard.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{
                                            width: 28, height: 28, borderRadius: '50%',
                                            background: i === 0 ? '#fdcb6e' : i === 1 ? '#b2bec3' : i === 2 ? '#e17055' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'),
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 13, fontWeight: 700, color: i < 3 ? '#000' : (isDarkMode ? '#fff' : 'rgba(0,0,0,0.45)'),
                                        }}>
                                            {i + 1}
                                        </span>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{item.model_name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.ability_dimension}</div>
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: 700, color: 'var(--accent-light)' }}>
                                        {typeof item.score === 'number' ? item.score.toFixed(2) : '-'}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <Empty description="暂无排行数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    )
}
