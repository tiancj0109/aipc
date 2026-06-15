import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Card, Tabs, Table, Tag, Progress, Statistic, Row, Col, Button, Modal, Drawer,
    Descriptions, InputNumber, Input, message, Select, Radio, Checkbox, Tooltip,
    Typography, Space, Badge, Empty
} from 'antd'
const { Text } = Typography
import {
    CheckCircleOutlined,
    SyncOutlined,
    ArrowLeftOutlined,
    InfoCircleOutlined,
    DownloadOutlined,
    ReloadOutlined,
    ExportOutlined,
    QuestionCircleOutlined,
    BarChartOutlined,
    FilePdfOutlined,
    FileMarkdownOutlined,
    FileExcelOutlined,
    FieldTimeOutlined,
    ThunderboltOutlined,
    CloseCircleOutlined,
    CodeOutlined,
    CopyOutlined,
    FullscreenOutlined,
    RobotOutlined,
    FileTextOutlined,
    ClockCircleOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { getJob, getJobProgress, getAggregatedResults, getDetailedResults, updateResult, batchAIScore, getModels, retryFailedJob, recomputeAggregatedResults, pauseJob, resumeJob } from '../api'
import { exportToCSV } from '../utils/export'

const Terminal = () => {
    const [logs, setLogs] = useState([])
    const [filter, setFilter] = useState('backend')
    const [wsStatus, setWsStatus] = useState('connecting') // 'connecting' | 'connected' | 'error'
    const scrollRef = React.useRef(null)
    const dedupRef = React.useRef({ key: '', ts: 0 })

    const appendLog = React.useCallback((entry) => {
        const timestamp = entry?.timestamp || new Date().toISOString().replace('T', ' ').slice(0, 23)
        const level = entry?.level || 'INFO'
        const source = entry?.source || 'backend'
        const message = entry?.message || ''
        const name = entry?.name || 'system'
        const key = `${source}|${level}|${name}|${message}`
        const now = Date.now()
        const isDuplicate = dedupRef.current.key === key && (now - dedupRef.current.ts) < 2000
        if (isDuplicate) return
        dedupRef.current = { key, ts: now }
        setLogs(prev => [...prev.slice(-499), { timestamp, level, source, message, name }])
    }, [])

    useEffect(() => {
        let socket
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            const wsUrl = `${protocol}//${window.location.host}/aipc-api/v1/ws/logs`
            socket = new WebSocket(wsUrl)
            socket.onopen = () => {
                setWsStatus('connected')
            }
            socket.onerror = () => {
                setWsStatus('error')
            }
            socket.onclose = () => {
                setWsStatus('error')
            }
            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    if (data?.type === 'ping') return
                    if (!data?.message) return
                    appendLog(data)
                } catch (e) {
                }
            }
        } catch (e) {
            setWsStatus('error')
        }
        return () => { if (socket) socket.close() }
    }, [appendLog])

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [logs])

    const filteredLogs = logs.filter(l => l.source === filter)

    return (
        <Card variant="borderless" style={{ background: '#000', borderRadius: 8, padding: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #333' }}>
                <Space>
                    <Badge
                        status={wsStatus === 'connected' ? 'processing' : wsStatus === 'error' ? 'error' : 'default'}
                        color={wsStatus === 'connected' ? 'green' : wsStatus === 'error' ? 'red' : 'gray'}
                        text={
                            <Text style={{ color: wsStatus === 'connected' ? '#00ff00' : wsStatus === 'error' ? '#ff4d4f' : '#888', fontSize: 12 }}>
                                {wsStatus === 'connected' ? 'Live Stream' : wsStatus === 'error' ? '连接失败' : '连接中...'}
                            </Text>
                        }
                    />
                    <Radio.Group size="small" value={filter} onChange={e => setFilter(e.target.value)} buttonStyle="solid">
                        <Radio.Button value="backend">API层</Radio.Button>
                        <Radio.Button value="worker">计算层</Radio.Button>
                    </Radio.Group>
                </Space>
                <Button size="small" ghost onClick={() => setLogs([])}>清空日志</Button>
            </div>
            <div ref={scrollRef} style={{ height: 500, overflowY: 'auto', padding: '12px 16px', fontFamily: 'Consolas, Monaco, "Courier New", monospace', fontSize: 12, lineHeight: 1.5, color: '#eee', whiteSpace: 'pre-wrap' }}>
                {filteredLogs.map((l, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>
                        <span style={{ color: '#888' }}>[{l.timestamp || ''}]</span>{' '}
                        {l.source && (
                            <Tag color={l.source === 'backend' ? 'blue' : 'purple'} bordered={false} style={{ fontSize: 10, lineHeight: '14px', height: 16, padding: '0 4px', marginRight: 4 }}>
                                {l.source.toUpperCase()}
                            </Tag>
                        )}{' '}
                        <span style={{ color: l.level === 'ERROR' ? '#ff4d4f' : (l.level === 'WARNING' ? '#faad14' : '#eee'), fontWeight: l.level === 'ERROR' ? 600 : 400 }}>
                            {l.message || ''}
                        </span>
                    </div>
                ))}
                {filteredLogs.length === 0 && (
                    <div style={{ color: '#555', textAlign: 'center', marginTop: 100 }}>
                        {wsStatus === 'error' ? '⚠️ 无法连接到日志服务' : '等待日志流输入...'}
                    </div>
                )}
            </div>
        </Card>
    )
}

const statusConfig = {
    pending: { color: 'default', text: '等待中' },
    running: { color: 'processing', text: '运行中' },
    completed: { color: 'success', text: '已完成' },
    failed: { color: 'error', text: '失败' },
    paused: { color: 'warning', text: '已暂停' },
    cancelled: { color: 'default', text: '已取消' },
}

const dimensionMap = {
    'correctness': '正确性',
    'completeness': '完整性',
    'clarity': '清晰度',
    // Add fallback for others if needed
}


export default function JobDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [job, setJob] = useState(null)
    const [progress, setProgress] = useState(null)
    const [report, setReport] = useState([])
    const [details, setDetails] = useState([])
    const [loading, setLoading] = useState(true)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [activeResult, setActiveResult] = useState(null)

    // AI Scoring Modal states
    const [batchScoreModalOpen, setBatchScoreModalOpen] = useState(false)
    const [batchScoreLoading, setBatchScoreLoading] = useState(false)
    const [judgeModels, setJudgeModels] = useState([])
    const [selectedJudgeIds, setSelectedJudgeIds] = useState([])
    const [batchScoreScope, setBatchScoreScope] = useState('pending_no_score')
    const [batchRequireHumanReview, setBatchRequireHumanReview] = useState(true)
    const [batchEnableObjectiveAutoScore, setBatchEnableObjectiveAutoScore] = useState(true)
    const [batchIgnoreCase, setBatchIgnoreCase] = useState(true)

    // Human Review Persistence states
    const [reviewScore, setReviewScore] = useState(null)
    const [reviewComment, setReviewComment] = useState('')
    const [previewContent, setPreviewContent] = useState(null)

    // Synchronize review states when active result changes
    useEffect(() => {
        if (activeResult) {
            setReviewScore(activeResult.final_score ?? activeResult.auto_score ?? null)
            const fallbackReason = activeResult.auto_metadata?.reason
                || activeResult.auto_metadata?.reasoning
                || (Array.isArray(activeResult.auto_metadata?.reasons) ? activeResult.auto_metadata.reasons[0] : '')
                || ''
            setReviewComment(activeResult.review_comment || fallbackReason)
        }
    }, [activeResult])

    // Use a ref so the interval callback always reads the latest job without re-registering
    const jobRef = React.useRef(null)
    useEffect(() => { jobRef.current = job }, [job])

    // Polling interval
    useEffect(() => {
        loadData()
        loadModels()

        const timer = setInterval(() => {
            const currentJob = jobRef.current
            if (!currentJob) return
            const isJobActive = currentJob.status === 'running' || currentJob.status === 'pending'
            const isBatchScoringActive = currentJob.config_snapshot?.batch_scoring?.status === 'running'
            if (isJobActive || isBatchScoringActive) {
                loadData(/* background= */ true)
            }
        }, 3000)

        return () => clearInterval(timer)
    }, [id]) // only restart interval when job id changes

    async function loadData(background = false) {
        if (!background) setLoading(true)
        try {
            const [jobRes, progRes, repRes, detRes] = await Promise.all([
                getJob(id),
                getJobProgress(id),
                getAggregatedResults(id),
                getDetailedResults(id, { limit: 10000 })
            ])
            setJob(jobRes.data)
            setProgress(progRes.data)
            setReport(repRes.data)
            setDetails(detRes.data)
        } catch { if (!background) message.error('加载任务详情失败') }
        if (!background) setLoading(false)
    }

    async function loadModels() {
        try {
            const res = await getModels({ limit: 100 })
            setJudgeModels(res.data || [])
        } catch { }
    }

    const getModelName = (modelId) => {
        if (!modelId) return '-'
        // Try to find in aggregated report first
        const reportItem = report?.find(r => String(r.model_id) === String(modelId))
        if (reportItem?.model_name) return reportItem.model_name
        // Fallback to global model registry
        const registryItem = judgeModels?.find(m => String(m.id) === String(modelId))
        if (registryItem?.name) return registryItem.name
        return modelId
    }
    const getPromptName = (result) => {
        if (!result) return '-'
        const reportItem = report?.find(r => String(r.model_id) === String(result.model_id) && String(r.prompt_template_id || '0') === String(result.prompt_template_id || '0'))
        if (reportItem?.prompt_name && reportItem.prompt_name !== '默认/测试集Prompt') return reportItem.prompt_name
        return '默认'
    }
    const formatJudgeName = (name) => name === 'RULE_AUTO' ? '规则自动判分' : name
    const isRuleAutoScore = (result) => {
        const judges = result?.auto_metadata?.judges || []
        const source = result?.auto_metadata?.source
        const judgeModel = result?.judge_model || ''
        const reason = String(result?.auto_metadata?.reason || '')
        return source === 'rule_auto'
            || judges.includes('RULE_AUTO')
            || String(judgeModel).split(',').includes('RULE_AUTO')
            || /模型答案与标准答案|模型判断与标准答案|规则自动判分|未识别到有效选项/.test(reason)
    }
    const getScoreSourceLabel = (result) => {
        if (isRuleAutoScore(result)) return '规则自动判分'
        if (result?.auto_score !== null && result?.auto_score !== undefined) return 'AI裁判打分'
        return '未打分'
    }
    const formatQuestionType = (questionType) => {
        if (!questionType) return '主观题'
        const t = String(questionType).toLowerCase()
        if (['single_choice', 'single', 'choice', 'mcq', '单选', '单选题'].includes(t)) return '单选'
        if (['multiple_choice', 'multiple', '多选', '多选题'].includes(t)) return '多选'
        if (['binary', 'boolean', 'true_false', 'judge', '判断题', '二元判定', '是非题'].includes(t)) return '判断'
        if (['code', 'coding'].includes(t)) return '代码'
        return String(questionType)
    }
    const isObjectiveQuestion = (result) => {
        const t = String(result?.question_type || '').toLowerCase()
        return ['single_choice', 'single', 'choice', 'mcq', 'multiple_choice', 'multiple', 'binary', 'boolean', 'true_false', 'judge', '单选', '单选题', '多选', '多选题', '判断题', '二元判定', '是非题'].includes(t) || isRuleAutoScore(result)
    }
    const getCompositeScoreHint = (reportItem, isPureObjective) => {
        const objectiveAccuracy = reportItem?.summary?.objective_breakdown?.overall?.accuracy
        const subjectiveAvg = reportItem?.summary?.subjective_summary?.avg_score
        if (isPureObjective) {
            return '当前为纯客观任务，显示的是客观题准确率（正确数/已判分数）。'
        }
        if (objectiveAccuracy !== null && objectiveAccuracy !== undefined && subjectiveAvg !== null && subjectiveAvg !== undefined) {
            return `综合得分 = (客观准确率×10 + 主观题均分) / 2 = (${(objectiveAccuracy * 100).toFixed(1)}%×10 + ${Number(subjectiveAvg).toFixed(2)}) / 2`
        }
        if (objectiveAccuracy !== null && objectiveAccuracy !== undefined) {
            return `当前仅有客观题得分，按 客观准确率×10 计入综合得分（${(objectiveAccuracy * 100).toFixed(1)}%）。`
        }
        if (subjectiveAvg !== null && subjectiveAvg !== undefined) {
            return `当前仅有主观题得分，综合得分 = 主观题均分（${Number(subjectiveAvg).toFixed(2)}）。`
        }
        return '当前暂无可用得分。'
    }


    // --- Charts configuration ---
    const radarChartOptions = useMemo(() => {
        if (!report || report.length === 0) return {}
        const dimensions = new Set()
        report.forEach(r => {
            if (r.summary?.dimension_scores) Object.keys(r.summary.dimension_scores).forEach(d => dimensions.add(d))
        })
        if (dimensions.size === 0) return {}
        const dimArray = Array.from(dimensions)
        const indicator = dimArray.map(d => ({ name: dimensionMap[d] || d, max: 10 }))
        const seriesData = report.map(r => {
            const scores = r.summary?.dimension_scores || {}
            const label = r.prompt_name && r.prompt_name !== '默认/测试集Prompt'
                ? `${r.model_name} [${r.prompt_name}]` : r.model_name
            return { value: dimArray.map(d => scores[d] || 0), name: label }
        })
        return {
            tooltip: {},
            legend: { data: seriesData.map(s => s.name), bottom: 0, type: 'scroll' },
            radar: { indicator, splitArea: { show: false } },
            series: [{ type: 'radar', data: seriesData }]
        }
    }, [report])

    const performanceChartOptions = useMemo(() => {
        if (!report || report.length === 0) return {}
        const labels = report.map(r => r.prompt_name && r.prompt_name !== '默认/测试集Prompt'
            ? `${r.model_name}\n[${r.prompt_name}]` : r.model_name)
        const latencies = report.map(r => r.performance_summary?.avg_latency_ms || 0)
        const tpsList = report.map(r => r.performance_summary?.avg_tps || 0)
        return {
            tooltip: { trigger: 'axis' },
            legend: { data: ['平均延迟 (ms)', 'TPS'], bottom: 0 },
            grid: { bottom: 80 },
            xAxis: { type: 'category', data: labels, axisLabel: { interval: 0, rotate: 30 } },
            yAxis: [
                { type: 'value', name: '延迟 (ms)', splitLine: { lineStyle: { type: 'dashed' } } },
                { type: 'value', name: 'TPS', splitLine: { show: false } }
            ],
            series: [
                { name: '平均延迟 (ms)', type: 'bar', data: latencies, itemStyle: { color: '#6C5CE7' } },
                { name: 'TPS', type: 'line', yAxisIndex: 1, data: tpsList, itemStyle: { color: '#00cec9' }, lineWidth: 3 }
            ]
        }
    }, [report])

    // --- Handlers ---
    const handleCopy = (text) => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                message.success('已复制到剪贴板');
            }, () => {
                message.error('复制失败');
            });
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed'; // Avoid scrolling to bottom
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    message.success('已复制到剪贴板');
                } else {
                    message.error('复制失败');
                }
            } catch (err) {
                message.error('复制失败');
            }
            document.body.removeChild(textArea);
        }
    };

    const handleReviewSave = async (resultId, humanScore, comment, callback = null) => {
        try {
            await updateResult(resultId, { human_score: humanScore, review_comment: comment, reviewer: 'admin' })
            message.success('已修正分数')
            if (callback) {
                callback()
            } else {
                setDrawerOpen(false)
            }
            loadData()
        } catch { message.error('修正失败') }
    }

    const handleBatchAIScore = async () => {
        if (!selectedJudgeIds || selectedJudgeIds.length === 0) {
            message.warning('请选择至少一个裁判模型')
            return
        }

        // Find results based on selected scope
        const targetResults = details.filter(r => {
            if (batchScoreScope === 'pending_no_score') {
                return r.review_status === 'pending' && r.auto_score === null
            } else if (batchScoreScope === 'no_score') {
                return r.auto_score === null
            } else {
                return true // 'all'
            }
        })

        if (targetResults.length === 0) {
            message.info('当前没有符合条件的打分结果')
            setBatchScoreModalOpen(false)
            return
        }

        const resultIds = targetResults.map(r => r.id)

        setBatchScoreLoading(true)
        try {
            await batchAIScore(id, {
                result_ids: resultIds,
                judge_model_ids: selectedJudgeIds,
                require_human_review: batchRequireHumanReview,
                enable_objective_auto_score: batchEnableObjectiveAutoScore,
                ignore_case: batchIgnoreCase
            })
            message.success(`已触发 ${resultIds.length} 条结果的AI裁判打分，请稍等`)
            setBatchScoreModalOpen(false)
            loadData() // Always fetch the latest status to trigger the progress UI
        } catch (error) {
            message.error(error.response?.data?.detail || '触发AI打分失败')
        } finally {
            setBatchScoreLoading(false)
        }
    }

    const handleRetryFailed = async () => {
        try {
            await retryFailedJob(id)
            message.success('已触发重试失败的评测请求，请稍等进度更新')
            loadData()
        } catch (e) {
            message.error(e.response?.data?.detail || '重试请求失败')
        }
    }

    const handlePause = async () => {
        try {
            await pauseJob(id)
            message.success('任务已暂停')
            loadData()
        } catch (e) {
            message.error(e.response?.data?.detail || '暂停失败')
        }
    }

    const handleResume = async () => {
        try {
            await resumeJob(id)
            message.success('任务已继续')
            loadData()
        } catch (e) {
            message.error(e.response?.data?.detail || '继续失败')
        }
    }

    const handleRecompute = async () => {
        try {
            await recomputeAggregatedResults(id)
            message.success('已触发报告重算，请稍等')
            loadData()
        } catch (e) {
            message.error(e.response?.data?.detail || '重试重算失败')
        }
    }

    const handleExportSummaryCSV = () => {
        if (!report || report.length === 0) return
        const exportedAt = new Date()
        const exportTimeText = exportedAt.toLocaleString()
        const objectiveCaseTotal = report.reduce((sum, r) => sum + (r.summary?.objective_breakdown?.overall?.total_cases || 0), 0)
        const subjectiveCaseTotal = report.reduce((sum, r) => sum + (r.summary?.subjective_summary?.total_cases || 0), 0)
        const scoringMode = objectiveCaseTotal > 0 && subjectiveCaseTotal > 0 ? '主客观混合' : (objectiveCaseTotal > 0 ? '纯客观' : '纯主观')
        const fmtNum = (v, digits = 4) => (v === null || v === undefined || Number.isNaN(Number(v))) ? '' : Number(v).toFixed(digits)
        const fmtPct = (v) => (v === null || v === undefined || Number.isNaN(Number(v))) ? '' : `${(Number(v) * 100).toFixed(2)}%`
        const exportData = report.map(r => ({
            '任务ID': job?.id,
            '任务名称': job?.name || '',
            '任务状态': job?.status || '',
            '导出时间': exportTimeText,
            '评分模式': scoringMode,
            '模型名称': r.model_name,
            '提示词模板': r.prompt_name || '默认',
            '综合得分(0-10)': fmtNum(r.summary?.avg_score, 4),
            '客观准确率(总)': fmtPct(r.summary?.objective_breakdown?.overall?.accuracy),
            '客观准确率(单选)': fmtPct(r.summary?.objective_breakdown?.single_choice?.accuracy),
            '客观准确率(多选)': fmtPct(r.summary?.objective_breakdown?.multiple_choice?.accuracy),
            '客观准确率(判断)': fmtPct(r.summary?.objective_breakdown?.binary?.accuracy),
            '主观题均分(0-10)': fmtNum(r.summary?.subjective_summary?.avg_score, 4),
            '用例总数': r.summary?.total_cases || 0,
            '已打分用例数': r.summary?.scored_cases || 0,
            '客观题总数': r.summary?.objective_breakdown?.overall?.total_cases || 0,
            '主观题总数': r.summary?.subjective_summary?.total_cases || 0,
            '维度-正确性': fmtNum(r.summary?.dimension_scores?.correctness, 4),
            '维度-完整性': fmtNum(r.summary?.dimension_scores?.completeness, 4),
            '维度-清晰度': fmtNum(r.summary?.dimension_scores?.clarity, 4),
            '平均延迟(ms)': fmtNum(r.performance_summary?.avg_latency_ms, 2),
            'P95延迟(ms)': fmtNum(r.performance_summary?.p95_latency_ms, 2),
            '首字延迟TTFT(ms)': fmtNum(r.performance_summary?.avg_ttft_ms, 2),
            '平均TPS': fmtNum(r.performance_summary?.avg_tps, 4),
            '平均输入Tokens': fmtNum(r.performance_summary?.avg_prompt_tokens, 1),
            '平均输出Tokens': fmtNum(r.performance_summary?.avg_completion_tokens, 1),
            '平均总Tokens': fmtNum(r.performance_summary?.avg_total_tokens, 1),
            '累计总Tokens': r.performance_summary?.total_tokens || 0,
            '推理成本USD': fmtNum(r.performance_summary?.inference_cost_usd, 6),
            '预热成本USD': fmtNum(r.performance_summary?.warmup_cost_usd, 6),
            '总成本USD': fmtNum(r.performance_summary?.total_cost_usd, 6),
            '错误率': fmtPct(r.performance_summary?.error_rate),
            '成功率': fmtPct(1 - Number(r.performance_summary?.error_rate || 0)),
        }))
        exportToCSV(exportData, `总体报告_${job.name}_${new Date().getTime()}.csv`)
    }

    const handleExportMarkdown = () => {
        if (!report || report.length === 0) return
        const exportedAt = new Date()
        const objectiveCaseTotal = report.reduce((sum, r) => sum + (r.summary?.objective_breakdown?.overall?.total_cases || 0), 0)
        const subjectiveCaseTotal = report.reduce((sum, r) => sum + (r.summary?.subjective_summary?.total_cases || 0), 0)
        const scoringMode = objectiveCaseTotal > 0 && subjectiveCaseTotal > 0 ? '主客观混合' : (objectiveCaseTotal > 0 ? '纯客观' : '纯主观')
        const configSnapshot = job?.config_snapshot || {}
        let md = `# 评测任务总体报告: ${job.name}\n\n`
        md += `- **任务ID**: ${job.id}\n`
        md += `- **状态**: ${job.status}\n`
        md += `- **完成进度**: ${progress?.completed_count || 0} / ${progress?.total_count || 0}\n`
        md += `- **评分模式**: ${scoringMode}\n`
        md += `- **客观题总数**: ${objectiveCaseTotal}\n`
        md += `- **主观题总数**: ${subjectiveCaseTotal}\n`
        md += `- **导出时间**: ${exportedAt.toLocaleString()}\n\n`

        md += `## 0. 任务配置快照（关键项）\n\n`
        md += `- **是否启用AI裁判**: ${configSnapshot.enable_ai_judge === false ? '否' : '是'}\n`
        md += `- **是否启用客观自动判分**: ${configSnapshot.enable_objective_auto_score === false ? '否' : '是'}\n`
        md += `- **客观题忽略大小写**: ${configSnapshot.ignore_case === false ? '否' : '是'}\n`
        md += `- **是否需要人工复核**: ${configSnapshot.require_human_review === false ? '否' : '是'}\n\n`

        md += `## 1. 核心指标对比\n\n`
        md += `| 模型 | 提示词 | 综合得分 | 客观准确率 | 主观均分 | 延迟(ms) | TPS | 成功率 | 总成本(USD) |\n`
        md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`
        report.forEach(r => {
            const rate = ((1 - (r.performance_summary?.error_rate || 0)) * 100).toFixed(1) + '%'
            const objectivePct = r.summary?.objective_breakdown?.overall?.accuracy
            const objectiveText = objectivePct === null || objectivePct === undefined ? '-' : `${(Number(objectivePct) * 100).toFixed(1)}%`
            const subjectiveText = r.summary?.subjective_summary?.avg_score === null || r.summary?.subjective_summary?.avg_score === undefined ? '-' : Number(r.summary?.subjective_summary?.avg_score).toFixed(2)
            md += `| ${r.model_name} | ${r.prompt_name || '默认'} | ${r.summary?.avg_score?.toFixed(2) || '-'} | ${objectiveText} | ${subjectiveText} | ${r.performance_summary?.avg_latency_ms || '-'} | ${r.performance_summary?.avg_tps?.toFixed(1) || '-'} | ${rate} | $${r.performance_summary?.total_cost_usd?.toFixed(5) || '0'} |\n`
        })
        md += `\n`

        md += `## 2. 维度明细\n\n`
        md += `| 模型 | 正确性 | 完整性 | 清晰度 | P95延迟 | TTFT |\n`
        md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`
        report.forEach(r => {
            md += `| ${r.model_name} | ${r.summary?.dimension_scores?.correctness?.toFixed(2) || '-'} | ${r.summary?.dimension_scores?.completeness?.toFixed(2) || '-'} | ${r.summary?.dimension_scores?.clarity?.toFixed(2) || '-'} | ${r.performance_summary?.p95_latency_ms || '-'} | ${r.performance_summary?.avg_ttft_ms || '-'} |\n`
        })
        md += `\n`

        md += `## 3. 客观题拆解\n\n`
        md += `| 模型 | 总准确率 | 单选 | 多选 | 判断 | 客观总数 |\n`
        md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`
        report.forEach(r => {
            const b = r.summary?.objective_breakdown || {}
            const fmtPct = (v) => v === null || v === undefined ? '-' : `${(Number(v) * 100).toFixed(1)}%`
            md += `| ${r.model_name} | ${fmtPct(b?.overall?.accuracy)} | ${fmtPct(b?.single_choice?.accuracy)} | ${fmtPct(b?.multiple_choice?.accuracy)} | ${fmtPct(b?.binary?.accuracy)} | ${b?.overall?.total_cases || 0} |\n`
        })
        md += `\n`

        md += `## 4. 成本与令牌消耗\n\n`
        md += `| 模型 | 推理成本USD | 预热成本USD | 总成本USD | 平均输入Tokens | 平均输出Tokens | 总Tokens |\n`
        md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`
        report.forEach(r => {
            md += `| ${r.model_name} | ${r.performance_summary?.inference_cost_usd?.toFixed(6) || '0'} | ${r.performance_summary?.warmup_cost_usd?.toFixed(6) || '0'} | ${r.performance_summary?.total_cost_usd?.toFixed(6) || '0'} | ${r.performance_summary?.avg_prompt_tokens || 0} | ${r.performance_summary?.avg_completion_tokens || 0} | ${r.performance_summary?.total_tokens || 0} |\n`
        })

        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `总体报告_${job.name}_${new Date().getTime()}.md`)
        link.click()
    }

    const handleExportPDF = () => {
        window.print()
    }

    const handleExport = () => {
        if (!details || details.length === 0) return
        const exportedAt = new Date().toLocaleString()
        const fmtPct01 = (v) => {
            if (v === null || v === undefined || Number.isNaN(Number(v))) return ''
            return `${(Number(v) * 100).toFixed(0)}%`
        }
        const sourceLabel = (r) => isRuleAutoScore(r) ? '规则自动判分' : (r.auto_score !== null && r.auto_score !== undefined ? 'AI裁判打分' : '未打分')
        const exportData = details.map(r => ({
            '任务ID': job?.id,
            '任务名称': job?.name || '',
            '导出时间': exportedAt,
            '用例ID': r.case_id,
            '模型': report.find(m => m.model_id === r.model_id)?.model_name || r.model_id,
            '题型': formatQuestionType(r.question_type),
            '题目': r.prompt || '',
            '参考答案': r.reference_answer ? JSON.stringify(r.reference_answer, null, 0) : '',
            '输出内容': r.raw_output || '',
            '判分来源': sourceLabel(r),
            '机器分': r.auto_score ?? '',
            '机器分展示值': isRuleAutoScore(r) ? fmtPct01(r.auto_score) : (r.auto_score ?? ''),
            '机器分说明': isRuleAutoScore(r) ? '客观题规则分：1=正确，0=错误' : 'AI裁判分（0-10）',
            '最终分': r.final_score ?? '',
            '人工分': r.human_score ?? '',
            '打分方式': r.scored_by || '',
            '评审状态': r.review_status || '',
            '审核人': r.reviewer || '',
            '审核评语': r.review_comment || '',
            '规则/AI理由': r.auto_metadata?.reason || r.auto_metadata?.reasoning || (Array.isArray(r.auto_metadata?.reasons) ? r.auto_metadata.reasons.join(' | ') : ''),
            '规则匹配': r.auto_metadata?.match ?? '',
            '规则标准答案': Array.isArray(r.auto_metadata?.correct_answer) ? r.auto_metadata.correct_answer.join(',') : (r.auto_metadata?.correct_answer ?? ''),
            '规则模型答案': Array.isArray(r.auto_metadata?.model_answer) ? r.auto_metadata.model_answer.join(',') : (r.auto_metadata?.model_answer ?? ''),
            '裁判模型': r.judge_model || '',
            '各维度得分': r.dimension_scores ? JSON.stringify(r.dimension_scores) : '',
            '延迟(ms)': r.latency_ms ?? '',
            '首Token延迟TTFT(ms)': r.ttft_ms ?? '',
            'TPS': r.tps ?? '',
            '输入Tokens': r.prompt_tokens ?? '',
            '输出Tokens': r.completion_tokens ?? '',
            '总Tokens': r.total_tokens ?? '',
            '成本USD': r.cost_usd ?? '',
            '错误信息': r.error || '',
        }))
        exportToCSV(exportData, `明细数据_${job?.name || ''}_${new Date().getTime()}.csv`)
    }

    // --- Sub-components (Memoized to prevent ECharts remounting) ---
    const overviewTabContent = useMemo(() => {
        if (!job) return null;
        const hasAnyObjective = Array.isArray(report) && report.some(r => (r.summary?.objective_breakdown?.overall?.total_cases || 0) > 0)
        const hasAnySubjective = Array.isArray(report) && report.some(r => (r.summary?.subjective_summary?.total_cases || 0) > 0)
        const isPureObjective = hasAnyObjective && !hasAnySubjective
        const reportColumns = [
            {
                title: '模型 / 提示词',
                key: 'model_info',
                fixed: 'left',
                width: 200,
                render: (_, r) => (
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{r.model_name}</div>
                        {r.prompt_name && r.prompt_name !== '默认/测试集Prompt' && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                <FileTextOutlined style={{ marginRight: 4 }} />{r.prompt_name}
                            </div>
                        )}
                    </div>
                )
            },
            {
                title: isPureObjective ? '客观准确率' : '综合得分',
                dataIndex: ['summary', 'avg_score'],
                key: 'avg_score',
                width: 100,
                sorter: (a, b) => (a.summary?.avg_score || 0) - (b.summary?.avg_score || 0),
                render: (_, r) => {
                    if (isPureObjective) {
                        const pct = (Number(r.summary?.objective_breakdown?.overall?.accuracy ?? 0) * 100)
                        return <span style={{ fontWeight: 700, color: pct >= 80 ? 'var(--success)' : (pct >= 50 ? 'var(--warning)' : 'var(--error)') }}>{pct.toFixed(1)}%</span>
                    }
                    const s = r.summary?.avg_score
                    return <span style={{ fontWeight: 700, color: s >= 8 ? 'var(--success)' : (s >= 5 ? 'var(--warning)' : 'var(--error)') }}>{s?.toFixed(2) || 'N/A'}</span>
                }
            },
            {
                title: '维度拆解',
                key: 'dim_scores',
                width: 250,
                render: (_, r) => (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {r.summary?.dimension_scores && Object.keys(r.summary.dimension_scores).length > 0 ? Object.entries(r.summary.dimension_scores).map(([dim, score]) => (
                            <Tooltip key={dim} title={`${dimensionMap[dim] || dim}: ${score.toFixed(2)}`}>
                                <Tag bordered={false} style={{ fontSize: 10, margin: 0 }}>
                                    {dimensionMap[dim] || dim.substring(0, 2)}: <b>{score.toFixed(1)}</b>
                                </Tag>
                            </Tooltip>
                        )) : <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>-</span>}
                    </div>
                )
            },
            {
                title: '客观题拆解(总/单/多/判)',
                key: 'objective_breakdown',
                width: 200,
                render: (_, r) => {
                    const breakdown = r.summary?.objective_breakdown
                    const overall = breakdown?.overall?.accuracy
                    const single = breakdown?.single_choice?.accuracy
                    const multi = breakdown?.multiple_choice?.accuracy
                    const binary = breakdown?.binary?.accuracy
                    const totalObjective = breakdown?.overall?.total_cases || 0
                    if (!totalObjective) return <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>-</span>
                    const fmt = (v) => v === null || v === undefined ? '-' : `${(v * 100).toFixed(1)}%`
                    return <span style={{ fontSize: 12 }}>总 {fmt(overall)} / 单 {fmt(single)} / 多 {fmt(multi)} / 判 {fmt(binary)}</span>
                }
            },
            {
                title: '主观题均分',
                key: 'subjective_avg',
                width: 100,
                render: (_, r) => {
                    const avg = r.summary?.subjective_summary?.avg_score
                    if (avg === null || avg === undefined) return <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>-</span>
                    return <span style={{ fontWeight: 700 }}>{Number(avg).toFixed(2)}</span>
                }
            },
            {
                title: '延迟 (Avg/P95)',
                key: 'latency',
                width: 150,
                sorter: (a, b) => (a.performance_summary?.avg_latency_ms || 0) - (b.performance_summary?.avg_latency_ms || 0),
                render: (_, r) => (
                    <div style={{ fontSize: 12 }}>
                        <div><Text strong>{r.performance_summary?.avg_latency_ms || 0}</Text> ms</div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>P95: {r.performance_summary?.p95_latency_ms || '-'} ms</div>
                    </div>
                )
            },
            {
                title: 'TTFT',
                dataIndex: ['performance_summary', 'avg_ttft_ms'],
                key: 'ttft',
                width: 80,
                render: t => <span style={{ fontSize: 12 }}>{t || '-'}ms</span>
            },
            {
                title: 'TPS',
                dataIndex: ['performance_summary', 'avg_tps'],
                key: 'tps',
                width: 70,
                render: t => <Tag color="cyan" style={{ fontSize: 11 }}>{t?.toFixed(1) || '-'}</Tag>
            },
            {
                title: 'Tokens (In/Out)',
                key: 'tokens',
                width: 120,
                render: (_, r) => (
                    <div style={{ fontSize: 11 }}>
                        <div>入: {r.performance_summary?.avg_prompt_tokens || '-'}</div>
                        <div>出: {r.performance_summary?.avg_completion_tokens || '-'}</div>
                    </div>
                )
            },
            {
                title: '成功率',
                key: 'success_rate',
                width: 100,
                render: (_, r) => {
                    const rate = 1 - (r.performance_summary?.error_rate || 0)
                    return (
                        <div style={{ width: '100%' }}>
                            <div style={{ fontSize: 11, marginBottom: 2 }}>{(rate * 100).toFixed(1)}%</div>
                            <Progress percent={rate * 100} size={[60, 4]} showInfo={false} strokeColor={rate === 1 ? 'var(--success)' : (rate > 0.8 ? 'var(--warning)' : 'var(--error)')} />
                        </div>
                    )
                }
            },
            {
                title: '总成本',
                dataIndex: ['performance_summary', 'total_cost_usd'],
                key: 'cost',
                width: 100,
                render: c => <span style={{ fontSize: 12 }}>${c?.toFixed(5) || '0.00'}</span>
            }
        ]

        const bestScore = Math.max(...report.map(x => isPureObjective ? (x.summary?.objective_breakdown?.overall?.accuracy ?? -1) : (x.summary?.avg_score || 0)))
        const minLatency = Math.min(...report.map(x => x.performance_summary?.avg_latency_ms || Infinity))
        const maxTPS = Math.max(...report.map(x => x.performance_summary?.avg_tps || 0))

        return (
            <div className="report-overview">
                <style>{`
                    .report-overview .ant-card-body { padding: 20px; }
                    .metric-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-bottom: 24px; }
                    .best-pill { position: absolute; top: 0; right: 20px; color: #000; padding: 2px 12px; border-radius: 0 0 8px 8px; font-size: 11px; font-weight: 700; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .best-score { background: #fdcb6e; }
                    .best-latency { background: #00cec9; right: 110px; }
                    @media print {
                        .ant-layout-sider, .ant-layout-header, .ant-tabs-nav, .report-actions-bar, .ant-btn { display: none !important; }
                        .ant-layout-content { padding: 0 !important; margin: 0 !important; }
                        .report-overview { padding: 20px; }
                        .stat-card { break-inside: avoid; border: 1px solid #eee !important; margin-bottom: 10px; }
                        .page-card { break-inside: avoid; border: 1px solid #eee !important; margin-top: 20px; }
                    }
                `}</style>

                <div className="report-actions-bar" style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>刷新结果</Button>
                    <Button icon={<BarChartOutlined />} onClick={handleRecompute}>重算报表</Button>
                    <Space size={8}>
                        <Button icon={<FileExcelOutlined />} onClick={handleExportSummaryCSV}>导出 CSV</Button>
                        <Button icon={<FileMarkdownOutlined />} onClick={handleExportMarkdown}>导出 MD</Button>
                        <Button icon={<FilePdfOutlined />} onClick={handleExportPDF} type="primary">导出 PDF</Button>
                    </Space>
                </div>

                {/* Top Highlight Cards */}
                <div className="metric-card-grid">
                    {report.map(r => {
                        const currentMetric = isPureObjective ? (r.summary?.objective_breakdown?.overall?.accuracy ?? -1) : (r.summary?.avg_score || 0)
                        const isBestScore = currentMetric === bestScore && bestScore > 0
                        const isBestLatency = r.performance_summary?.avg_latency_ms === minLatency && minLatency < Infinity

                        return (
                            <Card key={`${r.model_id}_${r.prompt_template_id}`} className="stat-card" variant="borderless" style={{ position: 'relative', border: isBestScore ? '1px solid #fdcb6e' : '1px solid rgba(255,255,255,0.06)' }}>
                                {isBestScore && <div className="best-pill best-score">{isPureObjective ? '🏆 最高准确率' : '🏆 最高评分'}</div>}
                                {isBestLatency && <div className="best-pill best-latency">⚡ 最低延迟</div>}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.model_name}</span>
                                        {r.prompt_name && r.prompt_name !== '默认/测试集Prompt' && (
                                            <div style={{ fontSize: 11, opacity: 0.8, color: 'var(--accent)' }}>模板: {r.prompt_name}</div>
                                        )}
                                    </div>
                                    <Statistic
                                        value={isPureObjective ? (r.summary?.objective_breakdown?.overall?.accuracy || 0) * 100 : (r.summary?.avg_score || 0)}
                                        precision={isPureObjective ? 1 : 2}
                                        suffix={isPureObjective ? '%' : '/ 10'}
                                        valueStyle={{ color: 'var(--success)', fontWeight: 800, fontSize: 28 }}
                                        title={
                                            <Tooltip title={getCompositeScoreHint(r, isPureObjective)}>
                                                <span style={{ color: 'var(--text-secondary)', cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    {isPureObjective ? '客观准确率' : '综合得分'} <QuestionCircleOutlined />
                                                </span>
                                            </Tooltip>
                                        }
                                    />
                                </div>

                                <Row gutter={16}>
                                    <Col span={12}>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>平均延迟 / P95</div>
                                        <div style={{ fontWeight: 600 }}>{r.performance_summary?.avg_latency_ms} / {r.performance_summary?.p95_latency_ms || '-'} ms</div>
                                    </Col>
                                    <Col span={12}>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>平均 TPS / TTFT</div>
                                        <div style={{ fontWeight: 600 }}>{r.performance_summary?.avg_tps?.toFixed(1) || '-'} / {r.performance_summary?.avg_ttft_ms || '-'}ms</div>
                                    </Col>
                                </Row>
                                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
                                    客观题: {(r.summary?.objective_breakdown?.overall?.total_cases || 0)} ｜ 主观题: {(r.summary?.subjective_summary?.total_cases || 0)}
                                </div>
                                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                        用例总数: <span style={{ color: 'var(--text-primary)' }}>{r.summary?.total_cases}</span>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                        估算成本: <span style={{ color: 'var(--text-primary)' }}>${r.performance_summary?.total_cost_usd?.toFixed(5)}</span>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                {/* Summary Table */}
                <Card className="page-card" title="指标对比全览" style={{ marginBottom: 24 }}>
                    <Table
                        dataSource={report}
                        columns={reportColumns}
                        rowKey={r => `${r.model_id}_${r.prompt_template_id}`}
                        pagination={false}
                        size="small"
                        bordered={false}
                    />
                </Card>

                <Row gutter={[20, 20]}>
                    <Col span={12}>
                        <Card className="page-card" title="能力维度分析" style={{ minHeight: 400 }}>
                            <ReactECharts
                                option={radarChartOptions}
                                style={{ height: 350, width: '100%' }}
                                opts={{ renderer: 'svg' }}
                            />
                        </Card>
                    </Col>
                    <Col span={12}>
                        <Card className="page-card" title="性能指标对比" style={{ minHeight: 400 }}>
                            <ReactECharts
                                option={performanceChartOptions}
                                style={{ height: 350, width: '100%' }}
                                opts={{ renderer: 'svg' }}
                            />
                        </Card>
                    </Col>
                </Row>
            </div>
        )
    }, [job, report, progress, loading])

    const comparisonTabContent = useMemo(() => {
        if (!details || details.length === 0) return (
            <div style={{ padding: '60px 0' }}>
                <Empty description="暂无明细数据，请等待评测开始" />
            </div>
        )

        // Group results by case_id
        const casesMap = {}
        details.forEach(r => {
            if (!casesMap[r.case_id]) {
                casesMap[r.case_id] = {
                    case_id: r.case_id,
                    prompt: r.prompt,
                    reference: r.reference_answer,
                    results: {} // keyed by modelId_promptId
                }
            }
            const key = `${r.model_id}_${r.prompt_template_id || 0}`
            casesMap[r.case_id].results[key] = r
        })

        const caseList = Object.values(casesMap).sort((a, b) => a.case_id - b.case_id)

        // Get unique model/prompt combinations in this job
        const configs = []
        report.forEach(r => {
            configs.push({
                key: `${r.model_id}_${r.prompt_template_id || 0}`,
                modelName: r.model_name,
                promptName: r.prompt_name
            })
        })

        const comparisonCols = [
            {
                title: (
                    <div style={{ padding: '8px 0', display: 'flex', alignItems: 'center' }}>
                        <Text strong style={{ fontSize: 13 }}>题目明细 & 输入</Text>
                        <Tooltip title="展示测试集中的原始问题。点击下方卡片可查看完整长文本。">
                            <QuestionCircleOutlined style={{ marginLeft: 6, fontSize: 12, color: 'var(--text-secondary)' }} />
                        </Tooltip>
                    </div>
                ),
                fixed: 'left',
                width: 280,
                render: (_, item) => (
                    <div className="case-col-cell">
                        <div className="cell-header">
                            <Badge count={item.case_id} style={{ backgroundColor: '#1890ff' }} />
                        </div>
                        <div className="case-prompt-text">
                            {item.prompt}
                        </div>
                    </div>
                )
            },
            ...configs.map(cfg => ({
                title: (
                    <div className="premium-header-cell">
                        <Tooltip title="待测大模型名称">
                            <div className="model-badge">
                                <RobotOutlined /> {cfg.modelName}
                            </div>
                        </Tooltip>
                        <Tooltip title="该列结果对应的提示词模板">
                            <div className="prompt-badge">
                                <FileTextOutlined /> {cfg.promptName || '默认'}
                            </div>
                        </Tooltip>
                    </div>
                ),
                width: 400,
                render: (_, item) => {
                    const res = item.results[cfg.key]
                    if (!res) return <div className="no-data-cell">未执行</div>
                    const isObjectiveScore = isRuleAutoScore(res)
                    const rawScore = res.final_score ?? res.auto_score
                    const hasScore = rawScore !== null && rawScore !== undefined
                    const normalizedScore = hasScore ? Number(rawScore) : null
                    const scoreScale10 = hasScore ? (isObjectiveScore ? normalizedScore * 10 : normalizedScore) : null
                    const scoreColor = !hasScore ? '#8c8c8c' : (scoreScale10 >= 8 ? '#52c41a' : (scoreScale10 >= 5 ? '#faad14' : '#ff4d4f'))
                    const scoreText = !hasScore
                        ? '-'
                        : (isObjectiveScore && normalizedScore <= 1
                            ? `${(normalizedScore * 100).toFixed(0)}%`
                            : `${normalizedScore.toFixed(2).replace(/\.00$/, '')}`)
                    const scoreUnit = isObjectiveScore ? '客观' : '分'
                    const reasonTitle = isObjectiveScore ? '判定理由：' : 'AI 评语：'
                    const objectiveExplainText = hasScore
                        ? `该分来自客观题规则自动判分（1=正确，0=错误），已换算为${scoreText}展示。`
                        : '该分来自客观题规则自动判分（1=正确，0=错误）。'

                    return (
                        <div className="comparison-result-card">
                            <div className="cell-header">
                                <div className="score-indicator" style={{ borderLeft: `4px solid ${scoreColor}` }}>
                                    <span className="score-value">{scoreText}</span>
                                    {isObjectiveScore ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            <span className="score-label">{scoreUnit}</span>
                                            <Tooltip title={objectiveExplainText}>
                                                <QuestionCircleOutlined style={{ color: 'var(--text-secondary)', cursor: 'help', fontSize: 12 }} />
                                            </Tooltip>
                                        </span>
                                    ) : (
                                        <span className="score-label">{scoreUnit}</span>
                                    )}
                                </div>
                                <Space className="metrics-group">
                                    <Tooltip title="首字延迟 (TTFT)">
                                        <span className="metric-item">
                                            <ThunderboltOutlined style={{ color: '#fa8c16' }} /> {res.ttft_ms || '-'}ms
                                        </span>
                                    </Tooltip>
                                    <Tooltip title="总耗时">
                                        <span className="metric-item">
                                            <ClockCircleOutlined /> {res.latency_ms}ms
                                        </span>
                                    </Tooltip>
                                </Space>
                                <div className="output-actions">
                                    <Tooltip title="复制内容">
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<CopyOutlined />}
                                            onClick={() => handleCopy(res.raw_output)}
                                        />
                                    </Tooltip>
                                    <Tooltip title="全屏查看">
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<FullscreenOutlined />}
                                            onClick={() => setPreviewContent(res.raw_output)}
                                        />
                                    </Tooltip>
                                </div>
                            </div>

                            <div className="output-container">
                                <div className="output-text">
                                    {res.raw_output || <span style={{ opacity: 0.3 }}>无输出内容</span>}
                                </div>
                            </div>

                            {(res.auto_metadata?.reasons || res.auto_metadata?.reason || res.auto_metadata?.reasoning) && (
                                <div className="reason-box">
                                    <div className="reason-header">{reasonTitle}</div>
                                    <div className="reason-content">
                                        {res.auto_metadata.reasons && res.auto_metadata.judges
                                            ? res.auto_metadata.reasons.map((reason, idx) => (
                                                <div key={idx} style={{ marginBottom: idx === res.auto_metadata.reasons.length - 1 ? 0 : 12 }}>
                                                    {res.auto_metadata.judges.length > 1 && (
                                                        <div style={{ fontWeight: 600, marginBottom: 2, fontSize: '11px' }}>
                                                            【{formatJudgeName(res.auto_metadata.judges[idx])}】
                                                        </div>
                                                    )}
                                                    {reason}
                                                </div>
                                            ))
                                            : (res.auto_metadata.reason || res.auto_metadata.reasoning)}
                                    </div>

                                </div>
                            )}
                        </div>
                    )
                }
            }))
        ]

        return (
            <div className="comparison-view-container">
                <style>{`
                    .comparison-view-container {
                        margin-top: 16px;
                    }
                    .comparison-view-container .ant-table {
                        background: transparent;
                    }
                    .comparison-view-container .ant-table-thead > tr > th {
                        background: rgba(250, 250, 250, 0.8) !important;
                        backdrop-filter: blur(8px);
                        border-bottom: 2px solid #f0f0f0;
                        padding: 12px 16px !important;
                    }
                    .comparison-view-container .ant-table-tbody > tr > td {
                        vertical-align: top !important;
                        padding: 16px 12px !important;
                    }
                    .premium-header-cell {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    .model-badge {
                        background: #e6f7ff;
                        color: #1890ff;
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-weight: 600;
                        font-size: 13px;
                        display: inline-block;
                        width: fit-content;
                        border: 1px solid #91d5ff;
                    }
                    .prompt-badge {
                        background: #f6ffed;
                        color: #52c41a;
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        display: inline-block;
                        width: fit-content;
                        border: 1px solid #b7eb8f;
                    }
                    .case-col-cell {
                        padding: 4px;
                    }
                    .case-prompt-text {
                        font-size: 13px;
                        line-height: 1.6;
                        color: #262626;
                        max-height: 500px;
                        overflow-y: auto;
                        whiteSpace: pre-wrap;
                        background: #fafafa;
                        padding: 10px;
                        border-radius: 8px;
                        border: 1px solid #f0f0f0;
                    }
                    .comparison-result-card {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                        padding: 4px;
                    }
                    .cell-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        height: 32px;
                        margin-bottom: 8px;
                    }
                    .score-indicator {
                        padding: 2px 10px;
                        background: #fafafa;
                        border-radius: 0 4px 4px 0;
                    }
                    .score-value {
                        font-size: 20px;
                        font-weight: 700;
                        margin-right: 2px;
                    }
                    .score-label {
                        font-size: 12px;
                        color: #8c8c8c;
                    }
                    .metrics-group {
                        font-size: 12px;
                        color: #8c8c8c;
                    }
                    .metric-item {
                        background: #f5f5f5;
                        padding: 2px 8px;
                        border-radius: 12px;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .output-container {
                        position: relative;
                        background: #fff;
                        border: 1px solid #e8e8e8;
                        border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.02);
                    }
                    .output-text {
                        padding: 12px;
                        font-size: 13px;
                        line-height: 1.8;
                        max-height: 600px;
                        overflow-y: auto;
                        white-space: pre-wrap;
                        color: #434343;
                    }
                    .output-actions {
                        display: flex;
                        gap: 4px;
                    }
                    .reason-box {
                        background: #fffbe6;
                        border-left: 3px solid #ffe58f;
                        padding: 8px 12px;
                        border-radius: 0 4px 4px 0;
                    }
                    .reason-header {
                        font-size: 11px;
                        font-weight: 600;
                        color: #856404;
                        margin-bottom: 4px;
                    }
                    .reason-content {
                        font-size: 12px;
                        color: #856404;
                        line-height: 1.5;
                    }
                    .no-data-cell {
                        text-align: center;
                        padding: 40px 0;
                        color: #bfbfbf;
                        font-style: italic;
                    }
                `}</style>

                <Table
                    dataSource={caseList}
                    columns={comparisonCols}
                    rowKey="case_id"
                    scroll={{ y: 'calc(100vh - 280px)' }}
                    pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '15', '20', '50', '100'] }}
                    size="middle"
                    bordered={false}
                />

                <Modal
                    title="模型完整输出详情"
                    open={!!previewContent}
                    onCancel={() => setPreviewContent(null)}
                    footer={[
                        <Button key="copy" type="primary" onClick={() => handleCopy(previewContent)}>复制内容</Button>,
                        <Button key="close" onClick={() => setPreviewContent(null)}>关闭</Button>
                    ]}
                    width={800}
                >
                    <div style={{
                        background: '#f5f5f5',
                        padding: '16px',
                        borderRadius: '8px',
                        maxHeight: '60vh',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.8,
                        fontSize: '14px'
                    }}>
                        {previewContent}
                    </div>
                </Modal>
            </div>
        )
    }, [details, report, job])

    const detailsTabContent = useMemo(() => (
        <div>
            <div style={{ marginBottom: 16, display: 'flex', gap: 12, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                    <Button icon={<SyncOutlined />} onClick={loadData}>刷新数据</Button>
                    <Button
                        type="primary"
                        onClick={() => {
                            setBatchEnableObjectiveAutoScore(job?.config_snapshot?.enable_objective_auto_score !== false)
                            setBatchIgnoreCase(job?.config_snapshot?.ignore_case !== false)
                            setBatchScoreModalOpen(true)
                        }}
                    >
                        AI裁判批量打分
                    </Button>
                </div>
                <Button icon={<DownloadOutlined />} onClick={handleExport}>导出 CSV</Button>
            </div>
            <Table dataSource={details} columns={[
                { title: '序号', width: 60, render: (_, __, i) => i + 1 },
                { title: 'ID', dataIndex: 'case_id', width: 60 },
                { title: '模型', dataIndex: 'model_id', width: 80, render: id => getModelName(id) },
                { title: '提示词模板', width: 100, render: (_, r) => getPromptName(r), ellipsis: true },
                {
                    title: '题型', dataIndex: 'question_type', width: 88,
                    render: t => <Tag color="gold">{formatQuestionType(t)}</Tag>
                },
                {
                    title: '题目', dataIndex: 'prompt', width: 200, ellipsis: true,
                    render: t => <span style={{ color: 'var(--text-primary)' }}>{t || '-'}</span>
                },
                {
                    title: '输出预览', dataIndex: 'raw_output', ellipsis: true,
                    render: t => <span style={{ color: 'var(--text-secondary)' }}>{t || '-'}</span>
                },
                {
                    title: '机器分', dataIndex: 'auto_score', width: 70,
                    render: (s, r) => (s !== null && s !== undefined)
                        ? (
                            <Tooltip title={getScoreSourceLabel(r)}>
                                <Tag color={isRuleAutoScore(r) ? 'geekblue' : 'processing'}>{s}</Tag>
                            </Tooltip>
                        )
                        : '-'
                },
                {
                    title: '最终分', dataIndex: 'final_score', width: 70,
                    render: (s, r) => s !== null ? <Tag color={r.scored_by === 'human' ? 'success' : 'default'}>{s}</Tag> : '-'
                },
                {
                    title: '延迟', dataIndex: 'latency_ms', width: 80,
                    render: t => t ? `${t}ms` : '-'
                },
                {
                    title: '状态', dataIndex: 'review_status', width: 70,
                    render: s => s === 'pending' ? <Tag color="warning">待审</Tag> : <Tag color="success">已审</Tag>
                },
                {
                    title: '操作', width: 120,
                    render: (_, r) => (
                        <Button type="link" size="small" onClick={() => { setActiveResult(r); setDrawerOpen(true); }}>
                            详情/人工打分
                        </Button>
                    )
                }
            ]} rowKey="id" size="small" pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '15', '20', '50', '100'] }} />
        </div>
    ), [details, report])

    const logTerminalContent = <Terminal />

    const batchScoring = job?.config_snapshot?.batch_scoring
    const isBatchScoringRunning = batchScoring?.status === 'running'

    const tabsItems = useMemo(() => [
        { key: 'overview', label: '总体报告', children: overviewTabContent },
        {
            key: 'comparison',
            label: (
                <span>
                    并排对比 (A/B Test)
                    <Tooltip title="查看不同模型对同一题目的回答分布，支持横向直观对比输出质量与性能差异。">
                        <QuestionCircleOutlined style={{ marginLeft: 4, fontSize: 13 }} />
                    </Tooltip>
                </span>
            ),
            children: comparisonTabContent
        },
        { key: 'details', label: '详细结果', children: detailsTabContent },
        { key: 'logs', label: '运行日志 (Real-time)', children: logTerminalContent },
        {
            key: 'config',
            label: '任务配置',
            children: (
                <div>
                    <Card className="page-card" style={{ marginBottom: 12 }}>
                        <Space>
                            <Text strong>客观题忽略大小写:</Text>
                            <Tag color={(job?.config_snapshot?.ignore_case ?? true) ? 'success' : 'default'}>
                                {(job?.config_snapshot?.ignore_case ?? true) ? '开启' : '关闭'}
                            </Tag>
                        </Space>
                    </Card>
                    <pre style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', padding: 16, borderRadius: 8 }}>{JSON.stringify(job?.config_snapshot, null, 2)}</pre>
                </div>
            )
        }
    ], [overviewTabContent, comparisonTabContent, detailsTabContent, logTerminalContent, job?.config_snapshot])

    if (!job) return null

    // --- Render ---
    return (
        <div className="fade-in">
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} type="text" style={{ color: 'var(--text-primary)' }} />
                <h2 style={{ margin: 0 }}>任务: {job.name}</h2>
                <Tag color={statusConfig[job.status].color}>{statusConfig[job.status].text}</Tag>
            </div>

            <Card className="page-card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span>整体进度</span>
                            <span>{progress?.processed_cases || 0} / {job.total_cases}</span>
                        </div>
                        <Progress
                            percent={progress?.progress_pct || 0}
                            status={job.status === 'failed' ? 'exception' : 'active'}
                            strokeColor={{ '0%': '#6C5CE7', '100%': '#00cec9' }}
                        />
                    </div>
                    <Statistic title="成功用例" value={progress?.success_count || 0} valueStyle={{ color: '#00b894' }} />
                    <Statistic
                        title="累计用时"
                        value={job.duration_seconds || 0}
                        suffix="s"
                        valueStyle={{ color: 'var(--accent)' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {job.status === 'running' && (
                            <Button type="default" icon={<ClockCircleOutlined />} onClick={handlePause}>
                                暂停任务
                            </Button>
                        )}
                        {job.status === 'paused' && (
                            <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleResume}>
                                继续任务
                            </Button>
                        )}
                        {progress?.failure_count > 0 && ['completed', 'failed', 'cancelled'].includes(job.status) && (
                            <Button type="primary" danger onClick={handleRetryFailed}>
                                一键重试失败项
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            <Tabs items={tabsItems} />

            {/* Preview Modal */}
            <Modal
                title="模型完整输出详情"
                open={!!previewContent}
                onCancel={() => setPreviewContent(null)}
                footer={[
                    <Button key="copy" type="primary" onClick={() => handleCopy(previewContent)}>复制内容</Button>,
                    <Button key="close" onClick={() => setPreviewContent(null)}>关闭</Button>
                ]}
                width={800}
            >
                <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', maxHeight: '60vh', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '14px' }}>
                    {previewContent}
                </div>
            </Modal>

            {/* Manual Review Drawer */}
            <Drawer
                title="结果详情与人工审核"
                width={700}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
            >
                {activeResult && (() => {
                    // Find active index
                    const currentIndex = details.findIndex(r => r.id === activeResult.id)
                    const hasPrev = currentIndex > 0
                    const hasNext = currentIndex < details.length - 1
                    const objectiveReview = isObjectiveQuestion(activeResult)
                    const machineScore = activeResult.auto_score

                    const onApprove = (direction) => {
                        handleReviewSave(activeResult.id, reviewScore, reviewComment, () => {
                            if (direction === 'prev' && hasPrev) setActiveResult(details[currentIndex - 1])
                            else if (direction === 'next' && hasNext) setActiveResult(details[currentIndex + 1])
                            else setDrawerOpen(false)
                        })
                    }

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {/* Human Review (Moved to top) */}
                            <div style={{ padding: 24, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--accent)' }}>
                                <h3 style={{ marginBottom: 16 }}>人工复核</h3>
                                <div style={{ marginBottom: 10, color: 'var(--text-secondary)', fontSize: 12 }}>
                                    {objectiveReview
                                        ? `当前为客观题复核：1=正确，0=错误。默认已带入机器分${machineScore !== null && machineScore !== undefined ? `（${machineScore}）` : ''}。`
                                        : '当前为主观题复核：默认带入机器分，可在此基础上人工调整。'}
                                </div>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                                    <span>最终打分: </span>
                                    <InputNumber
                                        min={0}
                                        max={10}
                                        step={0.5}
                                        value={reviewScore}
                                        onChange={v => setReviewScore(v)}
                                    />
                                    {objectiveReview && (
                                        <Space size={8}>
                                            <Button size="small" onClick={() => setReviewScore(1)}>判定正确(1)</Button>
                                            <Button size="small" onClick={() => setReviewScore(0)}>判定错误(0)</Button>
                                            {machineScore !== null && machineScore !== undefined && (
                                                <Button size="small" type="dashed" onClick={() => setReviewScore(machineScore)}>采用机器分</Button>
                                            )}
                                        </Space>
                                    )}
                                </div>
                                <Input.TextArea
                                    rows={3}
                                    placeholder="选填: 评语或理由"
                                    value={reviewComment}
                                    onChange={e => setReviewComment(e.target.value)}
                                    style={{ marginBottom: 16 }}
                                />
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    <Button type="primary" onClick={() => onApprove()}>
                                        确认修改并审核
                                    </Button>
                                    <Button type="default" onClick={() => onApprove('prev')} disabled={!hasPrev}>
                                        确认并审批上一题
                                    </Button>
                                    <Button type="default" onClick={() => onApprove('next')} disabled={!hasNext}>
                                        确认并审批下一题
                                    </Button>
                                </div>
                            </div>

                            {/* Details (Moved below) */}
                            <Descriptions column={1} bordered size="small" labelStyle={{ width: 120 }}>
                                <Descriptions.Item label="原始问题">
                                    <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)', fontWeight: 500 }}>
                                        {activeResult.prompt || '-'}
                                    </div>
                                </Descriptions.Item>
                                <Descriptions.Item label="参考答案">
                                    <div style={{ whiteSpace: 'pre-wrap', color: 'var(--success)' }}>
                                        {activeResult.reference_answer ? JSON.stringify(activeResult.reference_answer, null, 2) : '-'}
                                    </div>
                                </Descriptions.Item>
                                <Descriptions.Item label="模型">{getModelName(activeResult.model_id)}</Descriptions.Item>
                                <Descriptions.Item label="提示词模板">{getPromptName(activeResult)}</Descriptions.Item>
                                <Descriptions.Item label={
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        判分来源
                                        <Tooltip title={isRuleAutoScore(activeResult) ? "规则自动判分：1=正确，0=错误；前端可换算显示为100%或0%。" : "AI裁判打分：由裁判模型根据评分标准给出0-10分。"}>
                                            <QuestionCircleOutlined style={{ color: 'var(--text-secondary)', cursor: 'help' }} />
                                        </Tooltip>
                                    </span>
                                }>
                                    {activeResult.auto_score !== null && activeResult.auto_score !== undefined
                                        ? <Tag color={isRuleAutoScore(activeResult) ? 'geekblue' : 'processing'}>{getScoreSourceLabel(activeResult)}</Tag>
                                        : '-'}
                                </Descriptions.Item>
                                <Descriptions.Item label={
                                    <span style={{ display: 'flex', alignItems: 'center' }}>
                                        机器分数
                                        <Tooltip title={isRuleAutoScore(activeResult) ? "该分数来自客观题规则自动判分：1=正确，0=错误（不是AI主观评分）。" : "该分数来自 AI 裁判自动评分。"}>
                                            <QuestionCircleOutlined style={{ marginLeft: 4, color: 'var(--text-secondary)', cursor: 'help' }} />
                                        </Tooltip>
                                    </span>
                                }>
                                    <Space direction="vertical" size={2}>
                                        <Tag color="processing" style={{ fontSize: '14px', fontWeight: 600 }}>
                                            {activeResult.auto_score !== null && activeResult.auto_score !== undefined ? activeResult.auto_score : '无'}
                                        </Tag>
                                        {activeResult.auto_metadata?.judge_scores && activeResult.auto_metadata.judge_scores.length > 1 && (
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 4 }}>
                                                (
                                                {activeResult.auto_metadata.judges.map((name, idx) => (
                                                    <span key={idx}>
                                                        {formatJudgeName(name)}: {activeResult.auto_metadata.judge_scores[idx]}
                                                        {idx < activeResult.auto_metadata.judges.length - 1 ? ' | ' : ''}
                                                    </span>
                                                ))}
                                                )
                                            </div>
                                        )}
                                    </Space>
                                </Descriptions.Item>

                                <Descriptions.Item label={
                                    <span style={{ display: 'flex', alignItems: 'center' }}>
                                        各维度得分
                                        <Tooltip title="AI 裁判根据预设的各个具体评测维度（如准确性、流畅度、逻辑性等）分别给出的单项分数。">
                                            <InfoCircleOutlined style={{ marginLeft: 4, color: 'var(--text-secondary)' }} />
                                        </Tooltip>
                                    </span>
                                }>
                                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                            {activeResult.dimension_scores && Object.keys(activeResult.dimension_scores).length > 0
                                                ? Object.entries(activeResult.dimension_scores).map(([k, v]) => <Tag key={k} color="blue">{dimensionMap[k] || k}: {v}</Tag>)
                                                : '无'}
                                        </div>
                                        {activeResult.auto_metadata?.judge_dimension_scores && activeResult.auto_metadata.judge_dimension_scores.length > 1 && (
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '6px 10px', borderRadius: 4 }}>
                                                {activeResult.auto_metadata.judges.map((name, idx) => (
                                                    <div key={idx} style={{ marginBottom: idx === activeResult.auto_metadata.judges.length - 1 ? 0 : 4 }}>
                                                        <span style={{ fontWeight: 600 }}>{formatJudgeName(name)}:</span>
                                                        {Object.entries(activeResult.auto_metadata.judge_dimension_scores[idx]).map(([k, v], i) => (
                                                            <span key={k} style={{ marginLeft: 8 }}>
                                                                {dimensionMap[k] || k}: {v}
                                                                {i < Object.keys(activeResult.auto_metadata.judge_dimension_scores[idx]).length - 1 ? ' |' : ''}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </Space>
                                </Descriptions.Item>

                                <Descriptions.Item label={activeResult.auto_metadata?.judges?.length > 0 ? `${activeResult.auto_metadata.judges.map(formatJudgeName).join(', ')} 评分理由` : "AI评分理由"}>
                                    <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                                        {activeResult.auto_metadata?.reasons && activeResult.auto_metadata.judges
                                            ? activeResult.auto_metadata.reasons.map((reason, idx) => (
                                                <div key={idx} style={{ marginBottom: idx === activeResult.auto_metadata.reasons.length - 1 ? 0 : 16 }}>
                                                    {activeResult.auto_metadata.judges.length > 1 && (
                                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                                                            【{formatJudgeName(activeResult.auto_metadata.judges[idx])} 评价】
                                                        </div>
                                                    )}
                                                    {reason}
                                                </div>
                                            ))
                                            : (activeResult.auto_metadata?.reason || activeResult.auto_metadata?.reasoning || '无')}
                                    </div>
                                </Descriptions.Item>

                                <Descriptions.Item label="模型原始输出">
                                    <div style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: 12, borderRadius: 4, border: '1px solid var(--border)' }}>
                                        {activeResult.raw_output || '<无输出>'}
                                    </div>
                                </Descriptions.Item>
                                <Descriptions.Item label="错误信息">
                                    {activeResult.error ? <span style={{ color: '#ff7675' }}>{activeResult.error}</span> : '-'}
                                </Descriptions.Item>
                                <Descriptions.Item label={
                                    <span style={{ display: 'flex', alignItems: 'center' }}>
                                        性能指标
                                        <Tooltip styles={{ body: { width: 300 } }} title={
                                            <div>
                                                <b>首Token延迟 (TTFT)</b>: 从发出请求到大模型返回第一个字所需的时间。<br />
                                                <b>总延迟</b>: 整个请求完成的总耗时。<br />
                                                <b>TPS</b>: 每秒生成的 Token 数量 (Tokens Per Second)，反映大模型的长文生成实时速度。<br />
                                                <b>Tokens</b>: 包含输入(Prompt)的耗费，以及输出(Completion)的耗费。<br />
                                                <b>估算成本</b>: 结合所测官方模型的单价算出的本次单挑请求耗费金额。
                                            </div>
                                        }>
                                            <InfoCircleOutlined style={{ marginLeft: 4, color: 'var(--text-secondary)' }} />
                                        </Tooltip>
                                    </span>
                                }>
                                    <Row gutter={[16, 8]}>
                                        <Col span={8}><span style={{ color: 'var(--text-secondary)' }}>首Token延迟 (TTFT):</span> {activeResult.ttft_ms ? `${activeResult.ttft_ms}ms` : '-'}</Col>
                                        <Col span={8}><span style={{ color: 'var(--text-secondary)' }}>总延迟:</span> {activeResult.latency_ms ? `${activeResult.latency_ms}ms` : '-'}</Col>
                                        <Col span={8}><span style={{ color: 'var(--text-secondary)' }}>TPS:</span> {activeResult.tps ? activeResult.tps.toFixed(2) : '-'}</Col>
                                        <Col span={8}><span style={{ color: 'var(--text-secondary)' }}>输入Tokens:</span> {activeResult.prompt_tokens || '-'}</Col>
                                        <Col span={8}><span style={{ color: 'var(--text-secondary)' }}>输出Tokens:</span> {activeResult.completion_tokens || '-'}</Col>
                                        <Col span={8}><span style={{ color: 'var(--text-secondary)' }}>总Tokens:</span> {activeResult.total_tokens || '-'}</Col>
                                        <Col span={12}><span style={{ color: 'var(--text-secondary)' }}>估算成本 (美元):</span> {activeResult.cost_usd ? `$${activeResult.cost_usd.toFixed(6)}` : '-'}</Col>
                                    </Row>
                                </Descriptions.Item>
                            </Descriptions>
                        </div>
                    )
                })()}
            </Drawer>

            {/* Batch AI Score Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        触发AI裁判打分
                        <Tooltip
                            styles={{ body: { width: 450, fontWeight: 'normal' } }}
                            title={
                                <div style={{ fontSize: 13 }}>
                                    <b>后台默认的裁判打分 Prompt：</b>
                                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: 4, marginTop: 4, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                        请作为一名客观、严谨的AI裁判，对大模型的回答进行全方位打分。<br /><br />
                                        [用户原始问题] ...<br />
                                        [参考标准答案] ...<br />
                                        [待评分的模型回答] ...<br /><br />
                                        请根据回答的正确性、完整性、清晰度进行评分，总分10分。<br />
                                        你必须返回严格的JSON格式...分别对 correctness, completeness, clarity 打分，并给出 reason。
                                    </div>
                                </div>
                            }
                        >
                            <InfoCircleOutlined style={{ marginLeft: 6, fontSize: 14, color: 'var(--text-secondary)', cursor: 'help' }} />
                        </Tooltip>
                    </div>
                }
                open={batchScoreModalOpen}
                confirmLoading={batchScoreLoading}
                onOk={handleBatchAIScore}
                onCancel={() => setBatchScoreModalOpen(false)}
                okButtonProps={{ disabled: isBatchScoringRunning }}
                okText={isBatchScoringRunning ? '打分进行中...' : '确定'}
            >
                <div style={{ padding: '20px 0' }}>
                    {isBatchScoringRunning ? (
                        <div style={{ textAlign: 'center', padding: '10px 0' }}>
                            <SyncOutlined spin style={{ fontSize: 28, color: 'var(--primary)', marginBottom: 16 }} />
                            <h3 style={{ marginBottom: 16 }}>有一条 AI 裁判批量打分正在进行中</h3>
                            <div style={{ marginBottom: 8 }}>进度: {batchScoring.current} / {batchScoring.total} 用例</div>
                            <Progress
                                percent={Math.round((batchScoring.current / batchScoring.total) * 100) || 0}
                                status="active"
                                strokeColor={{ '0%': '#6C5CE7', '100%': '#00cec9' }}
                            />
                            <p style={{ marginTop: 24, color: 'var(--text-secondary)' }}>请稍后刷新查看最新结果。正在后台打分中，您可关闭此窗口。</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ marginBottom: 8 }}>请选择打分范围:</div>
                                <Radio.Group value={batchScoreScope} onChange={e => setBatchScoreScope(e.target.value)}>
                                    <Radio value="pending_no_score">待审且无机器分</Radio>
                                    <Radio value="no_score">所有无机器分</Radio>
                                    <Radio value="all">全部重新打分</Radio>
                                </Radio.Group>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ marginBottom: 8 }}>请选择裁判模型:</div>
                                <Select
                                    mode="multiple"
                                    style={{ width: '100%' }}
                                    placeholder="选择一个或多个模型作为裁判"
                                    value={selectedJudgeIds}
                                    onChange={setSelectedJudgeIds}
                                    options={judgeModels.map(m => ({ label: m.name, value: m.id }))}
                                />
                            </div>
                            <div>
                                <Checkbox checked={batchRequireHumanReview} onChange={e => setBatchRequireHumanReview(e.target.checked)}>
                                    打分后需要人工审核（否则直接标记为已审）
                                </Checkbox>
                            </div>
                            <div style={{ marginTop: 12 }}>
                                <Checkbox checked={batchEnableObjectiveAutoScore} onChange={e => setBatchEnableObjectiveAutoScore(e.target.checked)}>
                                    开启客观题自动判分（单选/多选/判断优先规则判分）
                                </Checkbox>
                            </div>
                            <div style={{ marginTop: 12 }}>
                                <Checkbox checked={batchIgnoreCase} onChange={e => setBatchIgnoreCase(e.target.checked)}>
                                    客观题忽略大小写（C 与 c 视为一致）
                                </Checkbox>
                            </div>
                            <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                                <InfoCircleOutlined style={{ marginRight: 4 }} />
                                点击确认后系统将在后台初始化队列。在任务开始前，按钮可能会有短暂的加载状态，一旦后台创建成功将自动进入进度条界面。
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    )
}
