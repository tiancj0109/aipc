# AIPC | 大模型自动化评测系统

AIPC (AI Performance & Capability Evaluation System) 是一款面向企业与研发团队的 **大语言模型自动化评测与分析平台**。系统支持多种云端 API 与本地部署模型的快速接入，提供客观题规则比对评分与主观题 AI 智能裁判评分，并通过多维度的可视化分析报表、延迟与吞吐量压测统计，提供一站式、可量化的模型选型与对比基准。

---

## 🌟 核心特性

- 🤖 **模型抽象与多提供商适配**
  - 内置 OpenAI, Anthropic, DeepSeek, 阿里云通义千问, 月之暗面 (Kimi), Ollama 等模型适配器，并支持本地模型的连通性探测。
- 📊 **多维度能力化评测**
  - 支持能力维度化（如知识、推理、代码、安全、对话等），并输出雷达图与能力对比排行榜。
- ⚖️ **双重评分机制 (客观+AI裁判)**
  - 客观题规则自动打分（支持精确匹配、正则及包含模式）。
  - 主观题 AI 裁判（LLM-as-a-Judge）智能评分，支持多裁判投票投票与答案位置随机打乱以消除偏见，同时提供详细的评分原因。
- ✍️ **人工复核与修正**
  - 对评测结果提供人工打分及修正视图，记录审计日志，完美结合机器的高效与人工的精确。
- ⚡ **性能与成本联合分析**
  - 记录首 Token 延迟 (TTFT)、总延迟、每秒 Token 数 (TPS)、每秒请求数 (Throughput)、错误率以及基于自定义费率的 Token 成本预算。
- 📝 **离线判卷模式**
  - 支持本地 CSV 文件直接导入，批量对已生成的模型输出进行 AI 裁判评分。
- 💬 **模型体验广场**
  - 独立 Playground 界面，支持与多个已注册模型并行即时对话测试。

---

## ⚙️ 技术栈

AIPC 采用现代前后端分离与异步任务队列架构，确保评测任务的大并发处理与系统响应的高速稳定。

| 模块 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **前端** | React 18, Vite, Ant Design v5, ECharts | 企业级单页应用，提供丰富的可视化图表与自适应暗色/亮色主题切换。 |
| **后端** | FastAPI (Python 3.10+), SQLAlchemy | 高性能异步 web 框架，原生生成交互式 API 文档。 |
| **任务队列** | Celery, Redis | 分布式任务队列，处理耗时的大批量模型评测与并发调用。 |
| **数据库** | MySQL 8.0, Redis | 存储模型元数据、测试集用例、实验任务及详细的评测结果。 |
| **容器化** | Docker, Docker Compose | 提供一键容器化部署及扩展 worker 的能力。 |

---

## 📂 项目结构

```text
├── AIPC/
│   ├── frontend/             # React 前端代码
│   │   ├── src/
│   │   │   ├── pages/        # 页面组件 (含 仪表盘, 离线判卷, 模型体验, 关于系统等)
│   │   │   ├── components/   # 通用组件
│   │   │   └── api/          # 接口请求封装
│   ├── backend/              # FastAPI 后端代码
│   │   ├── app/
│   │   │   ├── api/          # API 路由 (模型、测试集、评测任务等)
│   │   │   ├── models/       # 数据库模型 (SQLAlchemy)
│   │   │   ├── schemas/      # Pydantic 校验 Schema
│   │   │   ├── services/     # 核心业务逻辑
│   │   │   └── engine/       # Celery 异步评测调度与 AI 裁判执行
│   ├── docker-compose.yml    # 容器化编排文件
│   └── start_local.bat       # Windows 本地开发一键启动脚本
└── 需求文档.md                 # 详细产品需求规格说明书
```

---

## 🚀 快速开始

### 方式一：使用 Docker Compose 一键部署 (推荐)

系统已完成容器化配置，确保本地已安装 Docker 和 Docker Compose。

1. **克隆项目并进入 AIPC 目录**
   ```bash
   cd AIPC
   ```

2. **启动所有服务**
   ```bash
   docker-compose up -d --build
   ```
   该命令会自动拉取 MySQL 8.0、Redis 7.0 镜像，并自动编译构建后端、前端及任务 Worker 容器。

3. **访问系统**
   - 前端 Web 界面：`http://localhost:5173`
   - 后端 API 文档：`http://localhost:8000/docs`

---

### 方式二：本地开发调试部署 (Windows 环境)

#### 1. 初始化数据库与 Redis
- 本地启动 MySQL 并创建名为 `aipc` 的数据库。
- 本地启动 Redis 服务。

#### 2. 配置后端环境
1. 进入 `AIPC/backend` 目录，创建 Python 虚拟环境并激活：
   ```bash
   cd AIPC/backend
   python -m venv venv
   .\venv\Scripts\activate
   ```
2. 安装依赖：
   ```bash
   pip install -r requirements.txt
   ```
3. 在 `app/config.py` 或环境变量中配置您的 `DATABASE_URL` (MySQL) 与 `REDIS_URL`。

#### 3. 配置前端环境
1. 进入 `AIPC/frontend` 目录：
   ```bash
   cd AIPC/frontend
   ```
2. 安装前端依赖：
   ```bash
   npm install
   ```

#### 4. 一键启动服务
在 `AIPC` 根目录下，直接双击运行启动脚本：
```bash
.\start_local.bat
```
该脚本会在独立的命令行窗口中分别拉起 FastAPI 后端 (Port `3000`)、Celery Worker 和 Vite 开发服务器 (Port `5173`)。

---

## 📝 许可证

本项目基于 **MIT License** 开源。
如有合作或使用建议，欢迎联系制作者 田长金 (473272738@qq.com)。
