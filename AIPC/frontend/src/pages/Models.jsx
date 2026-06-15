import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Switch, Tag, Space, message, Popconfirm, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { getModels, createModel, updateModel, deleteModel, toggleModel } from '../api'

const providerOptions = [
    { label: 'OpenAI', value: 'openai' },
    { label: 'Anthropic', value: 'anthropic' },
    { label: 'DeepSeek', value: 'deepseek' },
    { label: '阿里云通义千问', value: 'aliyun' },
    { label: '月之暗面 (Kimi)', value: 'moonshot' },
    { label: 'Ollama', value: 'ollama' },
    { label: '本地模型', value: 'local' },
    { label: '其他', value: 'other' },
]

const capabilityOptions = [
    { label: '文本', value: 'text' },
    { label: '代码', value: 'code' },
    { label: '图像', value: 'image' },
    { label: '推理', value: 'reasoning' },
]

export default function Models() {
    const [models, setModels] = useState([])
    const [loading, setLoading] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form] = Form.useForm()

    useEffect(() => { loadModels() }, [])

    async function loadModels() {
        setLoading(true)
        try {
            const res = await getModels({ limit: 100 })
            setModels(res.data)
        } catch { message.error('加载模型列表失败') }
        setLoading(false)
    }

    function openCreate() {
        setEditing(null)
        form.resetFields()
        form.setFieldsValue({ status: 1, provider: 'openai' })
        setModalOpen(true)
    }

    function openEdit(record) {
        setEditing(record)
        form.setFieldsValue({
            ...record,
            api_key: '', // Don't show encrypted key
            default_params: record.default_params ? JSON.stringify(record.default_params, null, 2) : '',
            pricing_input: record.pricing?.input || '',
            pricing_output: record.pricing?.output || ''
        })
        setModalOpen(true)
    }

    async function handleSubmit() {
        try {
            const values = await form.validateFields()
            // Clean empty api_key
            if (!values.api_key) delete values.api_key
            // Convert pricing strings to object
            const parsedInputPrice = values.pricing_input === '' || values.pricing_input === undefined || values.pricing_input === null
                ? undefined
                : Number(values.pricing_input)
            const parsedOutputPrice = values.pricing_output === '' || values.pricing_output === undefined || values.pricing_output === null
                ? undefined
                : Number(values.pricing_output)
            const hasPricingValue = Number.isFinite(parsedInputPrice) || Number.isFinite(parsedOutputPrice)
            if (hasPricingValue) {
                values.pricing = {
                    input: Number.isFinite(parsedInputPrice) ? parsedInputPrice : 0,
                    output: Number.isFinite(parsedOutputPrice) ? parsedOutputPrice : 0,
                }
            }
            delete values.pricing_input
            delete values.pricing_output

            if (editing) {
                await updateModel(editing.id, values)
                message.success('模型已更新')
            } else {
                await createModel(values)
                message.success('模型已创建')
            }
            setModalOpen(false)
            loadModels()
        } catch (e) {
            if (e.response) message.error(e.response.data.detail || '操作失败')
        }
    }

    async function handleDelete(id) {
        try {
            await deleteModel(id)
            message.success('模型已删除')
            loadModels()
        } catch { message.error('删除失败') }
    }

    async function handleToggle(id) {
        try {
            await toggleModel(id)
            loadModels()
        } catch { message.error('操作失败') }
    }

    const columns = [
        {
            title: '模型名称', dataIndex: 'name', key: 'name',
            render: (name, r) => (
                <div>
                    <div style={{ fontWeight: 600 }}>{name}</div>
                    {r.version && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.version}</div>}
                </div>
            ),
        },
        {
            title: '提供商', dataIndex: 'provider', key: 'provider',
            render: (p) => {
                const colors = {
                    openai: '#00b894', anthropic: '#6C5CE7', deepseek: '#1890ff',
                    aliyun: '#ff7f50', moonshot: '#eb2f96', ollama: '#fdcb6e', local: '#74b9ff'
                }
                return <Tag color={colors[p] || 'default'}>{p.toUpperCase()}</Tag>
            },
        },
        {
            title: '能力', dataIndex: 'capabilities', key: 'capabilities',
            render: (caps) => caps?.map(c => <Tag key={c} style={{ marginBottom: 2 }}>{c}</Tag>) || '-',
        },
        {
            title: '计价 ($/M tokens)', key: 'pricing',
            render: (_, r) => r.pricing ? `I:$${r.pricing.input} / O:$${r.pricing.output}` : '-',
        },
        {
            title: '状态', dataIndex: 'status', key: 'status',
            render: (s, r) => (
                <Switch checked={s === 1} onChange={() => handleToggle(r.id)}
                    checkedChildren="启用" unCheckedChildren="禁用" />
            ),
        },
        {
            title: '操作', key: 'action', width: 120,
            render: (_, r) => (
                <Space>
                    <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
                    <Popconfirm title="确认删除?" onConfirm={() => handleDelete(r.id)}>
                        <Tooltip title="删除"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ]

    return (
        <div>
            <Card
                className="page-card"
                title={<><ApiOutlined /> 模型列表</>}
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加模型</Button>}
            >
                <Table 
                    dataSource={models}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            <Modal
                title={editing ? '编辑模型' : '添加模型'}
                open={modalOpen}
                onOk={handleSubmit}
                onCancel={() => setModalOpen(false)}
                width={640}
                okText="保存"
                cancelText="取消"
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="name" label="模型名称" rules={[{ required: true }]}>
                        <Input placeholder="如 GPT-4o" />
                    </Form.Item>
                    <Form.Item name="provider" label="提供商" rules={[{ required: true }]}>
                        <Select options={providerOptions} />
                    </Form.Item>
                    <Form.Item name="version" label="版本">
                        <Input placeholder="如 gpt-4o-2024-08-06" />
                    </Form.Item>
                    <Form.Item
                        name="api_endpoint"
                        label="API端点"
                        rules={[{ required: true }]}
                        help="请填写基础地址，系统会自动拼接 /chat/completions，请勿手动追加该路径"
                    >
                        <Input placeholder="如 https://api.openai.com/v1" />
                    </Form.Item>
                    <Form.Item name="api_key" label={<><SafetyCertificateOutlined /> API密钥</>}>
                        <Input.Password placeholder={editing ? '留空不修改' : '输入API密钥'} />
                    </Form.Item>
                    <Form.Item name="capabilities" label="能力">
                        <Select mode="multiple" options={capabilityOptions} placeholder="选择模型能力" />
                    </Form.Item>
                    <Space style={{ width: '100%' }} size={16}>
                        <Form.Item name="pricing_input" label="输入价格 ($/M tokens)" style={{ flex: 1 }}>
                            <Input type="number" placeholder="0" />
                        </Form.Item>
                        <Form.Item name="pricing_output" label="输出价格 ($/M tokens)" style={{ flex: 1 }}>
                            <Input type="number" placeholder="0" />
                        </Form.Item>
                    </Space>
                    <Form.Item name="default_params" label="默认参数 (JSON)" help="如 {&quot;temperature&quot;: 0.7, &quot;model&quot;: &quot;gpt-4o&quot;}">
                        <Input.TextArea rows={2} placeholder='{"temperature": 0.7}' />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}
