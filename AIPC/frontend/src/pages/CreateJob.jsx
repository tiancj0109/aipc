import React, { useState, useEffect } from 'react'
import { Card, Steps, Form, Input, Button, Select, Switch, Space, InputNumber, Divider, message, Result, Row, Col, Tooltip, Modal } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getModels, getTestSuites, getPromptTemplates, createJob } from '../api'

const { Step } = Steps

export default function CreateJob() {
    const navigate = useNavigate()
    const [current, setCurrent] = useState(0)
    const [form] = Form.useForm()
    const [models, setModels] = useState([])
    const [suites, setSuites] = useState([])
    const [templates, setTemplates] = useState([])
    const [loading, setLoading] = useState(false)
    const [createdJobId, setCreatedJobId] = useState(null)
    const [scoringGuideOpen, setScoringGuideOpen] = useState(false)

    useEffect(() => {
        Promise.all([
            getModels({ status: 1, limit: 100 }).then(res => setModels(res.data)),
            getTestSuites({ limit: 100 }).then(res => setSuites(res.data)),
            getPromptTemplates({ limit: 100 }).then(res => setTemplates(res.data))
        ]).catch(() => message.error('加载基础数据失败'))
    }, [])

    async function next() {
        try {
            await form.validateFields()
            setCurrent(current + 1)
        } catch { /* Validation failed */ }
    }

    function prev() {
        setCurrent(current - 1)
    }

    function handleFormValuesChange(changedValues, allValues) {
        if (Object.prototype.hasOwnProperty.call(changedValues, 'enable_ai_judge')) {
            if (!changedValues.enable_ai_judge) {
                form.setFieldsValue({
                    require_human_review: true,
                    warmup_judge_models: false,
                    judge_model_ids: undefined,
                })
            } else {
                form.setFieldsValue({
                    require_human_review: allValues.require_human_review !== false,
                    warmup_judge_models: allValues.warmup_judge_models !== false,
                })
            }
        }
        if (Object.prototype.hasOwnProperty.call(changedValues, 'enable_temperature') && !changedValues.enable_temperature) {
            form.setFieldsValue({ temperature: undefined })
        }
    }

    async function handleSubmit() {
        try {
            const values = await form.validateFields()
            setLoading(true)

            // Set default toggle values if they are undefined
            const payload = {
                ...values,
                enable_ai_judge: values.enable_ai_judge || false,
                require_human_review: values.enable_ai_judge ? (values.require_human_review !== false) : true,
                enable_objective_auto_score: values.enable_objective_auto_score !== false,
                ignore_case: values.ignore_case !== false,
                enable_warmup: values.enable_warmup !== false,
                warmup_judge_models: values.enable_ai_judge ? (values.warmup_judge_models !== false) : false,
                collect_performance: values.collect_performance !== false,
                enable_ttft: values.enable_ttft !== false,
                enable_temperature: values.enable_temperature !== false
            }
            if (!payload.enable_temperature) delete payload.temperature

            const res = await createJob(payload)
            setCreatedJobId(res.data.id)
            setCurrent(current + 1)
        } catch (e) {
            if (e.response) message.error(e.response.data.detail || '提交失败')
        } finally {
            setLoading(false)
        }
    }

    const steps = [
        {
            title: '基本配置',
            content: (
                <div style={{ maxWidth: 600, margin: '0 auto', paddingTop: 24 }}>
                    <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
                        <Input placeholder="如 GPT-4 vs Claude-3 MMLU 对比评测" size="large" />
                    </Form.Item>
                    <Form.Item name="model_ids" label="选择待测模型" rules={[{ required: true, message: '请至少选择一个模型' }]}>
                        <Select
                            mode="multiple"
                            placeholder="选择一个或多个已启用的模型"
                            options={models.map(m => ({ label: `${m.name} (${m.provider})`, value: m.id }))}
                            size="large"
                        />
                    </Form.Item>
                    <Form.Item name="suite_id" label="选择测试集" rules={[{ required: true }]}>
                        <Select
                            placeholder="选择测试集"
                            options={suites.map(s => ({ label: `${s.name} (共 ${s.total_cases} 题)`, value: s.id }))}
                            size="large"
                        />
                    </Form.Item>
                    <Form.Item name="prompt_template_ids" label="Prompt模板 (可选 A/B 测试)" tooltip="选择多个模板将自动对模型进行 A/B 测试对比（每个模型都会使用所有选中的特征词跑一遍）">
                        <Select
                            allowClear
                            mode="multiple"
                            placeholder="如果不选，则直接使用测试集中的prompt"
                            options={templates.map(t => ({ label: t.name, value: t.id }))}
                            size="large"
                        />
                    </Form.Item>
                </div>
            ),
        },
        {
            title: '评分与性能',
            content: (
                <div style={{ maxWidth: 600, margin: '0 auto', paddingTop: 24 }}>
                    <Divider orientation="left">评分配置</Divider>
                    <Form.Item name="enable_ai_judge" valuePropName="checked" initialValue={false} label={
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                            开启 AI裁判
                            <Tooltip
                                styles={{ body: { width: 450 } }}
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
                                <InfoCircleOutlined style={{ marginLeft: 6, color: 'var(--text-secondary)', cursor: 'help' }} />
                            </Tooltip>
                        </span>
                    }>
                        <Switch />
                    </Form.Item>
                    {/* We use shouldUpdate to conditionally render based on enable_ai_judge */}
                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.enable_ai_judge !== curr.enable_ai_judge}>
                        {({ getFieldValue }) => getFieldValue('enable_ai_judge') ? (
                            <Form.Item name="judge_model_ids" label="选择裁判模型" rules={[{ required: true }]}>
                                <Select
                                    mode="multiple"
                                    placeholder="选择能力较强的模型作为裁判，如GPT-4"
                                    options={models.map(m => ({ label: m.name, value: m.id }))}
                                />
                            </Form.Item>
                        ) : null}
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.enable_ai_judge !== curr.enable_ai_judge}>
                        {({ getFieldValue }) => {
                            const aiJudgeEnabled = getFieldValue('enable_ai_judge');
                            return (
                                <Form.Item
                                    name="require_human_review"
                                    label="需要人工复核"
                                    valuePropName="checked"
                                    initialValue={true}
                                    tooltip={aiJudgeEnabled ? "勾选后，生成的分数需经过人工审核才生效" : "未开启AI裁判时，所有评分均需人工复核和打分，不可关闭"}
                                >
                                    <Switch disabled={!aiJudgeEnabled} />
                                </Form.Item>
                            );
                        }}
                    </Form.Item>
                    <Form.Item name="enable_objective_auto_score" label="开启客观题自动判分" valuePropName="checked" initialValue={true} tooltip="开启后，单选/多选/二元判定会优先使用规则自动判分；关闭后这类题目将不做规则判分，可由AI裁判或人工复核处理。">
                        <Switch />
                    </Form.Item>
                    <Form.Item name="ignore_case" label="客观题忽略大小写" valuePropName="checked" initialValue={true} tooltip="开启后，单选/多选/二元判定自动打分将忽略模型输出的英文大小写。关闭后按严格大小写匹配。">
                        <Switch />
                    </Form.Item>
                    <div style={{ marginBottom: 16 }}>
                        <Button size="small" onClick={() => setScoringGuideOpen(true)}>查看客观题自动判分说明</Button>
                    </div>
                    <Divider orientation="left">预热配置</Divider>
                    <Form.Item name="enable_warmup" label="开启模型预热" valuePropName="checked" initialValue={true} tooltip="每个模型在正式评测前会先发起一次真实预热调用，减少首轮冷启动影响。预热调用会计入成本（含在总成本中，warmup_cost_usd 可单独查看）。被测模型预热默认使用该模型当前组合下第一条待测样本的实际请求内容。">
                        <Switch />
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.enable_ai_judge !== curr.enable_ai_judge}>
                        {({ getFieldValue }) => getFieldValue('enable_ai_judge') ? (
                            <Form.Item name="warmup_judge_models" label="开启裁判模型预热" valuePropName="checked" initialValue={true} tooltip="开启后会先对裁判模型做一次真实预热调用，预热调用同样计入成本。裁判预热请求内容是“请只回复：OK”，这次调用只做链路预热，不参与裁判评分。">
                                <Switch />
                            </Form.Item>
                        ) : null}
                    </Form.Item>

                    <Divider orientation="left">性能与实验参数</Divider>
                    <Form.Item name="enable_temperature" label="启用Temperature" valuePropName="checked" initialValue={true}>
                        <Switch />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="concurrency" label="并发数" initialValue={1} tooltip="同时发起的请求数量，建议根据模型 API 的限制设置">
                                <InputNumber min={1} max={50} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="timeout" label="请求超时 (秒)" initialValue={120} tooltip="单次模型调用的最大等待时间，超时将报错记录">
                                <InputNumber min={1} max={600} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.enable_temperature !== curr.enable_temperature}>
                            {({ getFieldValue }) => (
                                <Col span={8}>
                                    <Form.Item name="temperature" label="Temperature" initialValue={0.0} tooltip="控制生成文本的随机性，0.0 为最确定，数值越大越随机">
                                        <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} disabled={!getFieldValue('enable_temperature')} />
                                    </Form.Item>
                                </Col>
                            )}
                        </Form.Item>
                        <Col span={12}>
                            <Form.Item name="max_tokens" label="Max Tokens" initialValue={2048} tooltip="模型单次生成允许的最大 Token 数量">
                                <InputNumber min={1} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="random_seed" label="Random Seed (可选)" tooltip="设置随机种子以保证多次评测生成结果的稳定性复现（部分模型可能不支持）">
                                <InputNumber style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="collect_performance" label="收集性能指标 (延迟/TPS/成本)" valuePropName="checked" initialValue={true} tooltip="开启后系统将记录每个请求的响应时间(延迟)、每秒生成的Token数(TPS)以及基于预估价格的消耗成本">
                        <Switch />
                    </Form.Item>
                    <Form.Item name="enable_ttft" label="测量首Token延迟 (TTFT)" valuePropName="checked" initialValue={true} tooltip="开启后将使用流式(Streaming)模式获取回答，以测量从发出请求到收到第一个字的时间。注意：部分代理商或模型可能对流式支持不佳。">
                        <Switch />
                    </Form.Item>
                </div>
            ),
        },
        {
            title: '完成',
            content: (
                <Result
                    status="success"
                    title="评测任务已成功创建并开始运行！"
                    subTitle="后台正在异步调用模型进行评测，您可以前往任务详情页查看实时进度。"
                    extra={[
                        <Button type="primary" key="detail" onClick={() => navigate(`/jobs/${createdJobId}`)}>
                            查看任务进度
                        </Button>,
                        <Button key="jobs" onClick={() => navigate('/')}>
                            返回仪表盘
                        </Button>,
                    ]}
                />
            ),
        },
    ]

    return (
        <div className="wizard-container fade-in">
            <Card
                className="page-card"
                title="创建新评测任务"
            >
                <Steps current={current} items={steps.map(s => ({ title: s.title }))} />
                <Form form={form} layout="vertical" onValuesChange={handleFormValuesChange}>
                    <div style={{ minHeight: 300 }}>
                        {steps.map((step, index) => (
                            <div key={index} style={{ display: current === index ? 'block' : 'none' }}>
                                {step.content}
                            </div>
                        ))}
                    </div>
                </Form>
                <div style={{ marginTop: 40, textAlign: 'center' }}>
                    {current > 0 && current < steps.length - 1 && (
                        <Button style={{ margin: '0 8px' }} onClick={() => prev()}>上一步</Button>
                    )}
                    {current < steps.length - 2 && (
                        <Button type="primary" onClick={() => next()}>下一步</Button>
                    )}
                    {current === steps.length - 2 && (
                        <Button type="primary" onClick={handleSubmit} loading={loading}>提交任务</Button>
                    )}
                </div>
            </Card>
            <Modal
                title="客观题自动判分说明（单/多选 + 二元判定）"
                open={scoringGuideOpen}
                onCancel={() => setScoringGuideOpen(false)}
                footer={null}
                width={860}
            >
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    当前系统已支持客观题规则自动判分，可直接统计准确率；主观题仍可使用 AI 裁判。
                </div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>支持范围</div>
                <div style={{ lineHeight: 1.8, marginBottom: 14 }}>
                    <div>择项判定：单选、多选（自动返回 1/0）</div>
                    <div>二元判定：对/错、是/否、true/false、1/0（自动返回 1/0）</div>
                    <div>主观题：规则不可判时，按你的配置走 AI 裁判或人工复核</div>
                </div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>导入测试集字段建议</div>
                <div style={{ lineHeight: 1.8, marginBottom: 14 }}>
                    <div>metadata.type 或 question_type：single_choice / multiple_choice / binary</div>
                    <div>reference_answer.answer：单选用 "B"，多选用 ["A","C"] 或 "A,C"，二元用 1/0 或 true/false</div>
                    <div>可选字段 options：题目选项（用于展示和扩展）</div>
                </div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>是否需要改数据库</div>
                <div style={{ lineHeight: 1.8 }}>
                    <div>当前不需要。题型与答案结构已存储在 JSON 字段：test_case.metadata 与 test_case.reference_answer。</div>
                </div>
            </Modal>
        </div>
    )
}
