import React from 'react'
import { Card, Row, Col, Typography, Tag, Timeline, Descriptions, Space } from 'antd'
import {
    InfoCircleOutlined,
    RobotOutlined,
    SlidersOutlined,
    TrophyOutlined,
    CheckCircleOutlined,
    SettingOutlined,
    UserOutlined,
    CodeOutlined,
    LinkOutlined
} from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

export default function About() {
    return (
        <div className="fade-in" style={{ padding: '4px 0' }}>
            {/* Header section with brand feel */}
            <Card
                className="page-card"
                style={{
                    marginBottom: 24,
                    background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.1) 0%, rgba(162, 155, 254, 0.05) 100%)',
                    border: '1px solid rgba(108, 92, 231, 0.15)'
                }}
            >
                <div style={{ padding: '20px 10px' }}>
                    <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <RobotOutlined style={{ color: '#6C5CE7' }} />
                        <span>AIPC 大模型自动化评测系统</span>
                    </Title>
                    <Paragraph style={{ marginTop: 12, fontSize: 16, color: 'var(--text-secondary)', maxHeight: 'none', maxWidth: 800 }}>
                        AIPC (AI Performance & Capability Evaluation System) 是一款面向企业级与研究级大语言模型（LLM）的多维度、自动化评测与分析平台。
                        系统旨在打破大模型能力评测“流程分散、主观评分不一致、性能数据缺失”的痛点，帮助开发者与企业高效地进行模型选型、评测对比与迭代监控。
                    </Paragraph>
                </div>
            </Card>

            <Row gutter={[24, 24]}>
                {/* Core Modules Card */}
                <Col xs={24} lg={16}>
                    <Card
                        title={<span style={{ fontSize: 18, fontWeight: 600 }}><SlidersOutlined /> 核心功能板块</span>}
                        className="page-card"
                        style={{ height: '100%' }}
                    >
                        <Row gutter={[20, 20]}>
                            <Col xs={24} sm={12}>
                                <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-layout)', height: '100%' }}>
                                    <Title level={4} style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <SettingOutlined style={{ color: 'var(--primary)' }} />
                                        模型 & 评测任务管理
                                    </Title>
                                    <Paragraph type="secondary" style={{ fontSize: 14 }}>
                                        一站式接入主流云端大模型 API（如 OpenAI, Anthropic, DeepSeek, 阿里通义, Kimi 等）与本地大模型（如 Ollama）。
                                        支持自定义测试集与 Prompt 模板管理，快速创建高度可定制的自动化评测实验。
                                    </Paragraph>
                                </div>
                            </Col>

                            <Col xs={24} sm={12}>
                                <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-layout)', height: '100%' }}>
                                    <Title level={4} style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <CheckCircleOutlined style={{ color: '#00cec9' }} />
                                        自动化评分与 AI 裁判
                                    </Title>
                                    <Paragraph type="secondary" style={{ fontSize: 14 }}>
                                        提供客观题规则匹配打分（如精确匹配、正则比对）与主观题大模型裁判（LLM-as-a-Judge）自动评分机制。
                                        同时支持人工审核视图，可对 AI 裁判给出的分数和理由进行人工修正与二次确认，保证结果严谨性。
                                    </Paragraph>
                                </div>
                            </Col>

                            <Col xs={24} sm={12}>
                                <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-layout)', height: '100%' }}>
                                    <Title level={4} style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <TrophyOutlined style={{ color: '#fdcb6e' }} />
                                        可视化对比与排行榜
                                    </Title>
                                    <Paragraph type="secondary" style={{ fontSize: 14 }}>
                                        自动汇总评测任务，生成细分雷达图、柱状图。
                                        多维度指标可视化，包括效果得分（首Token延迟 TTFT、吞吐量 TPS、Tokens生成速率）、计价成本核算以及请求失败率，一目了然。
                                    </Paragraph>
                                </div>
                            </Col>

                            <Col xs={24} sm={12}>
                                <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-layout)', height: '100%' }}>
                                    <Title level={4} style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <RobotOutlined style={{ color: '#ff7675' }} />
                                        体验广场与离线打分
                                    </Title>
                                    <Paragraph type="secondary" style={{ fontSize: 14 }}>
                                        内置大模型体验广场，支持与多个已注册模型并行即时对话。
                                        同时提供离线打分（CSV 数据批量导入）模式，专为本地已生成大模型输出的数据集进行客观或主观自动化打分。
                                    </Paragraph>
                                </div>
                            </Col>
                        </Row>
                    </Card>
                </Col>

                {/* Tech Stack Info */}
                <Col xs={24} lg={8}>
                    <Card
                        title={<span style={{ fontSize: 18, fontWeight: 600 }}><CodeOutlined /> 技术架构体系</span>}
                        className="page-card"
                        style={{ height: '100%' }}
                    >
                        <Descriptions column={1} size="small" bordered>
                            <Descriptions.Item label="前端技术">
                                <Space direction="vertical" size={4}>
                                    <Text strong>React 18</Text>
                                    <Text type="secondary">基础 UI 开发框架</Text>
                                    <Text strong>Ant Design (v5)</Text>
                                    <Text type="secondary">响应式企业级 UI 组件库</Text>
                                    <Text strong>ECharts / Recharts</Text>
                                    <Text type="secondary">丰富的数据可视化图表库</Text>
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="后端技术">
                                <Space direction="vertical" size={4}>
                                    <Text strong>FastAPI (Python)</Text>
                                    <Text type="secondary">高性能、异步 RESTful API 服务</Text>
                                    <Text strong>Celery + Redis</Text>
                                    <Text type="secondary">高并发、稳定的异步评测任务队列</Text>
                                    <Text strong>SQLAlchemy + MySQL</Text>
                                    <Text type="secondary">数据库底座与 ORM 映射</Text>
                                </Space>
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>
                </Col>

                {/* Project Milestone and Creator */}
                <Col xs={24} md={12}>
                    <Card
                        title={<span style={{ fontSize: 18, fontWeight: 600 }}><InfoCircleOutlined /> 系统迭代历史</span>}
                        className="page-card"
                    >
                        <Timeline
                            mode="left"
                            items={[
                                {
                                    color: 'green',
                                    children: (
                                        <>
                                            <Text strong>V2.0 评测体验再优化 (2025-03-11)</Text>
                                            <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
                                                新增能力维度化分类、多AI裁判可靠性、GPU资源收集压测模式及模型体验广场；增加人工修正批量处理审计。
                                            </Paragraph>
                                        </>
                                    ),
                                },
                                {
                                    color: 'blue',
                                    children: (
                                        <>
                                            <Text strong>V1.5 离线评测与性能跟踪 (2025-03-05)</Text>
                                            <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
                                                引入首Token延迟、并发吞吐量统计与本地 CSV 批量离线评测能力。
                                            </Paragraph>
                                        </>
                                    ),
                                },
                                {
                                    color: 'gray',
                                    children: (
                                        <>
                                            <Text strong>V1.0 基础系统发布 (2025-03-10)</Text>
                                            <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
                                                完成模型管理、测试集管理、评测任务发起及客观/主观题评分的基础模块。
                                            </Paragraph>
                                        </>
                                    ),
                                },
                            ]}
                        />
                    </Card>
                </Col>

                {/* Creator Profile */}
                <Col xs={24} md={12}>
                    <Card
                        title={<span style={{ fontSize: 18, fontWeight: 600 }}><UserOutlined /> 制作者与支持</span>}
                        className="page-card"
                    >
                        <Descriptions column={1} bordered size="middle">
                            <Descriptions.Item label="制作者">田长金（Tavian）</Descriptions.Item>
                            <Descriptions.Item label="联系邮箱">473272738@qq.com</Descriptions.Item>
                            <Descriptions.Item label="个人主页">
                                <a href="http://39.106.4.251/aboutMe" target="_blank" rel="noopener noreferrer">
                                    Tavian 的个人空间 <LinkOutlined />
                                </a>
                            </Descriptions.Item>
                            <Descriptions.Item label="开源协议">MIT License</Descriptions.Item>
                            <Descriptions.Item label="关于项目">
                                本项目旨在提供开源透明的 LLM 评测工具。目前系统在持续演进中，支持对各类多模态、Agent 与长文本模型的扩展评测。
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>
                </Col>
            </Row>
        </div>
    )
}
