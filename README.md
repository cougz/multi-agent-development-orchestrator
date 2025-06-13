# MADO - Multi-Agent Development Orchestrator

<div align="center">

![MADO Logo](https://img.shields.io/badge/MADO-Multi--Agent%20Orchestrator-blue?style=for-the-badge&logo=robot)

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Git](https://img.shields.io/badge/Git-F05032?style=flat&logo=git&logoColor=white)](https://git-scm.com/)
[![Claude](https://img.shields.io/badge/Claude-Code-orange?style=flat)](https://claude.ai/code)

**🚀 Revolutionizing Software Development with Autonomous AI Agents**

*A sophisticated orchestrator-agent system that enables multiple AI agents to collaborate seamlessly on software development projects with intelligent coordination, real-time monitoring, and adaptive task management.*

</div>

---

## 🌟 What is MADO?

MADO (Multi-Agent Development Orchestrator) is a cutting-edge system that transforms how software development teams work by introducing **autonomous AI agents** that can:

- 🤖 **Collaborate intelligently** on complex development tasks
- 🔄 **Coordinate automatically** through Git workflows
- 📊 **Monitor progress** with real-time analytics
- 🎯 **Assign tasks dynamically** based on agent capabilities
- 🔧 **Resolve conflicts** automatically using advanced algorithms
- 📈 **Scale efficiently** from small projects to enterprise applications

### 🎯 Core Philosophy

Replace chaotic multi-developer coordination with **intelligent AI orchestration** that:
- Eliminates merge conflicts through predictive analysis
- Optimizes task distribution based on agent expertise
- Provides real-time project insights and bottleneck detection
- Maintains code quality through automated reviews and metrics

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MADO Orchestrator                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Web Dashboard │   CLI Interface │     API Gateway         │
└─────────────────┴─────────────────┴─────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
│ Agent Registry │ │  Task Manager   │ │  Message Bus    │
│                │ │                 │ │                 │
│ • Discovery    │ │ • Assignment    │ │ • Routing       │
│ • Health       │ │ • Dependencies  │ │ • Coordination  │
│ • Scaling      │ │ • Progress      │ │ • Events        │
└────────────────┘ └─────────────────┘ └─────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
│ Git Repository │ │ Worktree Manager│ │ Conflict Resolver│
│                │ │                 │ │                 │
│ • Monitoring   │ │ • Isolation     │ │ • Auto-Resolution│
│ • Analysis     │ │ • Coordination  │ │ • Strategies     │
│ • Metrics      │ │ • Cleanup       │ │ • Learning       │
└────────────────┘ └─────────────────┘ └─────────────────┘
                            │
    ┌────────┬────────┬─────┼─────┬────────┬────────┐
    │        │        │     │     │        │        │
┌───▼───┐ ┌─▼──┐ ┌───▼──┐ ┌▼───┐ ┌▼──┐ ┌──▼──┐ ┌──▼──┐
│Frontend│ │Back│ │DevOps│ │ QA │ │...│ │Agent│ │Agent│
│ Agent  │ │end │ │Agent │ │Agt │ │   │ │  N  │ │ N+1 │
└────────┘ └────┘ └──────┘ └────┘ └───┘ └─────┘ └─────┘
```

---

## ✨ Key Features

### 🤖 **Intelligent Agent System**
- **Multi-Role Agents**: Frontend, Backend, DevOps, QA, and custom roles
- **Dynamic Discovery**: Automatic agent registration and capability detection
- **Health Monitoring**: Real-time status tracking with automatic recovery
- **Load Balancing**: Intelligent task distribution based on agent capacity

### 🔧 **Advanced Git Integration**
- **Worktree Isolation**: Each agent works in isolated Git worktrees
- **Conflict Prevention**: Predictive analysis to prevent merge conflicts
- **Automated Resolution**: Smart conflict resolution with multiple strategies
- **Commit Analysis**: Pattern detection and code quality assessment

### 📊 **Real-Time Orchestration**
- **Task Assignment**: AI-powered matching of tasks to optimal agents
- **Progress Tracking**: Live monitoring with bottleneck detection
- **Performance Analytics**: Velocity metrics and productivity insights
- **Adaptive Scheduling**: Dynamic re-prioritization based on project state

### 🛡️ **Enterprise-Ready**
- **Scalability**: Support for 2-20+ concurrent agents
- **Security**: Sandboxed execution with configurable permissions
- **Monitoring**: Comprehensive logging and alerting systems
- **Configuration**: Flexible setup with environment-based overrides

---

## 🚀 Quick Start

### Prerequisites

Before installing MADO, ensure you have:

- **Node.js 18.0+** ([Download](https://nodejs.org/))
- **Git 2.30+** ([Download](https://git-scm.com/))
- **npm 8.0+** (comes with Node.js)
- **Claude Code access** (optional, for AI features)

### 📦 Installation

#### Option 1: Quick Install (Recommended)

```bash
# Clone the repository
git clone https://github.com/cougz/multi-agent-development-orchestrator.git
cd mado-orchestrator

# Run automated setup
npm run setup
```

The setup script will:
- ✅ Validate system requirements
- ✅ Install all dependencies
- ✅ Build the TypeScript project
- ✅ Create configuration files
- ✅ Initialize Git repository
- ✅ Run tests to verify installation

#### Option 2: Manual Installation

```bash
# Clone and enter directory
git clone https://github.com/cougz/multi-agent-development-orchestrator.git
cd mado-orchestrator

# Install dependencies
npm install

# Build the project
npm run build

# Create configuration
npm run config init

# Run tests
npm test

# See demo
npm run demo
```

### ⚙️ Configuration

MADO uses a JSON configuration file with optional environment variable overrides for sensitive data.

#### Configuration Options

**Option 1: JSON Configuration Only** (Development)
```bash
# Copy and edit the configuration file
cp config/default.json config/local.json
```

Edit `config/local.json` with all settings including API keys:
```json
{
  "project": {
    "name": "My MADO Project",
    "workingDirectory": "/path/to/your/project",
    "maxAgents": 5
  },
  "integrations": {
    "claudeCode": {
      "enabled": true,
      "apiKey": "your-claude-api-key"
    },
    "github": {
      "enabled": true,
      "token": "your-github-token"
    }
  }
}
```

**Option 2: JSON + Environment Overrides** (Production)
```bash
# Create minimal config without sensitive data
cp config/default.json config/local.json
```

Edit `config/local.json` (no API keys):
```json
{
  "project": {
    "name": "My MADO Project",
    "workingDirectory": "/path/to/your/project"
  },
  "integrations": {
    "claudeCode": {
      "enabled": true
    },
    "github": {
      "enabled": true
    }
  }
}
```

Create `.env` for sensitive overrides:
```bash
# Copy the template
cp .env.example .env
```

Edit `.env` (only sensitive data):
```env
# API Keys (override JSON config)
ANTHROPIC_API_KEY="your-claude-api-key"
GITHUB_TOKEN="your-github-token"

# Optional overrides
LOG_LEVEL="info"
NODE_ENV="production"
```

---

## 🎮 Usage

### Starting MADO

#### Quick Start
```bash
# 1. Configure the system (choose Option 1 or 2 above)
cp config/default.json config/local.json
# Edit config/local.json with your settings

# 2. Start the orchestrator
npm start
```

#### Development Mode
```bash
# Start with hot reload
npm run dev
```

#### First-Time Setup
If you haven't run setup yet:
```bash
# Complete setup (dependencies, build, config)
npm run setup

# Then start
npm start
```

### Managing Individual Agents

```bash
# Start specific agents
npm run agent:frontend    # Frontend development agent
npm run agent:backend     # Backend development agent
npm run agent:qa          # Quality assurance agent
npm run agent:devops      # DevOps and infrastructure agent

# Start custom agent
npm run agent -- --role=fullstack --name="My Agent"
```

### Using the CLI

```bash
# Install CLI globally (optional)
npm install -g mado-orchestrator

# CLI commands
mado start                    # Start orchestrator
mado agent --role=frontend   # Start specific agent
mado status                   # Show system status
mado config validate         # Validate configuration
```

### Web Dashboard

Once started, access the web dashboard at:
- **URL**: http://localhost:3000
- **Features**: Real-time monitoring, agent management, task tracking

---

## 🛠️ Development

### Project Structure

```
mado-orchestrator/
├── src/                      # Source code
│   ├── core/                 # Core system components
│   │   ├── config.ts         # Configuration management
│   │   ├── logger.ts         # Logging system
│   │   └── events.ts         # Event system
│   ├── agents/               # Agent system
│   │   ├── base-agent.ts     # Base agent class
│   │   ├── agent-registry.ts # Agent management
│   │   └── dev-agent.ts      # Development agent
│   ├── git/                  # Git integration
│   │   ├── repository.ts     # Repository management
│   │   ├── worktree.ts       # Worktree management
│   │   └── conflict-resolver.ts # Conflict resolution
│   ├── types/                # TypeScript definitions
│   └── cli/                  # Command-line interface
├── tests/                    # Test files
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
├── config/                   # Configuration files
├── scripts/                  # Setup and deployment scripts
└── docs/                     # Documentation
```

### Building and Testing

```bash
# Development commands
npm run dev          # Watch mode with hot reload
npm run build        # Build TypeScript
npm run test         # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run with coverage report

# Code quality
npm run lint         # Check code style
npm run lint:fix     # Fix linting issues
npm run format       # Format code with Prettier
npm run type-check   # TypeScript type checking
```

### Adding New Agents

1. **Create Agent Class**:

```typescript
// src/agents/my-agent.ts
import { BaseAgent } from './base-agent';
import { AgentConfig, AgentRole } from '../types/agent.types';

export class MyCustomAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
    // Add custom initialization
  }

  protected async initialize(): Promise<void> {
    // Custom setup logic
  }

  protected async performTask(task: Task): Promise<TaskResult> {
    // Custom task execution
  }
}
```

2. **Register Agent**:

```typescript
// In your orchestrator setup
const agent = new MyCustomAgent({
  id: 'my-agent-001',
  name: 'My Custom Agent',
  role: AgentRole.FULL_STACK,
  workingDirectory: './workspace',
  capabilities: [
    { name: 'custom-skill', level: 9, description: 'My custom capability' }
  ]
});

await orchestrator.getAgentRegistry().registerAgent(agent, config);
```

### Custom Task Types

```typescript
// Define custom task types
export enum CustomTaskType {
  CODE_GENERATION = 'code_generation',
  DATA_ANALYSIS = 'data_analysis',
  DEPLOYMENT = 'deployment'
}

// Handle in agent
protected async performTask(task: Task): Promise<TaskResult> {
  switch (task.type) {
    case CustomTaskType.CODE_GENERATION:
      return await this.generateCode(task);
    case CustomTaskType.DATA_ANALYSIS:
      return await this.analyzeData(task);
    default:
      return await super.performTask(task);
  }
}
```

---

## 📊 Monitoring & Analytics

### System Health Dashboard

Monitor your MADO system through multiple interfaces:

#### Web Dashboard
- **URL**: http://localhost:3000
- **Real-time metrics**: Agent status, task progress, system health
- **Visual analytics**: Performance charts, bottleneck detection
- **Management tools**: Agent control, configuration updates

#### CLI Status
```bash
mado status
```

#### API Endpoints
```bash
# System health
curl http://localhost:3000/api/health

# Agent statistics  
curl http://localhost:3000/api/agents/stats

# Performance metrics
curl http://localhost:3000/api/metrics
```

### Key Metrics

- **Agent Performance**: Task completion rate, average duration, quality scores
- **System Health**: CPU/memory usage, response times, error rates
- **Project Progress**: Sprint velocity, bottleneck analysis, timeline predictions
- **Code Quality**: Automated review scores, test coverage, technical debt

---

## 🔧 Configuration Reference

### Core Configuration Sections

#### Project Settings
```json
{
  "project": {
    "name": "Project Name",
    "description": "Project description",
    "workingDirectory": "/path/to/project",
    "maxAgents": 10,
    "defaultBranch": "main"
  }
}
```

#### Agent Configuration
```json
{
  "agents": {
    "maxConcurrentAgents": 5,
    "defaultRoles": ["frontend", "backend", "qa"],
    "healthCheckInterval": 30000,
    "taskTimeout": 1800000,
    "autoRestart": true
  }
}
```

#### Git Integration
```json
{
  "git": {
    "provider": "github",
    "worktreeEnabled": true,
    "conflictResolution": "hybrid",
    "branchPrefix": "agent-"
  }
}
```

#### Monitoring Settings
```json
{
  "monitoring": {
    "enabled": true,
    "logLevel": "info",
    "dashboard": {
      "enabled": true,
      "port": 3000
    },
    "alerting": {
      "enabled": true,
      "channels": ["email", "slack"]
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MADO_PROJECT_NAME` | Project name | "MADO Project" |
| `MADO_WORKING_DIR` | Working directory | Current directory |
| `ANTHROPIC_API_KEY` | Claude API key | None |
| `GITHUB_TOKEN` | GitHub access token | None |
| `LOG_LEVEL` | Logging level | "info" |
| `NODE_ENV` | Environment | "development" |

---

## 🚀 Deployment

### Production Deployment

#### Docker Deployment

```bash
# Build Docker image
docker build -t mado-orchestrator .

# Run container
docker run -d \
  --name mado \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e ANTHROPIC_API_KEY=your-key \
  -e GITHUB_TOKEN=your-token \
  mado-orchestrator
```

#### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  mado:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./config:/app/config
    environment:
      - NODE_ENV=production
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    restart: unless-stopped
```

#### System Service

```bash
# Install as system service
sudo npm install -g mado-orchestrator
sudo mado setup --service

# Control service
sudo systemctl start mado
sudo systemctl enable mado
sudo systemctl status mado
```

### Cloud Deployment

#### AWS/Azure/GCP
- Use container services (ECS, Container Instances, Cloud Run)
- Configure environment variables and secrets
- Set up load balancing and auto-scaling
- Enable monitoring and logging

#### Kubernetes
```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mado-orchestrator
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mado
  template:
    metadata:
      labels:
        app: mado
    spec:
      containers:
      - name: mado
        image: mado-orchestrator:latest
        ports:
        - containerPort: 3000
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: mado-secrets
              key: anthropic-key
```

---

## 🔍 Troubleshooting

### Common Issues

#### Installation Problems

**Issue**: `npm install` fails with permission errors
```bash
# Solution: Fix npm permissions
sudo chown -R $(whoami) ~/.npm
npm cache clean --force
npm install
```

**Issue**: TypeScript compilation errors
```bash
# Solution: Clean and rebuild
npm run clean
npm install
npm run build
```

#### Runtime Issues

**Issue**: Agents not starting
```bash
# Check configuration
npm run config validate

# Check logs
tail -f logs/combined.log

# Restart with debug logging
LOG_LEVEL=debug npm start
```

**Issue**: Git conflicts not resolving
```bash
# Check Git status
git status

# Reset worktrees
rm -rf worktrees/*
npm start
```

### Getting Help

1. **Check Logs**: Always start by examining the logs in `logs/`
2. **Validate Config**: Run `npm run config validate`
3. **Test System**: Run `npm test` to verify system health
4. **Debug Mode**: Set `LOG_LEVEL=debug` for detailed output

### Support Channels

- 📖 **Documentation**: [Full docs](docs/)
- 🐛 **Issues**: [GitHub Issues](https://github.com/cougz/multi-agent-development-orchestrator/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/cougz/multi-agent-development-orchestrator/discussions)
- 📧 **Email**: support@mado-orchestrator.com

---

## 📈 Performance & Scaling

### Performance Targets

- **Response Time**: <1 second for agent communications
- **Throughput**: 100+ tasks per hour with 5 agents
- **Scalability**: Support 2-20 concurrent agents
- **Reliability**: >99% uptime with automatic recovery
- **Resource Usage**: <100MB memory per agent

### Scaling Guidelines

#### Small Projects (2-5 agents)
- Single machine deployment
- Local Git repository
- Basic monitoring

#### Medium Projects (5-10 agents)
- Multi-core deployment
- Remote Git repository
- Enhanced monitoring and alerting

#### Large Projects (10-20 agents)
- Distributed deployment
- Load balancing
- Advanced analytics and optimization

### Optimization Tips

1. **Agent Specialization**: Assign specific roles to optimize performance
2. **Task Batching**: Group related tasks for efficient processing
3. **Resource Monitoring**: Monitor CPU/memory usage and scale accordingly
4. **Git Optimization**: Use worktrees effectively to minimize conflicts

---

## 🤝 Contributing

We welcome contributions to MADO! Here's how to get involved:

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/your-username/mado-orchestrator.git
cd mado-orchestrator

# Install development dependencies
npm install

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and test
npm run dev
npm test

# Commit and push
git commit -m "Add amazing feature"
git push origin feature/amazing-feature
```

### Contribution Guidelines

1. **Code Style**: Follow existing TypeScript/ESLint conventions
2. **Testing**: Maintain >90% test coverage for new code
3. **Documentation**: Update docs for new features
4. **Commits**: Use conventional commit messages
5. **Reviews**: All changes require code review

### Areas for Contribution

- 🤖 **New Agent Types**: Specialized agents for different domains
- 🔧 **Integrations**: Connect with more development tools
- 📊 **Analytics**: Enhanced monitoring and insights
- 🎨 **UI/UX**: Improve web dashboard and CLI
- 📚 **Documentation**: Tutorials, examples, and guides

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 MADO Orchestrator Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

MADO is built on the shoulders of giants:

- **[Claude Code](https://claude.ai/code)** - AI-powered development assistance
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript development
- **[simple-git](https://github.com/steveukx/git-js)** - Git integration for Node.js
- **[Jest](https://jestjs.io/)** - JavaScript testing framework
- **[Winston](https://github.com/winstonjs/winston)** - Logging library

Special thanks to the open-source community and all contributors who make projects like this possible.

---

## 🚀 What's Next?

MADO is actively being developed with exciting features planned:

### Roadmap 2025

- 🎯 **Q1**: Advanced task management and dependency tracking
- 🧠 **Q2**: Machine learning-powered optimization
- 🌐 **Q3**: Web-based visual programming interface
- 🔮 **Q4**: Enterprise features and cloud-native deployment

### Join the Revolution

Ready to transform your development workflow? 

```bash
git clone https://github.com/cougz/multi-agent-development-orchestrator.git
cd mado-orchestrator
npm run setup
npm start
```

**Welcome to the future of autonomous software development!** 🚀✨

---

<div align="center">

**[⭐ Star us on GitHub](https://github.com/cougz/multi-agent-development-orchestrator)** | **[📖 Read the Docs](docs/)** | **[💬 Join Discussions](https://github.com/cougz/multi-agent-development-orchestrator/discussions)**

Made with ❤️ by the MADO Team

</div>