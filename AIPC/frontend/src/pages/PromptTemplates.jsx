import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CodeOutlined } from '@ant-design/icons'
import { getPromptTemplates, createPromptTemplate, updatePromptTemplate, deletePromptTemplate } from '../api'

export default function PromptTemplates() {
    const [templates, setTemplates] = useState([])
    const [loading, setLoading] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form] = Form.useForm()

    useEffect(() => { loadTemplates() }, [])

    async function loadTemplates() {
        setLoading(true)
        try {
            const res = await getPromptTemplates({ limit: 100 })
            setTemplates(res.data)
        } catch { message.error('加载模板失败') }
        setLoading(false)
    }

    function openCreate() {
        setEditing(null)
        form.resetFields()
        setModalOpen(true)
    }

    function openEdit(record) {
        setEditing(record)
        form.setFieldsValue(record)
        setModalOpen(true)
    }

    async function handleSubmit() {
        try {
            const values = await form.validateFields()
            if (editing) {
                await updatePromptTemplate(editing.id, values)
                message.success('模板已更新')
            } else {
                await createPromptTemplate(values)
                message.success('模板已创建')
            }
            setModalOpen(false)
            loadTemplates()
        } catch (e) {
            if (e.response) message.error(e.response.data.detail || '操作失败')
        }
    }

    async function handleDelete(id) {
        try {
            await deletePromptTemplate(id)
            message.success('模板已删除')
            loadTemplates()
        } catch { message.error('删除失败') }
    }

    const columns = [
        { title: '名称', dataIndex: 'name', key: 'name', render: (n) => <span style={{ fontWeight: 600 }}>{n}</span> },
        {
            title: '能力维度', dataIndex: 'ability_dimension', key: 'dim',
            render: (d) => d ? <Tag color="#6C5CE7">{d}</Tag> : '-',
        },
        { title: '版本', dataIndex: 'version', key: 'version' },
        {
            title: '内容预览', dataIndex: 'content', key: 'content',
            ellipsis: true,
            render: (c) => <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{c}</span>,
        },
        {
            title: '操作', key: 'action', width: 120,
            render: (_, r) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                    <Popconfirm title="确认删除?" onConfirm={() => handleDelete(r.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ]

    return (
        <div>
            <Card
                className="page-card"
                title={<><CodeOutlined /> Prompt模板</>}
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建模板</Button>}
            >
                <Table dataSource={templates} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
            </Card>

            <Modal
                title={editing ? '编辑模板' : '新建模板'}
                open={modalOpen}
                onOk={handleSubmit}
                onCancel={() => setModalOpen(false)}
                width={700}
                okText="保存"
                cancelText="取消"
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
                        <Input placeholder="如 通用评测模板" />
                    </Form.Item>
                    <Form.Item name="content" label="模板内容" rules={[{ required: true }]}
                        help="使用 {question} 作为占位符，系统会自动替换为测试用例的prompt">
                        <Input.TextArea
                            rows={8}
                            placeholder={'请回答以下问题:\n\n{question}\n\n请给出详细的回答。'}
                            style={{ fontFamily: 'monospace', fontSize: 13 }}
                        />
                    </Form.Item>
                    <Form.Item name="ability_dimension" label="关联能力维度">
                        <Select
                            allowClear
                            placeholder="选择维度"
                            options={[
                                { label: '知识', value: 'knowledge' },
                                { label: '推理', value: 'reasoning' },
                                { label: '代码', value: 'coding' },
                                { label: '安全', value: 'safety' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name="version" label="版本" initialValue="1.0">
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}
