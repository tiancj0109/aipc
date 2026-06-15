import { useState, useEffect } from 'react'
import { Card, Table, Segmented, Select, Tag, Button, Space, Typography } from 'antd'
import { TrophyOutlined, MessageOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getLeaderboard, getDimensions } from '../api'

const dimensionMap = {
    'clarity': '清晰度',
    'completeness': '完整性',
    'correctness': '正确性',
}

export default function Leaderboard() {
    const navigate = useNavigate()
    const [data, setData] = useState([])
    const [dimensions, setDimensions] = useState([])
    const [activeDim, setActiveDim] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getDimensions().then(res => {
            const dims = res.data
            setDimensions(dims)
            if (dims.length > 0) {
                setActiveDim(dims[0])
            } else {
                setLoading(false)
            }
        }).catch(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (!activeDim) return
        setLoading(true)
        getLeaderboard({ ability_dimension: activeDim, limit: 100 })
            .then(res => setData(res.data))
            .finally(() => setLoading(false))
    }, [activeDim])

    const columns = [
        {
            title: '排名', key: 'rank', width: 80, align: 'center',
            render: (_, __, i) => {
                const rank = i + 1
                return (
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, borderRadius: '50%',
                        background: rank === 1 ? '#fdcb6e' : rank === 2 ? '#b2bec3' : rank === 3 ? '#e17055' : 'var(--bg-elevated)',
                        color: rank <= 3 ? '#000' : 'var(--text-primary)', fontWeight: 700,
                        border: rank > 3 ? '1px solid var(--border)' : 'none'
                    }}>
                        {rank}
                    </div>
                )
            }
        },
        {
            title: '模型', dataIndex: 'model_name', key: 'model_name',
            render: (n, r) => (
                <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{n}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{r.model_provider}</div>
                </div>
            )
        },
        {
            title: '综合得分', dataIndex: 'score', key: 'score', width: 200, align: 'right',
            render: (s) => (
                <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-light)' }}>
                    {s.toFixed(2)}
                </span>
            )
        }
    ]

    return (
        <div className="fade-in">
            <Card
                className="page-card"
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <TrophyOutlined style={{ color: '#fdcb6e', fontSize: 24 }} />
                        <span style={{ fontSize: 20 }}>模型能力排行榜</span>
                    </div>
                }
            >
                <div style={{ marginBottom: 24 }}>
                    <span style={{ marginRight: 16, color: 'var(--text-secondary)' }}>评测维度:</span>
                    {dimensions.length > 0 ? (
                        <Segmented
                            options={dimensions.map(d => ({
                                label: dimensionMap[String(d).toLowerCase()] || String(d).toUpperCase(),
                                value: d
                            }))}
                            value={activeDim}
                            onChange={setActiveDim}
                            size="large"
                        />
                    ) : (
                        <Tag>暂无数据</Tag>
                    )}
                </div>

                <Table 
                    dataSource={data}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="large"
                />

                <div style={{ marginTop: 40, padding: '32px 0', borderTop: '1px dashed var(--border)', textAlign: 'center' }}>
                    <Typography.Title level={4} style={{ marginBottom: 16 }}>
                        想亲自体验这些模型？
                    </Typography.Title>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 24, fontSize: 16 }}>
                        在“模型体验广场”，您可以直接与上榜模型进行对话，支持多轮交互、历史保存和流式输出。
                    </Typography.Paragraph>
                    <Button
                        type="primary"
                        size="large"
                        icon={<MessageOutlined />}
                        onClick={() => navigate('/chat')}
                        style={{ height: 48, padding: '0 32px', borderRadius: 24, fontSize: 16 }}
                    >
                        前往模型体验广场 <ArrowRightOutlined />
                    </Button>
                </div>
            </Card>
        </div>
    )
}
