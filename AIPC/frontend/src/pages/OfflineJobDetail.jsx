import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Typography,
    Card,
    Table,
    Tag,
    Row,
    Col,
    Statistic,
    Progress,
    Button,
    message,
    Space,
    Popconfirm,
    Tooltip,
    Tabs,
    Badge,
    Empty,
} from 'antd';
import {
    ArrowLeftOutlined,
    SyncOutlined,
    DeleteOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    DownloadOutlined,
    RobotOutlined,
    FileTextOutlined,
    CopyOutlined,
    FullscreenOutlined,
    QuestionCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { getOfflineJob, getOfflineJobProgress, getOfflineJobResults, deleteOfflineJob, retryFailedOfflineJob } from '../api';
import { exportToCSV } from '../utils/export';

const { Title, Text, Paragraph } = Typography;

const dimensionMap = {
    'correctness': '正确性',
    'completeness': '完整性',
    'clarity': '清晰度',
};

const OfflineJobDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [progress, setProgress] = useState(null);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchJobDetails();
        const loadInterval = setInterval(() => {
            if (job && (job.status === 'pending' || job.status === 'running')) {
                fetchJobProgress();
                fetchResults();
            }
        }, 3000);
        return () => clearInterval(loadInterval);
    }, [id, job?.status]);

    useEffect(() => {
        if (job) {
            fetchResults();
        }
    }, [job?.id]);

    const fetchJobDetails = async () => {
        try {
            const res = await getOfflineJob(id);
            setJob(res.data);
            if (res.data.status === 'pending' || res.data.status === 'running') {
                fetchJobProgress();
            }
        } catch (error) {
            message.error('获取任务详情失败');
            navigate('/');
        }
    };

    const fetchJobProgress = async () => {
        try {
            const res = await getOfflineJobProgress(id);
            setProgress(res.data);
            if (res.data.status === 'completed' || res.data.status === 'failed' || res.data.status === 'cancelled') {
                setJob(prev => ({ ...prev, status: res.data.status }));
                const finalRes = await getOfflineJob(id);
                setJob(finalRes.data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchResults = async () => {
        setLoading(true);
        try {
            const res = await getOfflineJobResults(id, { limit: 500 });
            setResults(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteOfflineJob(id);
            message.success('任务已删除');
            navigate('/');
        } catch (error) {
            message.error('删除任务失败');
        }
    };

    const handleRetryFailed = async () => {
        try {
            await retryFailedOfflineJob(id);
            message.success('已触发重试，后台正在处理中');
            fetchJobDetails();
        } catch (error) {
            message.error(error.response?.data?.detail || '重试失败');
        }
    };

    const handleExport = () => {
        const exportData = results.map((r, i) => ({
            '序号': i + 1,
            '测试问题': r.prompt || '',
            '参考答案': r.reference_answer || '',
            '模型回答': r.model_output || '',
            '裁判模型': r.judge_model || '',
            '得分/判定': r.score !== null ? r.score : (r.error ? '出错' : '待算分'),
            '多维度得分': r.dimension_scores ? JSON.stringify(r.dimension_scores) : '',
            'AI理由': r.reason || '',
            '错误信息': r.error || ''
        }));
        exportToCSV(exportData, `离线判卷结果_${job.name}_${new Date().getTime()}.csv`);
    };

    const config = job?.config_snapshot || {};
    const isAccuracyMode = config?.scoring_mode === 'accuracy';

    const getRadarChartOptions = () => {
        if (!job) return {};
        const summary = job.summary || {};
        const dimAvg = summary.dimension_scores || {};
        const dimensions = Object.keys(dimAvg);

        if (dimensions.length === 0) return {};

        const indicator = dimensions.map(d => ({ name: dimensionMap[d] || d, max: 10 }));
        const value = dimensions.map(d => dimAvg[d] || 0);

        return {
            tooltip: {},
            radar: {
                indicator,
                splitArea: { show: false },
                axisName: { color: 'var(--text-color)' }
            },
            series: [{
                type: 'radar',
                data: [{
                    value,
                    name: '得分分布',
                    areaStyle: { color: 'rgba(108, 92, 231, 0.3)' },
                    lineStyle: { color: '#6C5CE7' },
                    itemStyle: { color: '#6C5CE7' }
                }]
            }]
        };
    };

    // --- Sub-components (Memoized to prevent ECharts remounting) ---
    const overviewTabContent = useMemo(() => {
        if (!job) return null;
        return (
            <div className="fade-in">
                <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                    <Col span={8}>
                        <Card className="glass-card stat-card" style={{ height: '100%' }}>
                            <Statistic title="判卷模式" value={isAccuracyMode ? '二元判定 (准确率)' : '多维度打分 (0-10)'} />
                            <div style={{ marginTop: 8 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>裁判模型: {config.judge_model_name}</Text>
                            </div>
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card className="glass-card stat-card" style={{ height: '100%' }}>
                            <Statistic title="处理状态" value={`${job.processed_cases} / ${job.total_cases}`} suffix="条记录" />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card className="glass-card stat-card" style={{
                            height: '100%',
                            borderLeft: job.status === 'completed' ? '4px solid var(--primary-color)' : ''
                        }}>
                            <Statistic
                                title={isAccuracyMode ? "整体准确率 (Accuracy)" : "整体平均分 (Average Score)"}
                                value={
                                    job.status !== 'completed' ? '-' :
                                        (isAccuracyMode ?
                                            (job.accuracy_rate !== null ? (job.accuracy_rate * 100).toFixed(2) : '0.00') :
                                            (job.average_score !== null ? job.average_score.toFixed(2) : '-'))
                                }
                                suffix={isAccuracyMode && job.status === 'completed' ? "%" : ""}
                                valueStyle={{ color: 'var(--primary-color)', fontWeight: 'bold' }}
                            />
                        </Card>
                    </Col>
                </Row>

                {
                    !isAccuracyMode && job.summary?.dimension_scores && (
                        <Row gutter={[24, 24]}>
                            <Col span={12}>
                                <Card className="glass-card" title="能力维度分析" style={{ minHeight: 400 }}>
                                    <ReactECharts
                                        option={getRadarChartOptions()}
                                        style={{ height: 350, width: '100%' }}
                                    />
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card className="glass-card" title="任务概览" style={{ minHeight: 400 }}>
                                    <div style={{ padding: '20px' }}>
                                        <Statistic title="成功率" value={((job.success_count / job.total_cases) * 100).toFixed(1)} suffix="%" />
                                        <Progress percent={Math.round((job.success_count / job.total_cases) * 100)} status="active" strokeColor="#52c41a" />
                                        <div style={{ marginTop: 30 }}>
                                            <Statistic title="失败记录" value={job.failure_count} valueStyle={{ color: '#cf1322' }} />
                                            <Text type="secondary">若存在失败记录，可尝试一键重试。</Text>
                                        </div>
                                    </div>
                                </Card>
                            </Col>
                        </Row>
                    )
                }
            </div>
        );
    }, [job, isAccuracyMode, config]);

    const comparisonTabContent = useMemo(() => {
        if (!job) return null;
        return (
            <div className="fade-in comparison-view-container">
                <style>{`
                .comparison-view-container .ant-table { background: transparent; }
                .comparison-card {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 4px;
                }
                .output-box {
                    background: var(--bg-color-secondary, #fafafa);
                    padding: 12px;
                    border-radius: 8px;
                    border: 1px solid var(--border-color-split, #f0f0f0);
                    font-size: 13px;
                    line-height: 1.6;
                    max-height: 200px;
                    overflow-y: auto;
                    white-space: pre-wrap;
                }
                .score-badge {
                    font-size: 18px;
                    font-weight: bold;
                    color: var(--primary-color);
                }
            `}</style>
                <Table 
                    dataSource={results}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    columns={[
                        {
                            title: '测试问题与参考答案',
                            width: '30%',
                            render: (_, r) => (
                                <div className="comparison-card">
                                    <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>Prompt:</div>
                                    <div className="output-box">{r.prompt}</div>
                                    {r.reference_answer && (
                                        <>
                                            <div style={{ fontWeight: 600, color: 'var(--text-color)', marginTop: 8 }}>参考答案:</div>
                                            <div className="output-box" style={{ background: '#f6ffed' }}>{r.reference_answer}</div>
                                        </>
                                    )}
                                </div>
                            )
                        },
                        {
                            title: '待测模型输出',
                            width: '40%',
                            render: (_, r) => (
                                <div className="comparison-card">
                                    <div className="output-box" style={{ minHeight: 150, border: '1px solid var(--primary-color)' }}>{r.model_output}</div>
                                </div>
                            )
                        },
                        {
                            title: '裁判结果 (AI Judge)',
                            width: '30%',
                            render: (_, r) => (
                                <div className="comparison-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="score-badge">
                                            {r.score !== null ? r.score : '-'}
                                            <small style={{ fontSize: 12, fontWeight: 'normal', marginLeft: 4 }}>分</small>
                                        </span>
                                        {r.error ? <Tag color="error">发生错误</Tag> : <Tag color="blue">{r.judge_model}</Tag>}
                                    </div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-color)', marginTop: 8 }}>判定理由:</div>
                                    <div className="output-box" style={{ background: '#fffbe6', maxHeight: 150 }}>{r.reason || (r.error ? r.error : '无理由')}</div>
                                </div>
                            )
                        }
                    ]}
                />
            </div>
        );
    }, [results, job]);

    const detailsTabContent = useMemo(() => {
        if (!job) return null;
        const renderScore = (record) => {
            if (record.score === null) return <Tag color="default">待算分</Tag>;
            if (record.error) return <Tooltip title={record.error}><Tag color="error">出错</Tag></Tooltip>;

            if (isAccuracyMode) {
                return record.score > 0.5 ?
                    <Tag icon={<CheckCircleOutlined />} color="success">正确</Tag> :
                    <Tag icon={<CloseCircleOutlined />} color="error">错误</Tag>;
            }
            return <Text strong style={{ color: 'var(--primary-color)' }}>{record.score}</Text>;
        };

        const columns = [
            {
                title: '序号',
                key: 'index',
                width: 70,
                render: (text, record, index) => index + 1,
            },
            {
                title: '测试问题',
                dataIndex: 'prompt',
                key: 'prompt',
                ellipsis: true,
                width: '25%',
            },
            {
                title: '模型回答',
                dataIndex: 'model_output',
                key: 'model_output',
                ellipsis: true,
                width: '25%',
            },
            {
                title: '裁判',
                dataIndex: 'judge_model',
                key: 'judge_model',
                width: 100,
                render: (text) => text ? <Tag color="blue">{text}</Tag> : '-'
            },
            {
                title: '得分/判定',
                key: 'score',
                width: 100,
                render: renderScore,
                sorter: (a, b) => (a.score || 0) - (b.score || 0),
            },
            {
                title: 'AI 理由',
                dataIndex: 'reason',
                key: 'reason',
                ellipsis: true,
                render: (text) => text ? <Tooltip title={text}>{text}</Tooltip> : '-'
            }
        ];

        return (
            <div className="fade-in">
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button icon={<DownloadOutlined />} onClick={handleExport}>导出 CSV</Button>
                </div>
                <Table 
                    columns={columns}
                    dataSource={results}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                />
            </div>
        );
    }, [results, loading, isAccuracyMode]);

    const getStatusTag = (status) => {
        const statusMap = {
            pending: { color: 'default', text: '排队中' },
            running: { color: 'processing', text: '判卷中' },
            completed: { color: 'success', text: '已完成' },
            failed: { color: 'error', text: '失败' },
            cancelled: { color: 'default', text: '已取消' },
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
    };

    const tabItems = useMemo(() => [
        { key: 'overview', label: '任务概览', children: overviewTabContent },
        { key: 'comparison', label: '并排对比 (A/B Test)', children: comparisonTabContent },
        { key: 'details', label: '判定明细', children: detailsTabContent },
        {
            key: 'config', label: '裁判配置', children: job && (
                <Card className="glass-card">
                    <Text strong>裁判模型:</Text> <Text>{config.judge_model_name}</Text>
                    <div style={{ marginTop: 12 }}>
                        <Text strong>客观题忽略大小写:</Text>{' '}
                        <Tag color={(config.ignore_case ?? true) ? 'success' : 'default'}>
                            {(config.ignore_case ?? true) ? '开启' : '关闭'}
                        </Tag>
                    </div>
                    <div style={{ marginTop: 16 }}>
                        <Text strong>当前使用的 Prompt:</Text>
                        <pre style={{
                            background: 'var(--bg-color-secondary, #fafafa)',
                            padding: 16,
                            borderRadius: 8,
                            marginTop: 8,
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                            fontSize: 13,
                        }}>{config.custom_prompt}</pre>
                    </div>
                </Card>
            )
        },
    ], [overviewTabContent, comparisonTabContent, detailsTabContent, config, job]);

    if (!job) return <div style={{ padding: 24 }}>加载中...</div>;

    return (
        <div className="page-container fade-in">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 16 }}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} type="text" />
                <Title level={2} style={{ margin: 0 }}>离线判卷: {job.name}</Title>
                {getStatusTag(job.status)}
                <div style={{ flex: 1 }} />
                <Space>
                    {job.failure_count > 0 && ['completed', 'failed', 'cancelled'].includes(job.status) && (
                        <Popconfirm
                            title="确定要重试所有产生错误或未打分的数据吗？"
                            onConfirm={handleRetryFailed}
                            okText="确定重试"
                            cancelText="取消"
                        >
                            <Button type="primary" danger>一键重试失败项</Button>
                        </Popconfirm>
                    )}
                    <Popconfirm
                        title="确定要删除这个任务及其所有评分数据吗？"
                        onConfirm={handleDelete}
                        okText="删除"
                        okButtonProps={{ danger: true }}
                        cancelText="取消"
                    >
                        <Button danger icon={<DeleteOutlined />}>删除任务</Button>
                    </Popconfirm>
                    <Button icon={<SyncOutlined />} onClick={fetchResults} loading={loading}>刷新</Button>
                </Space>
            </div>

            {(job.status === 'running' || job.status === 'pending') && progress && (
                <Card className="glass-card" style={{ marginBottom: 24 }}>
                    <Text strong>判卷进度</Text>
                    <Progress
                        percent={progress.progress_pct}
                        status="active"
                        strokeColor={{ '0%': '#8b5cf6', '100%': '#3b82f6' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text type="secondary">总共: {progress.total_cases} 条记录</Text>
                        <Text type="secondary">成功判卷: <Text type="success">{progress.success_count}</Text> 条 / 失败: <Text type="danger">{progress.failure_count}</Text> 条</Text>
                    </div>
                </Card>
            )}

            <Tabs items={tabItems} />
        </div>
    );
};

export default OfflineJobDetail;
