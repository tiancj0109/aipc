import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, Upload, message, Popconfirm, Drawer, Dropdown, Pagination, Radio } from 'antd'
import { PlusOutlined, UploadOutlined, DeleteOutlined, EyeOutlined, InboxOutlined, DownloadOutlined } from '@ant-design/icons'
import { getTestSuites, createTestSuite, deleteTestSuite, previewTestSuite, uploadTestCases, exportTestSuite, downloadTemplate, addTestCase, deleteTestCase } from '../api'

const dimensionOptions = [
    { label: '知识 (Knowledge)', value: 'knowledge' },
    { label: '推理 (Reasoning)', value: 'reasoning' },
    { label: '代码 (Coding)', value: 'coding' },
    { label: '安全 (Safety)', value: 'safety' },
    { label: '长上下文 (Long Context)', value: 'long_context' },
    { label: '指令跟随 (Instruction Following)', value: 'instruction_following' },
    { label: '工具使用 (Tool Use)', value: 'tool_use' },
]

const dimColors = {
    knowledge: '#6C5CE7', reasoning: '#00cec9', coding: '#fdcb6e',
    safety: '#ff7675', long_context: '#74b9ff', instruction_following: '#fd79a8', tool_use: '#e17055',
}

const caseTypeLabels = {
    single_choice: '单选题',
    multiple_choice: '多选题',
    binary: '二元判定',
    subjective: '主观题',
}

const emptyMetaText = '未设置'

function normalizeMetadata(item) {
    const metadata = item?.metadata ?? item?.metadata_
    if (!metadata) return {}
    if (typeof metadata === 'string') {
        try {
            const parsed = JSON.parse(metadata)
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
        } catch {
            return {}
        }
    }
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
}

function formatMetadataValue(value, fallback = emptyMetaText) {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'string') return value.trim() ? value : fallback
    if (Array.isArray(value)) return value.length ? value.join(' / ') : fallback
    if (typeof value === 'object') return Object.keys(value).length ? JSON.stringify(value) : fallback
    return String(value)
}

function normalizeTypeValue(value) {
    if (value === null || value === undefined) return emptyMetaText
    return String(value).trim().toLowerCase() || emptyMetaText
}

export default function TestSuites() {
    const [suites, setSuites] = useState([])
    const [loading, setLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [uploadOpen, setUploadOpen] = useState(false)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [selectedSuite, setSelectedSuite] = useState(null)
    const [previewData, setPreviewData] = useState([])
    const [previewTotal, setPreviewTotal] = useState(0)
    const [previewCurrent, setPreviewCurrent] = useState(1)
    const [previewKeyword, setPreviewKeyword] = useState('')
    const [addCaseOpen, setAddCaseOpen] = useState(false)
    const [importGuideOpen, setImportGuideOpen] = useState(false)
    const [form] = Form.useForm()
    const [addCaseForm] = Form.useForm()

    useEffect(() => { loadSuites() }, [])

    async function loadSuites() {
        setLoading(true)
        try {
            const res = await getTestSuites({ limit: 100 })
            setSuites(res.data)
        } catch { message.error('加载测试集失败') }
        setLoading(false)
    }

    async function handleCreate() {
        try {
            const values = await form.validateFields()
            await createTestSuite(values)
            message.success('测试集已创建')
            setCreateOpen(false)
            form.resetFields()
            loadSuites()
        } catch (e) {
            if (e.response) message.error(e.response.data.detail || '创建失败')
        }
    }

    async function handleUpload(file) {
        if (!selectedSuite) return
        try {
            const res = await uploadTestCases(selectedSuite.id, file)
            message.success(res.data.message)
            setUploadOpen(false)
            loadSuites()
        } catch (e) {
            message.error(e.response?.data?.detail || '上传失败')
        }
        return false // Prevent antd default upload
    }

    async function handlePreview(suite, page = 1, keyword = '') {
        try {
            const limit = 10
            const skip = (page - 1) * limit
            // previewTestSuite needs to accept skip, limit, keyword, instead of just the id
            const res = await previewTestSuite(suite.id, { skip, limit, keyword })
            setPreviewData(res.data.items)
            setPreviewTotal(res.data.total)
            setSelectedSuite(suite)
            setPreviewCurrent(page)
            setPreviewKeyword(keyword)
            setPreviewOpen(true)
        } catch { message.error('预览失败') }
    }

    async function handleAddCase() {
        try {
            if (!selectedSuite?.id) {
                message.error('请先选择测试集')
                return
            }
            const values = await addCaseForm.validateFields()
            let ref = {}
            if (values.reference_answer) {
                try {
                    const parsed = JSON.parse(values.reference_answer)
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        ref = parsed
                    } else {
                        ref = { answer: parsed }
                    }
                } catch {
                    ref = { answer: values.reference_answer }
                }
            }
            const typeMap = {
                single_choice: 'single_choice',
                multiple_choice: 'multiple_choice',
                binary: 'binary',
                subjective: 'subjective',
            }
            const selectedType = values.case_type ? typeMap[values.case_type] : undefined
            const metadata = selectedType ? { type: selectedType } : {}
            await addTestCase(selectedSuite.id, {
                prompt: values.prompt,
                reference_answer: ref,
                metadata_: metadata
            })
            message.success('添加成功')
            setAddCaseOpen(false)
            addCaseForm.resetFields()
            handlePreview(selectedSuite, previewCurrent, previewKeyword) // refresh list
            loadSuites() // Refresh total counts
        } catch (e) {
            if (e.response) message.error(e.response.data.detail || '添加失败')
        }
    }

    async function handleDeleteCase(caseId) {
        try {
            await deleteTestCase(selectedSuite.id, caseId)
            message.success('用例已删除')
            handlePreview(selectedSuite, previewCurrent, previewKeyword) // refresh list
            loadSuites() // Refresh total counts
        } catch { message.error('删除失败') }
    }

    async function handleTemplateDownload(format) {
        try {
            message.loading({ content: '正在下载模板...', key: 'template' });
            const res = await downloadTemplate(format);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `test_cases_template.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            message.success({ content: '模板下载成功', key: 'template', duration: 2 });
        } catch (e) {
            message.error({ content: '模板下载失败', key: 'template', duration: 2 });
        }
    }

    async function handleExport(suite, format) {
        try {
            message.loading({ content: '正在导出...', key: 'export' });
            const res = await exportTestSuite(suite.id, format);

            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `suite_${suite.name}_${suite.id}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            message.success({ content: '导出成功', key: 'export', duration: 2 });
        } catch (e) {
            message.error({ content: '导出失败', key: 'export', duration: 2 });
        }
    }

    async function handleDelete(id) {
        try {
            await deleteTestSuite(id)
            message.success('测试集已删除')
            loadSuites()
        } catch { message.error('删除失败') }
    }

    const columns = [
        { title: '名称', dataIndex: 'name', key: 'name', render: (n) => <span style={{ fontWeight: 600 }}>{n}</span> },
        { title: '来源', dataIndex: 'source', key: 'source', render: (s) => <Tag>{s}</Tag> },
        { title: '版本', dataIndex: 'version', key: 'version' },
        {
            title: '能力维度', dataIndex: 'ability_dimensions', key: 'dims',
            render: (dims) => dims?.map(d => <Tag key={d} color={dimColors[d] || 'default'} style={{ marginBottom: 2 }}>{d}</Tag>) || '-',
        },
        { title: '用例数', dataIndex: 'total_cases', key: 'total_cases', render: (n) => <span style={{ fontWeight: 600 }}>{n}</span> },
        {
            title: '操作', key: 'action', width: 260,
            render: (_, r) => (
                <Space>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(r)}>预览</Button>
                    <Button size="small" icon={<UploadOutlined />} onClick={() => { setSelectedSuite(r); setUploadOpen(true) }}>上传</Button>
                    <Dropdown
                        menu={{
                            items: [
                                { key: 'jsonl', label: '导出 JSONL', onClick: () => handleExport(r, 'jsonl') },
                                { key: 'json', label: '导出 JSON', onClick: () => handleExport(r, 'json') },
                                { key: 'csv', label: '导出 CSV', onClick: () => handleExport(r, 'csv') },
                            ]
                        }}
                    >
                        <Button size="small" icon={<DownloadOutlined />}>导出</Button>
                    </Dropdown>
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
                title="测试集列表"
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateOpen(true) }}>创建测试集</Button>}
            >
                <Table dataSource={suites} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
            </Card>

            {/* Create Modal */}
            <Modal title="创建测试集" open={createOpen} onOk={handleCreate} onCancel={() => setCreateOpen(false)} okText="创建" cancelText="取消">
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="name" label="名称" rules={[{ required: true }]}>
                        <Input placeholder="如 MMLU-v1" />
                    </Form.Item>
                    <Form.Item name="source" label="来源" rules={[{ required: true }]}>
                        <Input placeholder="如 MMLU / GSM8K / custom" />
                    </Form.Item>
                    <Form.Item name="version" label="版本" initialValue="1.0">
                        <Input />
                    </Form.Item>
                    <Form.Item name="ability_dimensions" label="能力维度" tooltip="可以选择已有维度，也可以直接输入新的维度按回车创建">
                        <Select mode="tags" options={dimensionOptions} placeholder="选择或输入新维度" />
                    </Form.Item>
                    <Form.Item name="description" label="描述">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Upload Modal */}
            <Modal title={`上传用记到: ${selectedSuite?.name || ''}`} open={uploadOpen} footer={null} onCancel={() => setUploadOpen(false)}>
                <Upload.Dragger accept=".json,.jsonl,.csv" beforeUpload={handleUpload} showUploadList={false}>
                    <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: 'var(--accent)', fontSize: 48 }} /></p>
                    <p>点击或拖拽文件到此区域</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>支持 JSON、JSONL、CSV 格式</p>
                </Upload.Dragger>

                <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>不知道格式？下载示例模板：</div>
                    <Space size="middle">
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => handleTemplateDownload('jsonl')}>JSONL 模板</Button>
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => handleTemplateDownload('json')}>JSON 模板</Button>
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => handleTemplateDownload('csv')}>CSV 模板</Button>
                        <Button size="small" onClick={() => setImportGuideOpen(true)}>查看导入字段说明</Button>
                    </Space>
                </div>
            </Modal>

            <Modal
                title="导入字段说明"
                open={importGuideOpen}
                onCancel={() => setImportGuideOpen(false)}
                footer={null}
                width={860}
            >
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    支持 JSON / JSONL / CSV。推荐至少提供 prompt + reference_answer。系统会自动识别客观题并按准确率打分。
                </div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>支持字段</div>
                <div style={{ lineHeight: 1.8, marginBottom: 14 }}>
                    <div>prompt / question / input：题目内容</div>
                    <div>reference_answer / answer / output / correct_answer / correct_answers / label：参考答案</div>
                    <div>metadata / metadata_：元信息，支持 type、scoring_method、options</div>
                    <div>question_type / type：题型（single_choice, multiple_choice, binary, subjective）</div>
                    <div>options：选项列表（可选，用于展示与扩展）</div>
                </div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>题型约定</div>
                <div style={{ lineHeight: 1.8, marginBottom: 14 }}>
                    <div>单选：reference_answer.answer = "B"</div>
                    <div>多选：reference_answer.answer = ["A","C"] 或 "A,C"</div>
                    <div>二元：reference_answer.answer = 1/0 或 true/false 或 是/否</div>
                    <div>主观：reference_answer.answer = 文本参考要点，metadata.type = "subjective"</div>
                </div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>JSON/JSONL 示例</div>
                <pre style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>
                    {`{
  "prompt": "【单选】以下哪个是首都？A.上海 B.北京 C.广州 D.深圳",
  "reference_answer": {"answer":"B"},
  "metadata": {"type":"single_choice"}
}
{
  "prompt": "【多选】哪些是编程语言？A.Python B.Java C.HTML D.Rust",
  "reference_answer": {"answer":["A","B","D"]},
  "metadata": {"type":"multiple_choice","options":["A","B","C","D"]}
}
{
  "prompt": "【二元判定】太阳绕地球转（对/错）",
  "reference_answer": {"answer":0},
  "metadata": {"type":"binary"}
}
{
  "prompt": "【主观】请解释什么是时间复杂度",
  "reference_answer": {"answer":"回答应包含大O表示法与示例"},
  "metadata": {"type":"subjective"}
}`}
                </pre>
                <div style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: 12 }}>
                    CSV 场景下建议将 reference_answer 与 metadata 写成 JSON 字符串。
                </div>
            </Modal>

            {/* Preview Drawer */}
            <Drawer
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>预览: {selectedSuite?.name || ''}</span>
                        <Space>
                            <Input.Search
                                placeholder="搜索题目内容..."
                                style={{ width: 250 }}
                                onSearch={val => handlePreview(selectedSuite, 1, val)}
                                allowClear
                            />
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddCaseOpen(true)}>添加用例</Button>
                        </Space>
                    </div>
                }
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                width={700}
            >
                {previewData.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>暂无数据</div>
                ) : (
                    <>
                        {previewData.map((item, i) => {
                            const metadata = normalizeMetadata(item)
                            const rawType = metadata.type ?? metadata.question_type
                            const typeValue = normalizeTypeValue(rawType)
                            const difficultyValue = formatMetadataValue(metadata.difficulty ?? metadata.level)
                            const categoryValue = formatMetadataValue(metadata.category ?? metadata.dimension)
                            const scoringValue = formatMetadataValue(metadata.scoring_method ?? metadata.scoring)
                            return (
                                <Card
                                    key={item.id || i}
                                    size="small"
                                    title={
                                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)' }}>
                                            #{((previewCurrent - 1) * 10) + i + 1}
                                        </span>
                                    }
                                    style={{ marginBottom: 12, background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.06)' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1, paddingRight: 16, overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 600, marginBottom: 4 }}>Prompt:</div>
                                            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, wordBreak: 'break-all' }}>{item.prompt}</div>
                                            {item.reference_answer && (
                                                <div style={{ marginTop: 12 }}>
                                                    <strong>参考答案:</strong>
                                                    <div style={{ fontSize: 13, marginTop: 4, color: 'var(--success)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                                        {typeof item.reference_answer === 'object' ? JSON.stringify(item.reference_answer) : item.reference_answer}
                                                    </div>
                                                </div>
                                            )}
                                            <div style={{ marginTop: 10 }}>
                                                <div style={{ fontWeight: 600, marginBottom: 6 }}>元数据:</div>
                                                <Space wrap size={[6, 6]}>
                                                    <Tag>题型: {caseTypeLabels[typeValue] || typeValue}</Tag>
                                                    <Tag>难度: {difficultyValue}</Tag>
                                                    <Tag>分类: {categoryValue}</Tag>
                                                    <Tag>评分方式: {scoringValue}</Tag>
                                                </Space>
                                                {(metadata.options !== undefined || metadata.choices !== undefined) && (
                                                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                                        选项: {formatMetadataValue(metadata.options ?? metadata.choices)}
                                                    </div>
                                                )}
                                                {Object.keys(metadata).length === 0 && (
                                                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                                                        暂无可展示元数据
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <Popconfirm title="确认删除该用例?" onConfirm={() => handleDeleteCase(item.id)}>
                                            <Button type="text" danger icon={<DeleteOutlined />} size="small" style={{ marginTop: -4, marginRight: -8 }} />
                                        </Popconfirm>
                                    </div>
                                </Card>
                            )
                        })}
                        <div style={{ textAlign: 'center', marginTop: 24 }}>
                            <Pagination
                                current={previewCurrent}
                                total={previewTotal}
                                pageSize={10}
                                onChange={(page) => handlePreview(selectedSuite, page, previewKeyword)}
                                showSizeChanger={false}
                            />
                        </div>
                    </>
                )}
            </Drawer>

            {/* Add Case Modal */}
            <Modal title="添加测试用例" open={addCaseOpen} onOk={handleAddCase} onCancel={() => setAddCaseOpen(false)} okText="添加" cancelText="取消">
                <Form form={addCaseForm} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="prompt" label="Prompt (问题/输入)" rules={[{ required: true, message: '请输入Prompt' }]}>
                        <Input.TextArea rows={4} placeholder="输入要测试的提示词..." />
                    </Form.Item>
                    <Form.Item name="case_type" label="题型" initialValue="subjective">
                        <Radio.Group optionType="button" buttonStyle="solid">
                            <Radio.Button value="subjective">主观题</Radio.Button>
                            <Radio.Button value="single_choice">单选题</Radio.Button>
                            <Radio.Button value="multiple_choice">多选题</Radio.Button>
                            <Radio.Button value="binary">二元判定</Radio.Button>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item name="reference_answer" label="参考答案 (可选)" tooltip="可输入纯文本，系统会自动转为JSON格式">
                        <Input.TextArea rows={2} placeholder="如：北京" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}
