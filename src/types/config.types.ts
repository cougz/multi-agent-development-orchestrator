import { AgentRole } from './agent.types';
import { MessageQueueConfig } from './message.types';

export interface MADOConfig {
  project: ProjectConfig;
  git: GitConfig;
  agents: AgentSystemConfig;
  messaging: MessagingConfig;
  monitoring: MonitoringConfig;
  integrations: IntegrationsConfig;
  security: SecurityConfig;
}

export interface ProjectConfig {
  name: string;
  description: string;
  version: string;
  repository: string;
  workingDirectory: string;
  maxAgents: number;
  defaultBranch: string;
  templates: ProjectTemplate[];
}

export interface ProjectTemplate {
  name: string;
  description: string;
  framework: string;
  language: string;
  structure: Record<string, any>;
}

export interface GitConfig {
  provider: 'github' | 'gitlab' | 'bitbucket' | 'local';
  remote?: string;
  token?: string;
  worktreeEnabled: boolean;
  conflictResolution: 'automatic' | 'manual' | 'hybrid';
  branchPrefix: string;
  commitMessageTemplate: string;
}

export interface AgentSystemConfig {
  maxConcurrentAgents: number;
  defaultRoles: AgentRole[];
  healthCheckInterval: number;
  taskTimeout: number;
  autoRestart: boolean;
  resourceLimits: ResourceLimits;
}

export interface ResourceLimits {
  maxMemory: number; // MB
  maxCpu: number; // percentage
  maxDisk: number; // MB
  maxNetworkBandwidth: number; // MB/s
}

export interface MessagingConfig {
  broker: 'memory' | 'redis' | 'rabbitmq';
  queues: Record<string, MessageQueueConfig>;
  serialization: 'json' | 'msgpack' | 'protobuf';
  compression: boolean;
  encryption: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logFormat: 'json' | 'text';
  alerting: AlertingConfig;
  dashboard: DashboardConfig;
}

export interface AlertingConfig {
  enabled: boolean;
  channels: string[];
  thresholds: AlertThresholds;
}

export interface AlertThresholds {
  agentFailureRate: number;
  taskTimeout: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
}

export interface DashboardConfig {
  enabled: boolean;
  port: number;
  refreshInterval: number;
  authentication: boolean;
}

export interface IntegrationsConfig {
  claudeCode: ClaudeCodeConfig;
  github: GitHubConfig;
  cicd: CICDConfig;
}

export interface ClaudeCodeConfig {
  enabled: boolean;
  version: string;
  binary: string;
  defaultModel: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface GitHubConfig {
  enabled: boolean;
  token?: string;
  organization?: string;
  repository?: string;
  webhooks: boolean;
}

export interface CICDConfig {
  provider: 'github-actions' | 'gitlab-ci' | 'jenkins' | 'none';
  enabled: boolean;
  triggers: string[];
  notifications: boolean;
}

export interface SecurityConfig {
  authentication: boolean;
  authorization: boolean;
  apiKeys: string[];
  rateLimiting: RateLimitConfig;
  sandbox: SandboxConfig;
}

export interface RateLimitConfig {
  enabled: boolean;
  requestsPerMinute: number;
  burstLimit: number;
}

export interface SandboxConfig {
  enabled: boolean;
  allowedCommands: string[];
  restrictedPaths: string[];
  networkAccess: boolean;
}