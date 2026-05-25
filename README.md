# AI Agent Platform (智能体中台)

> Multi-tenant Hermes+ Agent Platform with Workflow Orchestration

## 🎯 P0 MVP

多租户框架 + 单 Agent 对话 + API网关

### 核心功能

- ✅ 多租户隔离（Workspace）
- ✅ 多用户 RBAC 权限
- ✅ Agent 对话（多模型路由）
- ✅ API Key 管理
- ✅ Token 用量统计
- ✅ RESTful API

### 技术栈

| 组件 | 选型 |
|------|------|
| 后端 | Python 3.11 + FastAPI |
| 数据库 | SQLite (MVP) → PostgreSQL (生产) |
| ORM | SQLAlchemy 2.0 |
| 认证 | JWT |
| LLM | OpenAI 兼容接口（DeepSeek/Claude/GPT） |
| 部署 | Docker Compose |

### 快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 初始化数据库
python -m app.db.init_db

# 启动服务
uvicorn app.main:app --reload --port 8000

# 访问 API 文档
# http://localhost:8000/docs
```

### Docker 部署

```bash
docker-compose up -d
```

### API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/auth/register | 用户注册 |
| POST | /api/v1/auth/login | 用户登录 |
| GET | /api/v1/tenants | 租户列表 |
| POST | /api/v1/tenants | 创建租户 |
| POST | /api/v1/agents/chat | Agent对话 |
| GET | /api/v1/agents/sessions | 会话列表 |
| GET | /api/v1/usage/stats | 用量统计 |

### 项目结构

```
agent-platform/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置管理
│   ├── db/
│   │   ├── init_db.py       # 数据库初始化
│   │   ├── base.py          # SQLAlchemy Base
│   │   └── models/          # 数据模型
│   │       ├── tenant.py
│   │       ├── user.py
│   │       ├── agent.py
│   │       └── usage.py
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py      # 认证接口
│   │       ├── tenants.py   # 租户管理
│   │       ├── agents.py    # Agent对话
│   │       └── usage.py     # 用量统计
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── tenant_service.py
│   │   ├── agent_service.py
│   │   └── llm_router.py   # 多模型路由
│   └── middleware/
│       ├── auth_middleware.py
│       └── tenant_middleware.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🗺️ Roadmap

| 阶段 | 周期 | 内容 |
|------|------|------|
| **P0 MVP** ✅ | 2周 | 多租户 + 单Agent对话 |
| P1 核心 | 4周 | 工作流编排 + 节点引擎 |
| P2 RAG | 3周 | 知识库 + 文档解析 + 向量检索 |
| P3 完善 | 3周 | 可视化编排 + 模板市场 |
| P4 商业 | 2周 | 计费系统 + 高可用 |

## License

MIT
