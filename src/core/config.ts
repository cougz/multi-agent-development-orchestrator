import * as path from 'path';
import * as fs from 'fs';
import Joi from 'joi';
import { MADOConfig, AgentRole } from '../types/index';
import { logger } from './logger';

const configSchema = Joi.object({
  project: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().required(),
    version: Joi.string().required(),
    repository: Joi.string().required(),
    workingDirectory: Joi.string().required(),
    maxAgents: Joi.number().min(1).max(50).default(10),
    defaultBranch: Joi.string().default('main'),
    templates: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      description: Joi.string().required(),
      framework: Joi.string().required(),
      language: Joi.string().required(),
      structure: Joi.object().required()
    })).default([])
  }).required(),

  git: Joi.object({
    provider: Joi.string().valid('github', 'gitlab', 'bitbucket', 'local').default('local'),
    remote: Joi.string().optional(),
    token: Joi.string().optional(),
    worktreeEnabled: Joi.boolean().default(true),
    conflictResolution: Joi.string().valid('automatic', 'manual', 'hybrid').default('hybrid'),
    branchPrefix: Joi.string().default('agent-'),
    commitMessageTemplate: Joi.string().default('[{agentId}] {type}: {description}')
  }).required(),

  agents: Joi.object({
    maxConcurrentAgents: Joi.number().min(1).max(20).default(5),
    defaultRoles: Joi.array().items(
      Joi.string().valid(...Object.values(AgentRole))
    ).default([AgentRole.FRONTEND, AgentRole.BACKEND, AgentRole.QA]),
    healthCheckInterval: Joi.number().min(1000).default(30000),
    taskTimeout: Joi.number().min(60000).default(1800000), // 30 minutes
    autoRestart: Joi.boolean().default(true),
    resourceLimits: Joi.object({
      maxMemory: Joi.number().min(100).default(1024), // MB
      maxCpu: Joi.number().min(1).max(100).default(80), // percentage
      maxDisk: Joi.number().min(100).default(5120), // MB
      maxNetworkBandwidth: Joi.number().min(1).default(100) // MB/s
    }).default({})
  }).required(),

  messaging: Joi.object({
    broker: Joi.string().valid('memory', 'redis', 'rabbitmq').default('memory'),
    queues: Joi.object().default({}),
    serialization: Joi.string().valid('json', 'msgpack', 'protobuf').default('json'),
    compression: Joi.boolean().default(false),
    encryption: Joi.boolean().default(false)
  }).required(),

  monitoring: Joi.object({
    enabled: Joi.boolean().default(true),
    metricsInterval: Joi.number().min(1000).default(5000),
    logLevel: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
    logFormat: Joi.string().valid('json', 'text').default('json'),
    alerting: Joi.object({
      enabled: Joi.boolean().default(true),
      channels: Joi.array().items(Joi.string()).default(['console']),
      thresholds: Joi.object({
        agentFailureRate: Joi.number().min(0).max(1).default(0.1),
        taskTimeout: Joi.number().min(60000).default(1800000),
        memoryUsage: Joi.number().min(0).max(100).default(80),
        cpuUsage: Joi.number().min(0).max(100).default(80),
        errorRate: Joi.number().min(0).max(1).default(0.05)
      }).default({})
    }).default({}),
    dashboard: Joi.object({
      enabled: Joi.boolean().default(true),
      port: Joi.number().min(1000).max(65535).default(3000),
      refreshInterval: Joi.number().min(1000).default(5000),
      authentication: Joi.boolean().default(false)
    }).default({})
  }).required(),

  integrations: Joi.object({
    claudeCode: Joi.object({
      enabled: Joi.boolean().default(true),
      version: Joi.string().default('latest'),
      binary: Joi.string().default('claude'),
      defaultModel: Joi.string().default('claude-3-sonnet-20240229'),
      apiKey: Joi.string().optional(),
      baseUrl: Joi.string().optional()
    }).default({}),
    github: Joi.object({
      enabled: Joi.boolean().default(false),
      token: Joi.string().optional(),
      organization: Joi.string().optional(),
      repository: Joi.string().optional(),
      webhooks: Joi.boolean().default(false)
    }).default({}),
    cicd: Joi.object({
      provider: Joi.string().valid('github-actions', 'gitlab-ci', 'jenkins', 'none').default('none'),
      enabled: Joi.boolean().default(false),
      triggers: Joi.array().items(Joi.string()).default([]),
      notifications: Joi.boolean().default(false)
    }).default({})
  }).required(),

  security: Joi.object({
    authentication: Joi.boolean().default(false),
    authorization: Joi.boolean().default(false),
    apiKeys: Joi.array().items(Joi.string()).default([]),
    rateLimiting: Joi.object({
      enabled: Joi.boolean().default(true),
      requestsPerMinute: Joi.number().min(1).default(100),
      burstLimit: Joi.number().min(1).default(200)
    }).default({}),
    sandbox: Joi.object({
      enabled: Joi.boolean().default(true),
      allowedCommands: Joi.array().items(Joi.string()).default([
        'git', 'npm', 'yarn', 'node', 'python', 'pip', 'docker'
      ]),
      restrictedPaths: Joi.array().items(Joi.string()).default([
        '/etc', '/usr', '/sys', '/proc'
      ]),
      networkAccess: Joi.boolean().default(true)
    }).default({})
  }).required()
});

export class ConfigManager {
  private config: MADOConfig | null = null;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || this.findConfigFile();
  }

  private findConfigFile(): string {
    const possiblePaths = [
      path.join(process.cwd(), 'config', 'local.json'),
      path.join(process.cwd(), 'config', 'default.json'),
      path.join(process.cwd(), 'mado.config.json'),
      path.join(process.env.HOME || process.cwd(), '.mado', 'config.json')
    ];

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        logger.info(`Found config file: ${configPath}`);
        return configPath;
      }
    }

    // During testing, return a default path instead of throwing
    if (process.env.NODE_ENV === 'test') {
      return path.join(process.cwd(), 'config', 'default.json');
    }

    throw new Error(`No configuration file found. Searched paths: ${possiblePaths.join(', ')}`);
  }

  public async load(): Promise<MADOConfig> {
    try {
      const configData = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      
      // Merge with environment variables
      const mergedConfig = this.mergeWithEnvironment(configData);
      
      // Validate configuration
      const { error, value } = configSchema.validate(mergedConfig, {
        allowUnknown: false,
        stripUnknown: true
      });

      if (error) {
        throw new Error(`Configuration validation failed: ${error.message}`);
      }

      this.config = value as MADOConfig;
      logger.info('Configuration loaded and validated successfully');
      return this.config;
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw error;
    }
  }

  private mergeWithEnvironment(config: any): any {
    // Merge environment variables with config
    const envConfig = {
      project: {
        name: process.env.MADO_PROJECT_NAME || config.project?.name,
        workingDirectory: process.env.MADO_WORKING_DIR || config.project?.workingDirectory,
      },
      git: {
        token: process.env.MADO_GIT_TOKEN || config.git?.token,
        remote: process.env.MADO_GIT_REMOTE || config.git?.remote,
      },
      integrations: {
        claudeCode: {
          apiKey: process.env.ANTHROPIC_API_KEY || config.integrations?.claudeCode?.apiKey,
          baseUrl: process.env.ANTHROPIC_BASE_URL || config.integrations?.claudeCode?.baseUrl,
        },
        github: {
          token: process.env.GITHUB_TOKEN || config.integrations?.github?.token,
        }
      }
    };

    return this.deepMerge(config, envConfig);
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else if (source[key] !== undefined) {
        result[key] = source[key];
      }
    }

    return result;
  }

  public get(): MADOConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  public getSection<T>(section: keyof MADOConfig): T {
    return this.get()[section] as T;
  }

  public async save(config: MADOConfig): Promise<void> {
    try {
      const { error } = configSchema.validate(config);
      if (error) {
        throw new Error(`Configuration validation failed: ${error.message}`);
      }

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      this.config = config;
      logger.info('Configuration saved successfully');
    } catch (error) {
      logger.error('Failed to save configuration:', error);
      throw error;
    }
  }

  public async reload(): Promise<MADOConfig> {
    return this.load();
  }

  public createDefaultConfig(): MADOConfig {
    const defaultConfig = {
      project: {
        name: 'MADO Project',
        description: 'Multi-Agent Development Orchestrator Project',
        version: '1.0.0',
        repository: process.cwd(),
        workingDirectory: process.cwd(),
        maxAgents: 10,
        defaultBranch: 'main',
        templates: []
      },
      git: {
        provider: 'local' as const,
        worktreeEnabled: true,
        conflictResolution: 'hybrid' as const,
        branchPrefix: 'agent-',
        commitMessageTemplate: '[{agentId}] {type}: {description}'
      },
      agents: {
        maxConcurrentAgents: 5,
        defaultRoles: [AgentRole.FRONTEND, AgentRole.BACKEND, AgentRole.QA],
        healthCheckInterval: 30000,
        taskTimeout: 1800000,
        autoRestart: true,
        resourceLimits: {
          maxMemory: 1024,
          maxCpu: 80,
          maxDisk: 5120,
          maxNetworkBandwidth: 100
        }
      },
      messaging: {
        broker: 'memory' as const,
        queues: {},
        serialization: 'json' as const,
        compression: false,
        encryption: false
      },
      monitoring: {
        enabled: true,
        metricsInterval: 5000,
        logLevel: 'info' as const,
        logFormat: 'json' as const,
        alerting: {
          enabled: true,
          channels: ['console'],
          thresholds: {
            agentFailureRate: 0.1,
            taskTimeout: 1800000,
            memoryUsage: 80,
            cpuUsage: 80,
            errorRate: 0.05
          }
        },
        dashboard: {
          enabled: true,
          port: 3000,
          refreshInterval: 5000,
          authentication: false
        }
      },
      integrations: {
        claudeCode: {
          enabled: true,
          version: 'latest',
          binary: 'claude',
          defaultModel: 'claude-3-sonnet-20240229'
        },
        github: {
          enabled: false,
          webhooks: false
        },
        cicd: {
          provider: 'none' as const,
          enabled: false,
          triggers: [],
          notifications: false
        }
      },
      security: {
        authentication: false,
        authorization: false,
        apiKeys: [],
        rateLimiting: {
          enabled: true,
          requestsPerMinute: 100,
          burstLimit: 200
        },
        sandbox: {
          enabled: true,
          allowedCommands: ['git', 'npm', 'yarn', 'node', 'python', 'pip', 'docker'],
          restrictedPaths: ['/etc', '/usr', '/sys', '/proc'],
          networkAccess: true
        }
      }
    };

    return defaultConfig;
  }
}

export const configManager = new ConfigManager();