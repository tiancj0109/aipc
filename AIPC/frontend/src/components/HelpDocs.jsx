import React from 'react';
import { Typography, Divider, List, Steps } from 'antd';
import {
    RobotOutlined,
    DatabaseOutlined,
    ExperimentOutlined,
    BarChartOutlined,
    FileTextOutlined
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

// 移除TypeScript类型注释，适配JSX文件
const ThunderboltOutlined = ({ style }) => {
    return (
        <span role="img" aria-label="thunderbolt" className="anticon anticon-thunderbolt" style={style}>
            <svg
                viewBox="64 64 896 896"
                focusable="false"
                data-icon="thunderbolt"
                width="1em"
                height="1em"
                fill="currentColor"
                aria-hidden="true"
            >
                <path d="M848 359.3H627.7L825.8 109c4.1-5.3.4-13-6.3-13H436c-2.8 0-5.5 1.5-6.9 4L170.1 570c-3.1 4.6.1 10.9 5.6 10.9H400v334.1c0 8.3 10.1 12.3 15.8 6.1l438.3-475.9c4.9-5.3 1.1-13.9-6.1-13.9z"></path>
            </svg>
        </span>
    );
};

export default function HelpDocs() {
    const stepsItems = [
        {
            title: '模型注册 (Model Registry)',
            description: '进入“模型管理”，添加 API 密钥和 Provider 端点。支持 OpenAI 协议、Anthropic 协议及 Ollama 本地部署。密钥采用 AES-256 加密存储，确保安全。',
            icon: <RobotOutlined />
        },
        {
            title: '测试集准备 (Test Suite Setup)',
            description: '在“测试集管理”上传 JSON/JSONL 格式的题目。建议为每道题关联能力维度（如：逻辑、代码、创意），以便生成多维能力雷达图。',
            icon: <DatabaseOutlined />
        },
        {
            title: '配置 Prompt 模板 (A/B Testing)',
            description: '您可以预设多个系统提示词模板。在创建评测时选中多个模板，系统将自动进行 A/B 测试，对比同一模型在不同指令下的表现。',
            icon: <FileTextOutlined />
        },
        {
            title: '运行评测任务 (Running Eval)',
            description: '在“创建评测”向导中：配置并发数（控制 API 速率）、选择 AI 裁判（如 GPT-4 自动打分）、开启 TTFT 监测（测量首单词生成耗时）。',
            icon: <ThunderboltOutlined />
        },
        {
            title: '分析与调优 (Analysis & Comparison)',
            description: '通过“任务详情”查看聚合报告。使用“并排对比”视图，以题目为行、模型/Prompt 为列，直观发现模型输出差异。支持导出 CSV/MD/PDF 以及详细明细审计数据。',
            icon: <BarChartOutlined />
        }
    ];

    const scoringAndReviewGuide = [
        '客观题（单选/多选/判断）优先使用规则自动判分：1=正确，0=错误；界面可能按百分比展示（如100%/0%）。',
        '主观题默认由 AI 裁判打分（0-10），并可由人工复核修改最终分。',
        '主客观混合任务的综合得分口径：综合得分 = (客观准确率×10 + 主观题均分) / 2。',
        '人工复核区会默认带入机器分与理由，客观题可一键“判定正确(1)”或“判定错误(0)”。',
    ];

    const exportGuide = [
        '总览导出 CSV：用于经营/管理看板，包含综合得分、客观拆解、主观均分、性能、成本、错误率等核心指标。',
        '总览导出 MD：用于评审与归档，包含任务配置快照、核心指标对比、客观题拆解、成本与令牌消耗。',
        '详细结果导出 CSV：用于审计追溯，包含题型、题目、参考答案、判分来源、规则匹配、机器分、人工分、审核信息与性能明细。',
        '客观题导出中的机器分说明固定为：1=正确，0=错误；AI裁判分为0-10区间。',
    ];

    const requirementDoc = `# 大模型自动化评测系统 - 需求规格说明书（V2.0）

## 版本历史

| 版本 | 日期 | 作者 | 变更描述 |
|------|------|------|----------|
| V1.0 | 2025-03-10 | 系统分析师 | 初始版本 |
| V2.0 | 2025-03-11 | 系统分析师 | 整合架构与评测体系优化建议 |
| V3.0 | 2026-03-11 | 系统开发者 | 增加 Prompt A/B 测试、多模型并排对比透视表、CSV 数据导出、错误重试机制 |


---

## 1. 引言

### 1.1 项目背景
随着大语言模型（LLM）的快速发展，企业和研究机构需要对不同模型进行多维度评估，以选择最适合自身需求的模型。当前评测工作存在流程分散、主观评分不一致、性能指标缺失等问题。因此，亟需一套**自动化评测系统**，能够统一管理测试集、调度模型评测、自动评分（支持AI裁判）、人工修正、并输出效果与性能结合的综合性报告。

### 1.2 项目目标
开发一套基于 **FastAPI + MySQL + React** 的大模型评测自动化系统，实现以下核心目标：
- 支持多种模型（云端API、本地部署）的接入与评测。
- 内置经典公开测试集（MMLU、GSM8K、HumanEval 等），并支持自定义测试集上传。
- 提供灵活的评分机制：客观题规则评分、主观题AI裁判评分，并允许人工修正。
- 集成性能评测，包括延迟、吞吐量、成本、资源消耗等指标。
- 生成多维度的可视化对比报告，辅助模型选型与分析。
- 具备实验管理能力，确保评测结果可复现。
- 支持能力维度化评测（如知识、推理、代码、安全等），输出能力雷达图。

---

## 2. 总体描述

### 2.1 用户角色
- **评测管理员**：管理模型、测试集、创建评测任务、查看报告、执行人工修正。
- **普通用户**（可选）：查看公开报告、下载数据，不可修改。
- **系统运维**：监控系统健康、处理任务队列、备份数据。

### 2.2 系统范围
- 系统不涉及模型训练，只聚焦于评测。
- 系统需提供Web界面供用户交互，同时提供RESTful API供外部调用（如集成到CI/CD）。
- 支持异步任务处理，避免长时间阻塞HTTP请求。

### 2.3 假设与依赖
- 目标模型以API形式提供（如OpenAI、Anthropic）或可通过本地HTTP服务调用。
- 评测任务可能涉及大量请求，需具备良好的并发控制和错误重试机制。
- 用户上传的测试集格式需符合约定规范（如JSONL、CSV）。

---

## 3. 功能需求

### 3.1 模型管理
| 需求编号 | 功能描述 | 优先级 |
|----------|----------|--------|
| M-01 | 支持添加、编辑、删除模型信息。模型信息包括：名称、提供商（OpenAI/Anthropic/本地等）、API端点、API密钥（加密存储）、支持的 capability（文本/代码/图像等）、默认参数（temperature、max_tokens）、计价规则（每百万输入/输出tokens价格）。 | P0 |
| M-02 | 支持启用/禁用模型，禁用后不可用于新建评测任务。 | P1 |
| M-03 | 支持本地模型的简单探活（如发送测试请求验证连通性）。 | P2 |
| M-04 | **模型版本管理**：支持记录模型的版本（如 gpt-4-1106、gpt-4-0125），便于跟踪模型迭代。 | P1 |
| M-05 | **模型调用抽象层**：系统需内置多种模型适配器（OpenAI、Anthropic、Ollama、vLLM 等），统一调用接口，便于扩展新模型。 | P0 |

### 3.2 测试集管理
| 需求编号 | 功能描述 | 优先级 |
|----------|----------|--------|
| T-01 | 内置经典测试集：MMLU（知识）、GSM8K（数学推理）、HumanEval（代码）、TruthfulQA（幻觉）、MT-Bench（对话）、AlpacaEval（指令跟随）、LongBench（长上下文）、AgentBench（工具使用）等。需提供导入脚本，自动从公开源拉取并结构化存入数据库。 | P0 |
| T-02 | **能力维度化**：每个测试集需关联一个或多个能力维度（如 \`knowledge\`, \`reasoning\`, \`coding\`, \`safety\`, \`long_context\`, \`instruction_following\`, \`tool_use\`），并在 \`test_suite\` 表中增加 \`ability_dimensions\` 字段。 | P0 |
| T-03 | 支持用户上传自定义测试集，格式支持JSON、CSV、JSONL。上传时需指定该测试集对应的能力维度。 | P0 |
| T-04 | 支持测试集的版本管理（当测试集内容更新时，可创建新版本，旧版本仍可追溯）。 | P1 |
| T-05 | 支持测试集预览（随机抽取若干条显示），便于用户了解内容。 | P1 |
| T-06 | 支持按类别、难度、能力维度筛选测试集，并在创建评测任务时选择子集。 | P2 |

### 3.3 评测任务管理
| 需求编号 | 功能描述 | 优先级 |
|----------|----------|--------|
| J-01 | 用户创建评测任务时需指定：选择多个待测模型、选择一个测试集（及其版本）、配置评分选项（是否启用AI裁判、选用哪个裁判模型、是否需要人工复核）、配置性能选项（是否收集性能数据、是否启用压力测试等）。 | P0 |
| J-02 | 系统应提供任务进度实时反馈（已完成用例数/总数，成功/失败计数），支持WebSocket或轮询方式更新。 | P0 |
| J-03 | 支持暂停、继续、取消运行中的任务。 | P1 |
| J-04 | 任务完成后，自动聚合结果生成报告，并通知用户（站内信或邮件可选）。 | P1 |
| J-05 | 支持断点续跑：若任务中途失败（如服务重启），重新启动任务时可从中断处继续。 | P2 |
| J-06 | **实验管理**：每个评测任务作为一个实验，系统需记录实验的完整配置快照，包括模型版本、prompt模板、温度、随机种子、max_tokens等参数，确保结果可复现。 | P1 |
| J-07 | **Prompt A/B 测试**：支持在一次任务中对比多个不同 Prompt 模板的效果，系统自动计算 (模型 x Prompt) 的全排列组合。 | P0 |
| J-08 | **断点续跑与重试**：支持对任务中报错或未完成的请求进行一键重试，避免网络抖动导致任务失败。 | P1 |


### 3.4 效果评测 - 自动评分
| 需求编号 | 功能描述 | 优先级 |
|----------|----------|--------|
| S-01 | 支持客观题规则评分：对于选择题、判断题等，通过比较模型输出与标准答案（可配置匹配模式，如包含、精确匹配、正则）计算得分。 | P0 |
| S-02 | 支持AI裁判评分：调用指定的大模型（如GPT-4）对模型输出进行打分。裁判模型需能访问prompt、模型输出、参考答案（可选），并输出分数及评分理由。裁判调用结果存入数据库。 | P0 |
| S-03 | **AI裁判可靠性增强**：
- 支持多裁判投票：可配置使用多个裁判模型（如GPT-4、Claude、Qwen）进行独立评分，最终取平均或多数决。
- 支持随机化答案顺序：对于对比评分，随机呈现两个答案的顺序，避免位置偏见。
- 内置标准评分prompt模板（如相关性、正确性、完整性、安全性等维度），保证评分一致性。 | P1 |
| S-04 | AI裁判需支持多维度评分（如相关性、完整性、无害性等），维度配置可灵活定义，评分结果以JSON形式存储在 \`dimension_scores\` 字段中。 | P1 |
| S-05 | 对于代码生成任务，支持通过运行测试用例判定正确性（如HumanEval），结果转化为分数。 | P1 |

### 3.5 人工修正与复核
| 需求编号 | 功能描述 | 优先级 |
|----------|----------|--------|
| H-01 | 对于启用“需要人工复核”的任务，每个用例的初始状态为“待审核”。用户可在前端界面对这些用例进行人工打分或修改AI分数。 | P0 |
| H-02 | 人工修改界面需展示完整上下文：prompt、模型输出、自动评分详情（含分数和理由、各维度分数）。提供输入框让用户输入人工分数，并可选填写评语。 | P0 |
| H-03 | 修改后，系统记录最终分数、评分人、修改时间，并可标记为“已审核”。 | P0 |
| H-04 | 支持批量操作：勾选多个待审核用例，一键设置为已审核（不修改分数），或批量输入分数偏移量。 | P1 |
| H-05 | 所有修改操作需记录审计日志，便于追溯。 | P2 |

### 3.6 性能评测
| 需求编号 | 功能描述 | 优先级 |
|----------|----------|--------|
| P-01 | 在评测任务中，若启用性能收集，需记录每个请求的性能数据：首Token延迟（TTFT）、总延迟、输入tokens数、输出tokens数、总tokens数。 | P0 |
| P-02 | 根据模型预设的计价规则，自动估算每次请求的成本（美元），并累计总成本。 | P0 |
| P-03 | 对于本地模型，可选择性采集GPU显存占用峰值、CPU使用率（通过agent或内嵌脚本）。 | P1 |
| P-04 | 支持压力测试模式：用户指定并发数（如10、50）和总请求数，系统并发发送请求，统计平均延迟、P95延迟、吞吐量（requests/sec）、错误率。 | P1 |
| P-05 | 扩展性能指标：
- **TPS** (tokens per second)：每秒生成的token数。
- **Throughput**：每秒完成的请求数。
- **Error Rate**：请求失败率（超时、限流、空响应等）。 | P1 |
| P-06 | 性能数据需与效果数据关联，可在报告中进行联合分析（如散点图展示效果-成本-延迟）。 | P1 |

### 3.7 结果分析与报告
| 需求编号 | 功能描述 | 优先级 |
|----------|----------|--------|
| R-01 | 任务完成后生成综合报告，包含以下部分：
- 各模型总体得分（雷达图，展示能力维度得分）。
- 各维度细分得分（柱状图）。
- 性能指标对比（表格/散点图，包括TTFT、延迟、TPS、吞吐量、错误率、成本）。
- 失败案例分析。 | P0 |
| R-02 | 支持按测试集类别、难度、能力维度等维度下钻查看详细结果。 | P0 |
| R-03 | 提供原始数据导出功能（CSV/JSON），包含每个用例的prompt、输出、分数、性能数据等。 | P1 |
| R-04 | 支持报告分享（生成公开链接，可设置密码或有效期）。 | P2 |
| R-05 | 支持对比功能，可将多次评测任务的结果放在同一张图表中对比（如模型版本迭代）。 | P2 |
| R-06 | **Leaderboard**：支持生成排行榜，展示各模型在各项能力维度上的综合得分，供用户参考。 | P1 |
| R-07 | **并排对比透视表**：在详情页提供以测试用例为行、模型为列的并排对比视图，支持横向查看文本差异。 | P0 |
| R-08 | **数据导出**：支持将聚合报告和明细记录导出为 Excel/CSV 格式。 | P1 |
| R-09 | **Regression测试**：支持自动对比新旧版本模型在同一测试集上的表现，输出性能退化报告。 | P2 |


### 3.8 Prompt管理（新增）
| 需求编号 | 功能描述 | 优先级 |
|----------|----------|--------|
| PM-01 | 支持创建、编辑、删除prompt模板。每个模板包含名称、内容、关联的能力维度、默认参数等。 | P1 |
| PM-02 | 在创建评测任务时，可以选择使用特定prompt模板，系统将模板与测试用例的prompt合并后发送给模型。 | P1 |
| PM-03 | 支持prompt模板版本管理，记录修改历史。 | P2 |

---

## 4. 非功能需求

| 编号 | 需求描述 | 验收标准 |
|------|----------|----------|
| NF-01 | **性能**：单个评测任务可支持数千至数万用例，任务队列需能稳定处理。在10并发下，API响应时间<200ms。 | 压力测试通过。 |
| NF-02 | **安全性**：模型API密钥必须加密存储（如AES-256），数据库连接信息等敏感配置使用环境变量。所有用户输入需进行防XSS、SQL注入处理。 | 安全审计通过。 |
| NF-03 | **可靠性**：任务执行过程中若发生部分请求失败（如网络超时），应自动重试（最多3次），并记录错误。系统应支持优雅关闭，正在执行的任务可恢复。 | 故障注入测试。 |
| NF-04 | **可扩展性**：后端服务支持水平扩展（如多个Worker实例）。数据库需支持读写分离（可选）。模型适配器架构允许快速接入新模型。 | 架构设计评审。 |
| NF-05 | **易用性**：前端界面简洁明了，操作流程符合用户直觉。提供必要的引导和提示。 | 用户验收测试。 |
| NF-06 | **兼容性**：系统应兼容主流浏览器（Chrome、Firefox、Edge）。 | 兼容性测试。 |
| NF-07 | **可复现性**：每个评测任务需保存完整配置快照，确保历史结果可复现。 | 数据回溯测试。 |

---

## 5. 技术栈建议

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端框架 | FastAPI | 高性能异步框架，自动生成OpenAPI文档。 |
| 数据库 | MySQL 8.0+ | 关系型数据库，存储元数据和评测结果。 |
| 任务队列 | Celery + Redis/RabbitMQ | 处理异步评测任务，支持分布式。 |
| 对象存储 | MinIO / 云OSS | 存储大型测试集文件、日志等（可选）。 |
| 前端框架 | React 18+ | 单页应用，配合Ant Design或Material-UI。 |
| 图表库 | ECharts / Recharts | 数据可视化。 |
| 部署 | Docker + Docker Compose / Kubernetes | 容器化部署，便于扩展。 |

---

## 6. 数据设计概要

### 主要表结构

#### model_registry（模型注册表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 自增主键 |
| name | VARCHAR | 模型名称 |
| provider | VARCHAR | 提供商（如openai, anthropic, local） |
| version | VARCHAR | 模型版本（如gpt-4-1106） |
| api_endpoint | TEXT | API地址 |
| api_key_encrypted | TEXT | 加密后的API密钥 |
| capabilities | JSON | 支持的能力，如["text","code"] |
| default_params | JSON | 默认调用参数（temperature等） |
| pricing | JSON | 计价规则，如{"input":0.5, "output":1.5}（美元/百万tokens） |
| status | TINYINT | 1启用 0禁用 |
| created_at | DATETIME | |

#### test_suite（测试集）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | |
| name | VARCHAR | 测试集名称 |
| description | TEXT | 描述 |
| source | VARCHAR | 来源（如MMLU, GSM8K, custom） |
| version | VARCHAR | 版本号 |
| ability_dimensions | JSON | 关联的能力维度列表，如["knowledge","reasoning"] |
| category_distribution | JSON | 类别分布统计（可选） |
| created_at | DATETIME | |

#### test_case（测试用例）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| suite_id | INT | 所属测试集ID |
| prompt | TEXT | 输入提示 |
| reference_answer | JSON | 参考答案，可包含多个字段 |
| metadata | JSON | 元数据（如类别、难度、题型） |
| hash | VARCHAR | 内容的哈希值，用于去重 |

#### prompt_template（提示词模板）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | |
| name | VARCHAR | 模板名称 |
| content | TEXT | 模板内容，包含占位符如{question} |
| ability_dimension | VARCHAR | 关联的能力维度 |
| version | VARCHAR | 版本 |
| default_params | JSON | 默认参数 |
| created_at | DATETIME | |

#### evaluation_job（评测任务/实验）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | |
| name | VARCHAR | 任务名称 |
| status | ENUM | pending, running, completed, failed, cancelled |
| config_snapshot | JSON | 完整配置快照（模型列表、测试集ID、prompt模板、评分配置、性能配置、随机种子等） |
| total_cases | INT | 总用例数（冗余） |
| processed_cases | INT | 已处理用例数 |
| created_by | VARCHAR | 创建人 |
| created_at | DATETIME | |
| completed_at | DATETIME | |

#### evaluation_result（评测结果）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| job_id | INT | 任务ID |
| model_id | INT | 模型ID |
| case_id | BIGINT | 测试用例ID |
| raw_output | LONGTEXT | 模型原始输出 |
| auto_score | FLOAT | AI裁判/规则给出的分数 |
| auto_metadata | JSON | 自动评分的详细信息（如评分理由） |
| judge_model | VARCHAR | 记录执行评分的裁判模型（如有多个裁判可存数组） |
| dimension_scores | JSON | 各维度得分，如{"correctness":4, "relevance":5} |
| human_score | FLOAT | 人工修改后的分数（若未修改则为NULL） |
| final_score | FLOAT | 最终使用的分数（计算字段或冗余，优先取human_score） |
| scored_by | ENUM | auto, human |
| review_status | ENUM | pending, reviewed |
| latency_ms | INT | 总延迟（毫秒） |
| ttft_ms | INT | 首Token延迟（毫秒） |
| prompt_tokens | INT | 输入tokens数 |
| completion_tokens | INT | 输出tokens数 |
| total_tokens | INT | 总tokens数 |
| tps | FLOAT | tokens per second（可选） |
| throughput | FLOAT | requests/sec（针对压力测试） |
| error | TEXT | 错误信息（如有） |
| cost_usd | DECIMAL(10,6) | 估算成本 |
| performance_metadata | JSON | 其他性能数据（显存、CPU等） |
| created_at | DATETIME | |

#### aggregated_report（聚合报告缓存）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | |
| job_id | INT | 任务ID |
| model_id | INT | 模型ID |
| summary | JSON | 效果得分统计（平均分、各维度分） |
| performance_summary | JSON | 性能统计（平均延迟、P95、TPS、吞吐量、总成本等） |
| chart_data | JSON | 预计算图表数据（可选） |
| updated_at | DATETIME | |

#### leaderboard（排行榜缓存）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | |
| model_id | INT | |
| ability_dimension | VARCHAR | 能力维度 |
| score | FLOAT | 综合得分 |
| job_id | INT | 产生该得分的最近任务ID |
| updated_at | DATETIME | |

---

## 7. API设计概要

| 端点 | 方法 | 功能 | 备注 |
|------|------|------|------|
| \`/api/v1/models\` | GET | 获取模型列表 | 支持分页、搜索 |
| \`/api/v1/models\` | POST | 添加新模型 | 密钥需加密 |
| \`/api/v1/models/{id}\` | PUT | 修改模型 | |
| \`/api/v1/models/{id}\` | DELETE | 删除模型 | 需确认无关联任务 |
| \`/api/v1/test-suites\` | GET | 获取测试集列表 | 支持按能力维度筛选 |
| \`/api/v1/test-suites\` | POST | 上传测试集 | 支持文件上传 |
| \`/api/v1/test-suites/{id}/preview\` | GET | 预览测试集样本 | 随机返回若干条 |
| \`/api/v1/prompt-templates\` | GET | 获取prompt模板列表 | |
| \`/api/v1/prompt-templates\` | POST | 创建模板 | |
| \`/api/v1/jobs\` | POST | 创建评测任务 | 返回任务ID |
| \`/api/v1/jobs/{id}\` | GET | 获取任务状态 | 包含进度 |
| \`/api/v1/jobs/{id}\` | DELETE | 取消任务 | |
| \`/api/v1/jobs/{id}/results\` | GET | 获取聚合报告 | 返回图表数据 |
| \`/api/v1/jobs/{id}/results/detail\` | GET | 获取详细结果列表 | 支持分页、筛选 |
| \`/api/v1/results/{id}\` | PATCH | 人工修改分数 | 更新human_score等 |
| \`/api/v1/jobs/{id}/performance\` | GET | 获取性能报告 | 可选 |
| \`/api/v1/leaderboard\` | GET | 获取排行榜 | 支持按维度筛选 |

---

## 8. 前端页面设计概要

### 8.1 仪表盘
- 展示最近评测任务卡片（名称、状态、进度、创建时间）。
- 提供快速创建任务的入口。
- 展示全局排行榜简表。

### 8.2 模型管理页
- 表格展示所有模型，支持增删改查。
- 表单包含模型详细配置（含版本字段）。

### 8.3 测试集管理页
- 列表展示所有测试集，显示名称、来源、能力维度、题目数量、版本。
- 上传区域（拖拽或点击），上传时可指定能力维度。
- 点击测试集进入详情页，展示类别分布、预览样本。

### 8.4 Prompt模板管理页
- 列表展示prompt模板，支持增删改查。
- 编辑器支持变量占位符提示。

### 8.5 创建任务页
- 多步骤向导：
1. 选择模型（多选，显示版本）。
2. 选择测试集（可筛选能力维度、版本）。
3. 选择prompt模板（可选）。
4. 评分配置（启用AI裁判？选用裁判模型（可多选）？多裁判策略？需要人工复核？）。
5. 性能配置（是否收集性能？是否压力测试？并发数？）。
6. 确认并提交。

### 8.6 任务详情页
- 顶部展示任务基本信息、进度条。
- 标签页：
- **概览**：能力维度雷达图、性能指标卡片、成本汇总。
- **详细结果**：表格，每行显示用例摘要、各维度分数、最终分数、性能数据。可筛选“待审核”状态。
- **性能分析**：延迟分布图、TPS趋势、成本累积图、错误分析。
- **对比**：可勾选多个模型进行对比（雷达图、柱状图）。
- 人工审核视图：点击待审核行，弹出侧边栏或模态框，展示完整信息（含各维度分数）并允许修改。

### 8.7 排行榜页
- 展示各能力维度的模型排名，可切换维度查看。
- 支持点击模型查看详细历史评测结果。

### 8.8 报告分享页（可选）
- 公开只读页面，包含主要图表和数据。

---

## 9. 未来扩展方向（参考）

- **Agent评测**：支持工具调用、多步推理场景，引入AgentBench等测试集。
- **长上下文评测**：支持超长文档理解与生成，引入LongBench等。
- **RAG评测**：支持检索增强生成场景，评估检索准确性和答案忠实度，引入RAGAS等指标。
- **多模态评测**：支持图像、视频输入，扩展模型能力维度。

---

### 10. 附录

### 术语表
- **AI裁判**：使用大模型对模型输出进行评分的方法。
- **能力维度**：模型评测的细分方向，如知识、推理、代码等。
- **TTFT**：Time To First Token，首Token延迟。
- **TPS**：Tokens Per Second，每秒生成的token数。
- **P95**：95分位值，用于衡量长尾延迟。
- **A/B 测试**：在相同测试集下通过改变单一变量（如 Prompt）观察效果差异的方法。
- **实验快照**：保存评测任务的全部配置，用于结果复现。

---`;

    const systemLogicDoc = `# 系统逻辑文档（System Logic）

## 1. 总体处理链路
1. 用户在“创建评测”页配置模型、测试集、Prompt、评分与性能参数。
2. 系统创建任务并固化 config_snapshot（用于结果复现与审计）。
3. Worker 按 (模型 × Prompt × 用例) 组合执行推理，记录原始输出与性能数据。
4. 评分引擎按题型分流：
   - 客观题优先规则判分（单选/多选/判断）。
   - 主观题走 AI 裁判评分（0-10）。
5. 若启用人工复核，结果先标记“待审”；复核后写入最终分。
6. 任务结束后聚合生成报告（效果、性能、成本、维度分、客观拆解）。

## 2. 评分逻辑
### 2.1 客观题规则判分
- 目标题型：单选、多选、判断。
- 规则分定义：1=正确，0=错误。
- 可配置忽略大小写（C 与 c 视为一致）。
- 规则分来源在界面与导出中标注为“规则自动判分”。

### 2.2 主观题 AI 裁判
- 评分区间：0-10。
- 支持单裁判或多裁判；多裁判可返回多条理由与子分。
- 评分元数据包含理由、维度分、裁判模型信息，便于追溯。

### 2.3 综合得分（主客观混合）
- 混合任务口径：综合得分 = (客观准确率×10 + 主观题均分) / 2。
- 纯客观任务：按客观准确率展示核心分。
- 纯主观任务：综合得分等于主观均分。

## 3. 人工复核逻辑
- 复核区默认优先带入 final_score，其次 auto_score。
- 客观题复核支持快捷操作：判定正确(1)、判定错误(0)、采用机器分。
- 主观题复核允许在机器分基础上人工调整并填写评语。
- 所有复核结果写入审核状态、审核人、审核评语与最终分。

## 4. 结果展示逻辑
- 总览页：展示综合得分、维度分、性能与成本。
- 并排对比页：按题目横向对比各模型输出、分数与理由。
- 详细结果页：展示题型、题目、输出、机器分、最终分、状态、人工入口。
- 对“客观分=1/0”与“百分比展示”的说明通过问号提示统一解释。

## 5. 导出逻辑
### 5.1 总览 CSV
- 面向管理层看板，输出任务上下文、综合指标、客观拆解、性能与成本。

### 5.2 总览 MD
- 面向评审归档，输出配置快照、核心对比、客观拆解、成本与令牌消耗。

### 5.3 明细 CSV
- 面向审计追溯，输出题型题目、参考答案、判分来源、规则匹配、人工审核与性能细节。

## 6. 稳定性与可追溯
- 任务支持失败重试与批量重算。
- 关键流程通过元数据（source/judges/reason）保证可解释性。
- 导出字段覆盖“输入—输出—评分—审核—性能—成本”全链路。`;

    return (
        <div style={{ padding: '0 12px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* 项目介绍 */}
            <section style={{ marginBottom: '24px' }}>
                <Title level={3}>
                    <ThunderboltOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                    项目介绍 (Project Overview)
                </Title>
                <Paragraph>
                    <Text strong>AIPC (AI Performance Center)</Text> 是一款企业级大模型自动化评测平台。在 LLM 飞速发展的今天，我们不仅关注模型“聪明不聪明”（效果），更关注模型“快不快”、“贵不贵”（性能与成本）。
                </Paragraph>
                <Paragraph>
                    <Text type="secondary">制作者：田长金（Tavian）</Text>
                </Paragraph>
                <Paragraph>
                    本系统旨在通过标准化的流程，为算法工程师和业务决策者提供客观、量化的模型对比依据。
                </Paragraph>

                <Title level={4} style={{ marginTop: '16px' }}>🛠️ 技术架构 (Technical Stack)</Title>
                <List
                    size="small"
                    dataSource={[
                        { label: '后端 (Backend)', value: 'FastAPI (Python) - 异步高性能框架' },
                        { label: '任务调度 (Worker)', value: 'Celery + Redis - 处理耗时的并发请求' },
                        { label: '前端 (Frontend)', value: 'React 18 + Ant Design 5.x - 现代化 UI 交互' },
                        { label: '可视化 (Visualization)', value: 'ECharts - 多维度数据透视' },
                        { label: '数据存储 (Database)', value: 'SQLAlchemy + MySQL - 结构化评测结果管理' }
                    ]}
                    renderItem={item => (
                        <List.Item>
                            <Text code>{item.label}</Text> {item.value}
                        </List.Item>
                    )}
                />
            </section>

            <Divider />

            {/* 使用指南 */}
            <section style={{ marginBottom: '24px' }}>
                <Title level={3}>
                    <ExperimentOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                    使用指南 (Usage Guide)
                </Title>
                <Steps
                    direction="vertical"
                    size="small"
                    current={-1}
                    items={stepsItems}
                    style={{ marginLeft: '8px' }}
                />
            </section>

            <Divider />

            <section style={{ marginBottom: '24px' }}>
                <Title level={3}>
                    <BarChartOutlined style={{ color: '#722ed1', marginRight: '8px' }} />
                    评分与导出口径（关键）
                </Title>
                <Title level={5} style={{ marginTop: '8px' }}>评分口径</Title>
                <List
                    size="small"
                    dataSource={scoringAndReviewGuide}
                    renderItem={item => (
                        <List.Item>
                            <Text>{item}</Text>
                        </List.Item>
                    )}
                />
                <Title level={5} style={{ marginTop: '12px' }}>导出口径</Title>
                <List
                    size="small"
                    dataSource={exportGuide}
                    renderItem={item => (
                        <List.Item>
                            <Text>{item}</Text>
                        </List.Item>
                    )}
                />
            </section>

            <Divider />

            <section>
                <Title level={3}>
                    <FileTextOutlined style={{ color: '#eb2f96', marginRight: '8px' }} />
                    需求文档 (Requirements V3.0)
                </Title>
                <div style={{
                    maxHeight: 500,
                    overflow: 'auto',
                    padding: 20,
                    background: '#ffffff',
                    borderRadius: 8,
                    border: '1px solid #d9d9d9',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    marginTop: '16px'
                }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'Consolas, "Courier New", monospace' }}>
                        {requirementDoc}
                    </div>
                </div>
            </section>

            <Divider />

            <section>
                <Title level={3}>
                    <FileTextOutlined style={{ color: '#13c2c2', marginRight: '8px' }} />
                    系统逻辑文档 (System Logic)
                </Title>
                <div style={{
                    maxHeight: 500,
                    overflow: 'auto',
                    padding: 20,
                    background: '#ffffff',
                    borderRadius: 8,
                    border: '1px solid #d9d9d9',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    marginTop: '16px'
                }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'Consolas, "Courier New", monospace' }}>
                        {systemLogicDoc}
                    </div>
                </div>
            </section>

            <Divider />

            <section>
                <Title level={3}>
                    <BarChartOutlined style={{ color: '#fa8c16', marginRight: '8px' }} />
                    系统架构图 (System Architecture)
                </Title>
                <div style={{
                    maxHeight: 600,
                    overflow: 'auto',
                    padding: 20,
                    background: '#ffffff',
                    borderRadius: 8,
                    border: '1px solid #d9d9d9',
                    marginTop: '16px',
                    textAlign: 'center'
                }}>
                    {/* SVG容器 - 请将您的SVG内容复制到这里 */}
                    <div 
                        dangerouslySetInnerHTML={{
                            __html: `
                                <?xml version="1.0" encoding="UTF-8"?>
                                <svg xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" id="mermaid-svg-28" width="100%" class="flowchart" style="max-width: 100%;" viewBox="-53.346838378906256 -53.346838378906256 2108.3382080078127 1173.6304443359377" height="100%"><style>#mermaid-svg-28{font-family:"trebuchet ms",verdana,arial,sans-serif;font-size:16px;fill:#333;}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#mermaid-svg-28 .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#mermaid-svg-28 .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#mermaid-svg-28 .error-icon{fill:#552222;}#mermaid-svg-28 .error-text{fill:#552222;stroke:#552222;}#mermaid-svg-28 .edge-thickness-normal{stroke-width:1px;}#mermaid-svg-28 .edge-thickness-thick{stroke-width:3.5px;}#mermaid-svg-28 .edge-pattern-solid{stroke-dasharray:0;}#mermaid-svg-28 .edge-thickness-invisible{stroke-width:0;fill:none;}#mermaid-svg-28 .edge-pattern-dashed{stroke-dasharray:3;}#mermaid-svg-28 .edge-pattern-dotted{stroke-dasharray:2;}#mermaid-svg-28 .marker{fill:#333333;stroke:#333333;}#mermaid-svg-28 .marker.cross{stroke:#333333;}#mermaid-svg-28 svg{font-family:"trebuchet ms",verdana,arial,sans-serif;font-size:16px;}#mermaid-svg-28 p{margin:0;}#mermaid-svg-28 .label{font-family:"trebuchet ms",verdana,arial,sans-serif;color:#333;}#mermaid-svg-28 .cluster-label text{fill:#333;}#mermaid-svg-28 .cluster-label span{color:#333;}#mermaid-svg-28 .cluster-label span p{background-color:transparent;}#mermaid-svg-28 .label text,#mermaid-svg-28 span{fill:#333;color:#333;}#mermaid-svg-28 .node rect,#mermaid-svg-28 .node circle,#mermaid-svg-28 .node ellipse,#mermaid-svg-28 .node polygon,#mermaid-svg-28 .node path{fill:#ECECFF;stroke:#9370DB;stroke-width:1px;}#mermaid-svg-28 .rough-node .label text,#mermaid-svg-28 .node .label text,#mermaid-svg-28 .image-shape .label,#mermaid-svg-28 .icon-shape .label{text-anchor:middle;}#mermaid-svg-28 .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#mermaid-svg-28 .rough-node .label,#mermaid-svg-28 .node .label,#mermaid-svg-28 .image-shape .label,#mermaid-svg-28 .icon-shape .label{text-align:center;}#mermaid-svg-28 .node.clickable{cursor:pointer;}#mermaid-svg-28 .root .anchor path{fill:#333333!important;stroke-width:0;stroke:#333333;}#mermaid-svg-28 .arrowheadPath{fill:#333333;}#mermaid-svg-28 .edgePath .path{stroke:#333333;stroke-width:2.0px;}#mermaid-svg-28 .flowchart-link{stroke:#333333;fill:none;}#mermaid-svg-28 .edgeLabel{background-color:rgba(232,232,232, 0.8);text-align:center;}#mermaid-svg-28 .edgeLabel p{background-color:rgba(232,232,232, 0.8);}#mermaid-svg-28 .edgeLabel rect{opacity:0.5;background-color:rgba(232,232,232, 0.8);fill:rgba(232,232,232, 0.8);}#mermaid-svg-28 .labelBkg{background-color:rgba(232, 232, 232, 0.5);}#mermaid-svg-28 .cluster rect{fill:#ffffde;stroke:#aaaa33;stroke-width:1px;}#mermaid-svg-28 .cluster text{fill:#333;}#mermaid-svg-28 .cluster span{color:#333;}#mermaid-svg-28 div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:"trebuchet ms",verdana,arial,sans-serif;font-size:12px;background:hsl(80, 100%, 96.2745098039%);border:1px solid #aaaa33;border-radius:2px;pointer-events:none;z-index:100;}#mermaid-svg-28 .flowchartTitleText{text-anchor:middle;font-size:18px;fill:#333;}#mermaid-svg-28 rect.text{fill:none;stroke-width:0;}#mermaid-svg-28 .icon-shape,#mermaid-svg-28 .image-shape{background-color:rgba(232,232,232, 0.8);text-align:center;}#mermaid-svg-28 .icon-shape p,#mermaid-svg-28 .image-shape p{background-color:rgba(232,232,232, 0.8);padding:2px;}#mermaid-svg-28 .icon-shape rect,#mermaid-svg-28 .image-shape rect{opacity:0.5;background-color:rgba(232,232,232, 0.8);fill:rgba(232,232,232, 0.8);}#mermaid-svg-28 .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#mermaid-svg-28 .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#mermaid-svg-28 :root{--mermaid-font-family:"trebuchet ms",verdana,arial,sans-serif;}</style><g><marker id="mermaid-svg-28_flowchart-v2-pointEnd" class="marker flowchart-v2" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" class="arrowMarkerPath" style="stroke-width: 1; stroke-dasharray: 1, 0;"/></marker><marker id="mermaid-svg-28_flowchart-v2-pointStart" class="marker flowchart-v2" viewBox="0 0 10 10" refX="4.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 5 L 10 10 L 10 0 z" class="arrowMarkerPath" style="stroke-width: 1; stroke-dasharray: 1, 0;"/></marker><marker id="mermaid-svg-28_flowchart-v2-circleEnd" class="marker flowchart-v2" viewBox="0 0 10 10" refX="11" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle cx="5" cy="5" r="5" class="arrowMarkerPath" style="stroke-width: 1; stroke-dasharray: 1, 0;"/></marker><marker id="mermaid-svg-28_flowchart-v2-circleStart" class="marker flowchart-v2" viewBox="0 0 10 10" refX="-1" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><circle cx="5" cy="5" r="5" class="arrowMarkerPath" style="stroke-width: 1; stroke-dasharray: 1, 0;"/></marker><marker id="mermaid-svg-28_flowchart-v2-crossEnd" class="marker cross flowchart-v2" viewBox="0 0 11 11" refX="12" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M 1,1 l 9,9 M 10,1 l -9,9" class="arrowMarkerPath" style="stroke-width: 2; stroke-dasharray: 1, 0;"/></marker><marker id="mermaid-svg-28_flowchart-v2-crossStart" class="marker cross flowchart-v2" viewBox="0 0 11 11" refX="-1" refY="5.2" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M 1,1 l 9,9 M 10,1 l -9,9" class="arrowMarkerPath" style="stroke-width: 2; stroke-dasharray: 1, 0;"/></marker><g class="root"><g class="clusters"><g class="cluster" id="外部服务" data-look="classic"><rect style="" x="40" y="906.9367294311523" width="1953.64453125" height="152"/><g class="cluster-label" transform="translate(984.822265625, 906.9367294311523)"><foreignObject width="64" height="24"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>外部服务</p></span></div></foreignObject></g></g><g class="cluster" id="数据存储层" data-look="classic"><rect style="" x="1080.5703125" y="701" width="416.46875" height="155.93672943115234"/><g class="cluster-label" transform="translate(1248.8046875, 701)"><foreignObject width="80" height="24"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>数据存储层</p></span></div></foreignObject></g></g><g class="cluster" id="异步任务层" data-look="classic"><rect style="" x="8" y="379" width="794.419921875" height="477.93672943115234"/><g class="cluster-label" transform="translate(365.2099609375, 379)"><foreignObject width="80" height="24"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>异步任务层</p></span></div></foreignObject></g></g><g class="cluster" id="后端API层" data-look="classic"><rect style="" x="1100.935546875" y="379" width="795.828125" height="248"/><g class="cluster-label" transform="translate(1463.443359375, 379)"><foreignObject width="70.8125" height="24"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>后端API层</p></span></div></foreignObject></g></g><g class="cluster" id="前端层" data-look="classic"><rect style="" x="822.419921875" y="379" width="258.515625" height="248"/><g class="cluster-label" transform="translate(927.677734375, 379)"><foreignObject width="48" height="24"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>前端层</p></span></div></foreignObject></g></g><g class="cluster" id="接入层" data-look="classic"><rect style="" x="864.796875" y="177" width="1128.84765625" height="128"/><g class="cluster-label" transform="translate(1405.220703125, 177)"><foreignObject width="48" height="24"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>接入层</p></span></div></foreignObject></g></g></g><g class="edgePaths"><path d="M1578.602,103L1578.602,109.167C1578.602,115.333,1578.602,127.667,1578.602,140C1578.602,152.333,1578.602,164.667,1578.602,174.333C1578.602,184,1578.602,191,1578.602,194.5L1578.602,198" id="L_User_Nginx_0" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M1479.84,251.082L1391.813,260.068C1303.786,269.055,1127.732,287.027,1039.705,302.18C951.678,317.333,951.678,329.667,951.678,342C951.678,354.333,951.678,366.667,951.678,386.333C951.678,406,951.678,433,951.678,446.5L951.678,460" id="L_Nginx_Static_0" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M1538.63,280L1534.36,284.167C1530.09,288.333,1521.549,296.667,1517.278,307C1513.008,317.333,1513.008,329.667,1513.008,342C1513.008,354.333,1513.008,366.667,1513.008,376.333C1513.008,386,1513.008,393,1513.008,396.5L1513.008,400" id="L_Nginx_API_0" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M1429.66,534.046L1388.068,549.538C1346.477,565.031,1263.293,596.015,1221.701,617.674C1180.109,639.333,1180.109,651.667,1180.109,664C1180.109,676.333,1180.109,688.667,1180.109,698.736C1180.109,708.806,1180.109,716.612,1180.109,720.515L1180.109,724.417" id="L_API_DB_0" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M1429.66,579.747L1421.107,587.623C1412.555,595.498,1395.449,611.249,1386.896,625.291C1378.344,639.333,1378.344,651.667,1378.344,664C1378.344,676.333,1378.344,688.667,1378.344,698.333C1378.344,708,1378.344,715,1378.344,718.5L1378.344,722" id="L_API_ObjectStore_0" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M1488.083,602L1487.034,606.167C1485.985,610.333,1483.887,618.667,1354.107,629C1224.327,639.333,966.866,651.667,838.135,664C709.404,676.333,709.404,688.667,685.25,702.822C661.096,716.978,612.788,732.955,588.633,740.944L564.479,748.933" id="L_API_Broker_0" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M1570.673,602L1573.1,606.167C1575.527,610.333,1580.38,618.667,1582.807,629C1585.234,639.333,1585.234,651.667,1585.234,664C1585.234,676.333,1585.234,688.667,1585.234,707.828C1585.234,726.989,1585.234,752.979,1585.234,778.968C1585.234,804.958,1585.234,830.947,1585.234,848.109C1585.234,865.27,1585.234,873.603,1585.234,881.937C1585.234,890.27,1585.234,898.603,1578.48,906.607C1571.725,914.611,1558.215,922.286,1551.46,926.124L1544.705,929.961" id="L_API_ModelAPI_0" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M304.578,543.607L270.657,557.506C236.736,571.405,168.895,599.202,134.974,619.268C101.053,639.333,101.053,651.667,101.053,664C101.053,676.333,101.053,688.667,148,704.657C194.947,720.647,288.841,740.294,335.788,750.118L382.735,759.941" id="L_Worker_Broker_0" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M304.578,552.033L279.324,564.527C254.07,577.022,203.561,602.011,178.307,620.672C153.053,639.333,153.053,651.667,153.053,664C153.053,676.333,153.053,688.667,153.053,707.828C153.053,726.989,153.053,752.979,153.053,778.968C153.053,804.958,153.053,830.947,153.053,848.109C153.053,865.27,153.053,873.603,153.053,881.937C153.053,890.27,153.053,898.603,347.121,914.13C541.188,929.656,929.324,952.375,1123.392,963.734L1317.46,975.094" id="L_Worker_ModelAPI_0" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M326.454,578L318.045,586.167C309.636,594.333,292.817,610.667,284.407,625C275.998,639.333,275.998,651.667,275.998,664C275.998,676.333,275.998,688.667,275.998,707.828C275.998,726.989,275.998,752.979,275.998,778.968C275.998,804.958,275.998,830.947,275.998,848.109C275.998,865.27,275.998,873.603,275.998,881.937C275.998,890.27,275.998,898.603,270.283,908.466C264.568,918.329,253.137,929.721,247.422,935.417L241.707,941.113" id="L_Worker_JudgeAPI_0" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M389.476,578L387.929,586.167C386.382,594.333,383.288,610.667,381.74,625C380.193,639.333,380.193,651.667,380.193,664C380.193,676.333,380.193,688.667,502.093,706.715C623.992,724.763,867.791,748.526,989.69,760.408L1111.589,772.29" id="L_Worker_DB_0" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M486.368,578L495.372,586.167C504.375,594.333,522.382,610.667,531.385,625C540.389,639.333,540.389,651.667,540.389,664C540.389,676.333,540.389,688.667,665.435,706.468C790.481,724.27,1040.573,747.54,1165.619,759.175L1290.666,770.81" id="L_Worker_ObjectStore_0" class="edge-thickness-normal edge-pattern-solid edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M1180.109,829.519L1180.109,834.089C1180.109,838.658,1180.109,847.798,1180.109,856.534C1180.109,865.27,1180.109,873.603,1180.109,881.937C1180.109,890.27,1180.109,898.603,1254.672,912.518C1329.235,926.432,1478.361,945.928,1552.924,955.675L1627.487,965.423" id="L_DB_Monitor_0" class="edge-thickness-normal edge-pattern-dotted edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M1596.355,535.853L1634.895,551.045C1673.434,566.236,1750.512,596.618,1789.051,617.976C1827.59,639.333,1827.59,651.667,1827.59,664C1827.59,676.333,1827.59,688.667,1827.59,707.828C1827.59,726.989,1827.59,752.979,1827.59,778.968C1827.59,804.958,1827.59,830.947,1827.59,848.109C1827.59,865.27,1827.59,873.603,1827.59,881.937C1827.59,890.27,1827.59,898.603,1824.402,906.434C1821.213,914.264,1814.837,921.592,1811.648,925.256L1808.46,928.919" id="L_API_Monitor_0" class="edge-thickness-normal edge-pattern-dotted edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M502.789,560.775L521.722,571.813C540.656,582.85,578.522,604.925,597.455,622.129C616.389,639.333,616.389,651.667,616.389,664C616.389,676.333,616.389,688.667,616.389,707.828C616.389,726.989,616.389,752.979,616.389,778.968C616.389,804.958,616.389,830.947,616.389,848.109C616.389,865.27,616.389,873.603,616.389,881.937C616.389,890.27,616.389,898.603,784.901,913.955C953.413,929.306,1290.437,951.675,1458.95,962.859L1627.462,974.043" id="L_Worker_Monitor_0" class="edge-thickness-normal edge-pattern-dotted edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/><path d="M1677.363,259.691L1717.263,267.243C1757.163,274.794,1836.964,289.897,1876.864,303.615C1916.764,317.333,1916.764,329.667,1916.764,342C1916.764,354.333,1916.764,366.667,1916.764,393.5C1916.764,420.333,1916.764,461.667,1916.764,503C1916.764,544.333,1916.764,585.667,1916.764,612.5C1916.764,639.333,1916.764,651.667,1916.764,664C1916.764,676.333,1916.764,688.667,1916.764,707.828C1916.764,726.989,1916.764,752.979,1916.764,778.968C1916.764,804.958,1916.764,830.947,1916.764,848.109C1916.764,865.27,1916.764,873.603,1916.764,881.937C1916.764,890.27,1916.764,898.603,1908.848,906.644C1900.932,914.684,1885.1,922.431,1877.184,926.305L1869.268,930.179" id="L_Nginx_Monitor_0" class="edge-thickness-normal edge-pattern-dotted edge-thickness-normal edge-pattern-solid flowchart-link" style="" marker-end="url(#mermaid-svg-28_flowchart-v2-pointEnd)"/></g><g class="edgeLabels"><g class="edgeLabel" transform="translate(1578.6015625, 140)"><g class="label" transform="translate(-22.83203125, -12)"><foreignObject width="45.6640625" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"><p>HTTPS</p></span></div></foreignObject></g></g><g class="edgeLabel" transform="translate(951.677734375, 342)"><g class="label" transform="translate(-48, -12)"><foreignObject width="96" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"><p>托管静态资源</p></span></div></foreignObject></g></g><g class="edgeLabel" transform="translate(1513.0078125, 342)"><g class="label" transform="translate(-96.26171875, -12)"><foreignObject width="192.5234375" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"><p>API请求 (REST/WebSocket)</p></span></div></foreignObject></g></g><g class="edgeLabel" transform="translate(1180.109375, 664)"><g class="label" transform="translate(-32, -12)"><foreignObject width="64" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"><p>读写数据</p></span></div></foreignObject></g></g><g class="edgeLabel" transform="translate(1378.34375, 664)"><g class="label" transform="translate(-52.1953125, -12)"><foreignObject width="104.390625" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"><p>上传/下载文件</p></span></div></foreignObject></g></g><g class="edgeLabel" transform="translate(709.404296875, 664)"><g class="label" transform="translate(-73.015625, -12)"><foreignObject width="146.03125" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"><p>发布任务 / 读写缓存</p></span></div></foreignObject></g></g><g class="edgeLabel" transform="translate(1585.234375, 778.9683647155762)"><g class="label" transform="translate(-68.1953125, -12)"><foreignObject width="136.390625" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"><p>模型探活/同步调用</p></span></div></foreignObject></g></g><g class="edgeLabel" transform="translate(101.052734375, 664)"><g class="label" transform="translate(-32, -12)"><foreignObject width="64" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"><p>消费任务</p></span></div></foreignObject></g></g><g class="edgeLabel" transform="translate(153.052734375, 778.9683647155762)"><g class="label" transform="translate(-48, -12)"><foreignObject width="96" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"><p>模型推理调用</p></span></div></foreignObject></g></g><g class="edgeLabel" transform="translate(275.998046875, 778.9683647155762)"><g class="label" transform="translate(-54.9453125, -12)"><foreignObject width="109.890625" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"><p>AI裁判评分调用</p></span></div></foreignObject></g></g><g class="edgeLabel" transform="translate(380.193359375, 664)"><g class="label" transform="translate(-84.1953125, -12)"><foreignObject width="168.390625" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"><p>写入评测结果/性能数据</p></span></div></foreignObject></g></g><g class="edgeLabel" transform="translate(540.388671875, 664)"><g class="label" transform="translate(-56, -12)"><foreignObject width="112" height="24"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"><p>读取测试集文件</p></span></div></foreignObject></g></g><g class="edgeLabel"><g class="label" transform="translate(0, 0)"><foreignObject width="0" height="0"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g class="label" transform="translate(0, 0)"><foreignObject width="0" height="0"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g class="label" transform="translate(0, 0)"><foreignObject width="0" height="0"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g class="label" transform="translate(0, 0)"><foreignObject width="0" height="0"><div xmlns="http://www.w3.org/1999/xhtml" class="labelBkg" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="edgeLabel"></span></div></foreignObject></g></g></g><g class="nodes"><g class="node default" id="flowchart-User-0" transform="translate(1578.6015625, 55.5)"><circle class="basic label-container" style="" r="47.5" cx="0" cy="0"/><g class="label" style="" transform="translate(-40, -12)"><rect/><foreignObject width="80" height="24"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>用户浏览器</p></span></div></foreignObject></g></g><g class="node default" id="flowchart-Nginx-1" transform="translate(1578.6015625, 241)"><rect class="basic label-container" style="" x="-98.76171875" y="-39" width="197.5234375" height="78"/><g class="label" style="" transform="translate(-68.76171875, -24)"><rect/><foreignObject width="137.5234375" height="48"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>Nginx 负载均衡<br />SSL终止 / 反向代理</p></span></div></foreignObject></g></g><g class="node default" id="flowchart-Static-2" transform="translate(951.677734375, 503)"><rect class="basic label-container" style="" x="-94.2578125" y="-39" width="188.515625" height="78"/><g class="label" style="" transform="translate(-64.2578125, -24)"><rect/><foreignObject width="128.515625" height="48"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>React 静态资源<br />Ant Design 组件库</p></span></div></foreignObject></g></g><g class="node default" id="flowchart-API-3" transform="translate(1513.0078125, 503)"><rect class="basic label-container" style="" x="-83.34765625" y="-99" width="166.6953125" height="198"/><g class="label" style="" transform="translate(-53.34765625, -84)"><rect/><foreignObject width="106.6953125" height="168"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>FastAPI 集群<br />- 模型管理<br />- 测试集管理<br />- Prompt模板<br />- 评测任务编排<br />- 报告生成<br />- 人工复核接口</p></span></div></foreignObject></g></g><g class="node default" id="flowchart-Broker-4" transform="translate(473.666015625, 778.9683647155762)"><rect class="basic label-container" style="" x="-87.015625" y="-39" width="174.03125" height="78"/><g class="label" style="" transform="translate(-57.015625, -24)"><rect/><foreignObject width="114.03125" height="48"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>Redis<br />消息队列 / 缓存</p></span></div></foreignObject></g></g><g class="node default" id="flowchart-Worker-5" transform="translate(403.68359375, 503)"><rect class="basic label-container" style="" x="-99.10546875" y="-75" width="198.2109375" height="150"/><g class="label" style="" transform="translate(-69.10546875, -60)"><rect/><foreignObject width="138.2109375" height="120"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>Celery Worker 集群<br />- 模型推理调用<br />- AI裁判评分<br />- 性能数据采集<br />- 重试机制</p></span></div></foreignObject></g></g><g class="node default" id="flowchart-DB-6" transform="translate(1180.109375, 778.9683647155762)"><path d="M0,12.700633417379004 a64.5390625,12.700633417379004 0,0,0 129.078125,0 a64.5390625,12.700633417379004 0,0,0 -129.078125,0 l0,75.70063341737901 a64.5390625,12.700633417379004 0,0,0 129.078125,0 l0,-75.70063341737901" class="basic label-container" style="" transform="translate(-64.5390625, -50.55095012606851)"/><g class="label" style="" transform="translate(-57.0390625, -14)"><rect/><foreignObject width="114.078125" height="48"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>MySQL 主从复制<br />结构化数据</p></span></div></foreignObject></g></g><g class="node default" id="flowchart-ObjectStore-7" transform="translate(1378.34375, 778.9683647155762)"><path d="M0,14.312242825842997 a83.6953125,14.312242825842997 0,0,0 167.390625,0 a83.6953125,14.312242825842997 0,0,0 -167.390625,0 l0,77.312242825843 a83.6953125,14.312242825842997 0,0,0 167.390625,0 l0,-77.312242825843" class="basic label-container" style="" transform="translate(-83.6953125, -52.968364238764494)"/><g class="label" style="" transform="translate(-76.1953125, -14)"><rect/><foreignObject width="152.390625" height="48"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>MinIO 对象存储<br />测试集文件/导出报告</p></span></div></foreignObject></g></g><g class="node default" id="flowchart-ModelAPI-8" transform="translate(1451.453125, 982.9367294311523)"><rect class="basic label-container" style="" x="-130" y="-51" width="260" height="102"/><g class="label" style="" transform="translate(-100, -36)"><rect/><foreignObject width="200" height="72"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table; white-space: break-spaces; line-height: 1.5; max-width: 200px; text-align: center; width: 200px;"><span class="nodeLabel"><p>外部模型API<br />OpenAI / Anthropic / Ollama / vLLM</p></span></div></foreignObject></g></g><g class="node default" id="flowchart-JudgeAPI-9" transform="translate(199.7421875, 982.9367294311523)"><rect class="basic label-container" style="" x="-121.5390625" y="-39" width="243.078125" height="78"/><g class="label" style="" transform="translate(-91.5390625, -24)"><rect/><foreignObject width="183.078125" height="48"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table-cell; white-space: nowrap; line-height: 1.5; max-width: 200px; text-align: center;"><span class="nodeLabel"><p>AI裁判模型<br />GPT-4 / Claude / Qwen等</p></span></div></foreignObject></g></g><g class="node default" id="flowchart-Monitor-10" transform="translate(1761.453125, 982.9367294311523)"><rect class="basic label-container" style="" x="-130" y="-51" width="260" height="102"/><g class="label" style="" transform="translate(-100, -36)"><rect/><foreignObject width="200" height="72"><div xmlns="http://www.w3.org/1999/xhtml" style="display: table; white-space: break-spaces; line-height: 1.5; max-width: 200px; text-align: center; width: 200px;"><span class="nodeLabel"><p>监控系统<br />Prometheus / Grafana / ELK</p></span></div></foreignObject></g></g></g></g></g></svg>
                            `
                        }}
                    />
                </div>
                <Paragraph style={{ marginTop: '16px', textAlign: 'center', color: '#666' }}>
                    <Text type="secondary">系统架构可视化图表（Mermaid格式渲染）</Text>
                </Paragraph>
            </section>

            <Divider />

            <section style={{ marginBottom: 24 }}>
                <Title level={4}>声明</Title>
                <Paragraph>
                    <Text strong>来自：Tavian（田长金）</Text>
                </Paragraph>
                <Paragraph>
                    <Text>完成时间：2026年3月16日晚</Text>
                </Paragraph>
            </section>
        </div>
    );
}
