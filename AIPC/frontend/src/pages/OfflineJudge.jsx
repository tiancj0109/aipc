import React, { useState, useEffect } from 'react';
import {
    Typography,
    Card,
    Form,
    Input,
    Select,
    Button,
    Radio,
    Upload,
    Modal,
    message,
    Space,
    Result,
    Table,
    Tag,
    Popconfirm
} from 'antd';
import { InboxOutlined, DownloadOutlined, SmileOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getModels, createOfflineJob, getOfflineJobs, deleteOfflineJob } from '../api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

const DEFAULT_SCORE_PROMPT = `请作为一名客观、严谨的AI裁判，对大模型的回答进行全方位打分。

[用户原始问题]
{prompt}

[参考标准答案]
{reference_answer}

[待评分的模型回答]
{model_output}

请根据回答的正确性、完整性、清晰度进行评分，总分10分。
你必须返回严格的JSON格式，包含以下字段：
- score: 综合得分 (0-10的数字)
- dimension_scores: 各维度得分的JSON对象，包含 correctness, completeness, clarity 三个键，值均为0-10。
- reason: 评分理由说明

只返回JSON格式，不要包含任何其他文字或Markdown块标记。`;

const DEFAULT_ACCURACY_PROMPT = `请作为一名严格的AI裁判，判断大模型的回答是否正确。

[用户原始问题]
{prompt}

[参考标准答案]
{reference_answer}

[待判定模型回答]
{model_output}

请判断该回答在核心事实上是否与标准答案一致。如果一致/正确返回1，错误返回0。
你必须返回严格的JSON格式，包含以下字段：
- score: 1 或 0 (数字)
- reason: 判定理由说明

只返回JSON格式，不要包含任何其他文字或Markdown标记。`;

const DEFAULT_CHOICE_ACCURACY_PROMPT = `请作为一名严格的AI裁判，对择项题进行判定打分。

[用户原始问题]
{prompt}

[参考标准答案]
{reference_answer}

[待判定模型回答]
{model_output}

请按单选/多选题规则判定是否正确：
- 单选：模型答案与标准答案完全一致记 1，否则 0。
- 多选：模型答案集合与标准答案集合完全一致记 1，否则 0。

你必须返回严格的JSON格式，包含以下字段：
- score: 1 或 0 (数字)
- reason: 判定理由说明

只返回JSON格式，不要包含任何其他文字或Markdown标记。`;


const OfflineJudge = () => {
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const [models, setModels] = useState([]);
    const [fileList, setFileList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [createdJobId, setCreatedJobId] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [loadingJobs, setLoadingJobs] = useState(false);
    const [importGuideOpen, setImportGuideOpen] = useState(false);

    // Watch for mode changes to update default prompt
    const scoringMode = Form.useWatch('scoring_mode', form);

    useEffect(() => {
        fetchModels();
        fetchJobs();
    }, []);

    useEffect(() => {
        if (scoringMode === 'score') {
            form.setFieldsValue({ custom_prompt: DEFAULT_SCORE_PROMPT });
        } else if (scoringMode === 'choice_accuracy') {
            form.setFieldsValue({ custom_prompt: DEFAULT_CHOICE_ACCURACY_PROMPT });
        } else if (scoringMode === 'accuracy') {
            form.setFieldsValue({ custom_prompt: DEFAULT_ACCURACY_PROMPT });
        }
    }, [scoringMode, form]);

    const fetchModels = async () => {
        try {
            const res = await getModels({ limit: 100, status: 1 });
            setModels(res.data);
        } catch (error) {
            message.error('获取模型列表失败');
        }
    };

    const fetchJobs = async () => {
        setLoadingJobs(true);
        try {
            const res = await getOfflineJobs({ limit: 10 });
            setJobs(res.data);
        } catch (error) {
            console.error('Failed to fetch offline jobs', error);
        } finally {
            setLoadingJobs(false);
        }
    };

    const handleDeleteJob = async (id) => {
        try {
            await deleteOfflineJob(id);
            message.success('已删除判卷记录');
            fetchJobs();
        } catch (error) {
            message.error('删除失败');
        }
    };

    const handleDownloadTemplate = () => {
        const csvContent = `prompt,reference_answer,model_output,question_type,options
"【单选】中国首都是？A.上海 B.北京 C.广州 D.深圳","B","我选B","single_choice","[""A"",""B"",""C"",""D""]"
"【多选】哪些是编程语言？A.Python B.Java C.HTML D.Rust","A,B,D","A、B、D","multiple_choice","[""A"",""B"",""C"",""D""]"
"【二元判定】太阳绕地球转（对/错）","0","错","binary",""
"【主观】请简述你最常用的调试方法。","回答应包含可执行的调试步骤与思路","我的调试方法是先定位报错位置，再打印变量排查","subjective",""`;
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "offline_judge_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const uploadProps = {
        onRemove: (file) => {
            setFileList(prev => prev.filter(f => f.uid !== file.uid));
        },
        beforeUpload: (file) => {
            const isCsv = file.type === 'text/csv' || file.name.endsWith('.csv');
            if (!isCsv) {
                message.error('只支持上传 CSV 文件!');
                return Upload.LIST_IGNORE;
            }
            setFileList([file]);
            return false; // Prevent auto upload
        },
        fileList,
        maxCount: 1,
    };

    const onFinish = async (values) => {
        if (fileList.length === 0) {
            message.error('请先上传测试数据集！');
            return;
        }

        setLoading(true);
        const formData = new FormData();
        formData.append('name', values.name);
        formData.append('judge_model_id', values.judge_model_id);
        formData.append('scoring_mode', values.scoring_mode);
        formData.append('enable_objective_auto_score', values.enable_objective_auto_score !== false);
        formData.append('ignore_case', values.ignore_case !== false);
        formData.append('custom_prompt', values.custom_prompt);
        formData.append('file', fileList[0]);

        try {
            const res = await createOfflineJob(formData);
            message.success('判卷任务创建成功！');
            setCreatedJobId(res.data.id);
        } catch (error) {
            console.error(error);
            message.error(error.response?.data?.detail || '创建任务失败，请检查文件格式。');
        } finally {
            setLoading(false);
            fetchJobs(); // Make sure list is updated when leaving success screen later
        }
    };

    if (createdJobId) {
        return (
            <Card className="page-container glass-card fade-in">
                <Result
                    status="success"
                    title="离线判卷任务已成功提交！"
                    subTitle={`任务编号: ${createdJobId}。系统正在后台利用选定的AI裁判批量为您算分。`}
                    extra={[
                        <Button type="primary" key="detail" onClick={() => navigate(`/offline-jobs/${createdJobId}`)}>
                            查看判卷进度与详情
                        </Button>,
                        <Button key="back" onClick={() => { setCreatedJobId(null); setFileList([]); form.resetFields(); }}>
                            继续创建新任务
                        </Button>,
                    ]}
                />
            </Card>
        );
    }

    return (
        <div className="page-container fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>
                    <CheckCircleOutlined style={{ marginRight: 12, color: 'var(--primary-color)' }} />
                    AI 裁判打分（离线）
                </Title>
                <Space>
                    <Button onClick={() => setImportGuideOpen(true)}>查看导入字段说明</Button>
                    <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                        下载 CSV 模板
                    </Button>
                </Space>
            </div>

            <Card className="glass-card">
                <Paragraph type="secondary">
                    使用此功能，您可以导入系统外的数据（包含Prompt与模型回答），并调用系统内注册的大模型作为裁判进行自动化批量打分或判断准确率。
                </Paragraph>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    initialValues={{
                        scoring_mode: 'score',
                        enable_objective_auto_score: true,
                        ignore_case: true,
                        custom_prompt: DEFAULT_SCORE_PROMPT
                    }}
                    style={{ maxWidth: 800, marginTop: 24 }}
                >
                    <Form.Item
                        name="name"
                        label="任务名称"
                        rules={[{ required: true, message: '请填写任务名称' }]}
                    >
                        <Input placeholder="例如: GPT4测试结果分析" size="large" />
                    </Form.Item>

                    <Form.Item label="1. 上传测试结果 (CSV格式)" required>
                        <Dragger {...uploadProps}>
                            <p className="ant-upload-drag-icon">
                                <InboxOutlined />
                            </p>
                            <p className="ant-upload-text">点击或拖拽 CSV 文件到此处上传</p>
                            <p className="ant-upload-hint">
                                文件必须包含表头: prompt (必填), model_output (必填), reference_answer (推荐), question_type/options (可选)。
                            </p>
                        </Dragger>
                    </Form.Item>

                    <Form.Item
                        name="judge_model_id"
                        label="2. 选择裁判模型"
                        rules={[{ required: true, message: '请选择裁判模型' }]}
                    >
                        <Select
                            placeholder="选择用于评分的模型"
                            size="large"
                            options={models.map(m => ({ label: m.name, value: m.id }))}
                        />
                    </Form.Item>

                    <Form.Item
                        name="scoring_mode"
                        label="3. 评分模式"
                        rules={[{ required: true }]}
                    >
                        <Radio.Group optionType="button" buttonStyle="solid" size="large">
                            <Radio value="score">多维度打分 (0-10分)</Radio>
                            <Radio value="choice_accuracy">择项判定（单多选 准确率）</Radio>
                            <Radio value="accuracy">二元判定 (对/错 准确率)</Radio>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item name="enable_objective_auto_score" label="4. 开启客观题自动判分" valuePropName="checked" tooltip="开启后，择项判定与二元判定会先走规则自动判分；关闭后全部走AI裁判判分流程。">
                        <Radio.Group optionType="button" buttonStyle="solid" size="large">
                            <Radio value={true}>开启</Radio>
                            <Radio value={false}>关闭</Radio>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item name="ignore_case" label="5. 客观题忽略大小写" valuePropName="checked" tooltip="开启后，择项判定和二元判定会忽略模型输出英文大小写。关闭后按严格大小写判定。">
                        <Radio.Group optionType="button" buttonStyle="solid" size="large">
                            <Radio value={true}>开启</Radio>
                            <Radio value={false}>关闭</Radio>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        name="custom_prompt"
                        label="6. 裁判 Prompt (支持自定义)"
                        rules={[{ required: true, message: 'Prompt 不能为空' }]}
                        extra={<Text type="secondary">支持的占位符: {'{prompt}'}, {'{reference_answer}'}, {'{model_output}'}。务必要求模型返回符合系统期待的 JSON 格式。</Text>}
                    >
                        <TextArea rows={12} style={{ fontFamily: 'monospace' }} />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" size="large" loading={loading} block style={{ marginTop: 16 }}>
                            提交判卷任务
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
            <Modal
                title="离线裁判导入字段说明"
                open={importGuideOpen}
                onCancel={() => setImportGuideOpen(false)}
                footer={null}
                width={860}
            >
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    仅支持 CSV。最少需要 prompt 与 model_output 两列；reference_answer 建议提供，用于准确率判定与裁判参考。
                </div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>CSV 必填/推荐列</div>
                <div style={{ lineHeight: 1.8, marginBottom: 14 }}>
                    <div>prompt（必填）：原始问题</div>
                    <div>model_output（必填）：待判卷模型回答</div>
                    <div>reference_answer（推荐）：参考答案/标准答案</div>
                    <div>question_type（可选）：single_choice / multiple_choice / binary / subjective</div>
                    <div>options（可选）：题目选项，建议 JSON 字符串，如 ["A","B","C","D"]</div>
                </div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>判分模式建议</div>
                <div style={{ lineHeight: 1.8, marginBottom: 14 }}>
                    <div>多维度打分（0-10）：适合主观题、开放问答。</div>
                    <div>择项判定（单多选）：适合单选/多选客观题准确率统计。</div>
                    <div>二元判定（对/错）：适合客观题准确率统计。</div>
                </div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>CSV 示例</div>
                <pre style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>
                    {`prompt,reference_answer,model_output,question_type,options
"【单选】中国首都是？A.上海 B.北京 C.广州 D.深圳","B","我选B","single_choice","[""A"",""B"",""C"",""D""]"
"【多选】哪些是编程语言？A.Python B.Java C.HTML D.Rust","A,B,D","A、B、D","multiple_choice","[""A"",""B"",""C"",""D""]"
"【二元判定】太阳绕地球转（对/错）","0","错","binary",""
"【主观】请简述你最常用的调试方法。","回答应包含可执行的调试步骤与思路","我的调试方法是先定位报错位置，再打印变量排查","subjective",""`}
                </pre>
            </Modal>

            <Title level={4} style={{ marginTop: 40, marginBottom: 16 }}>历史判卷记录</Title>
            <Card className="glass-card" bodyStyle={{ padding: 0 }}>
                <Table 
                    dataSource={jobs}
                    rowKey="id"
                    loading={loadingJobs}
                    pagination={{ pageSize: 5 }}
                    columns={[
                        { title: '任务编号', dataIndex: 'id', width: 80 },
                        { title: '任务名称', dataIndex: 'name', ellipsis: true },
                        {
                            title: '评分模式',
                            key: 'scoring_mode',
                            render: (_, r) => {
                                const mode = r.config_snapshot?.scoring_mode
                                if (mode === 'choice_accuracy') return <Tag color="cyan">择项准确率</Tag>
                                if (mode === 'accuracy') return <Tag color="blue">二元准确率</Tag>
                                return <Tag color="purple">多维度打分</Tag>
                            }
                        },
                        {
                            title: '状态',
                            dataIndex: 'status',
                            render: (s) => <Tag color={s === 'completed' ? 'success' : s === 'running' ? 'processing' : 'default'}>{s}</Tag>
                        },
                        {
                            title: '创建时间',
                            dataIndex: 'created_at',
                            render: (t) => t ? dayjs(t).format('MM-DD HH:mm') : '-'
                        },
                        {
                            title: '操作',
                            render: (_, r) => (
                                <Space>
                                    <Button type="link" size="small" onClick={() => navigate(`/offline-jobs/${r.id}`)}>
                                        查看详情
                                    </Button>
                                    <Popconfirm title="确定删除?" onConfirm={() => handleDeleteJob(r.id)}>
                                        <Button type="link" danger size="small">删除</Button>
                                    </Popconfirm>
                                </Space>
                            )
                        }
                    ]}
                />
            </Card>
        </div>
    );
};

export default OfflineJudge;
