export enum AgentRole {
  ORCHESTRATOR = 'orchestrator',
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  DEVOPS = 'devops',
  QA = 'qa',
  FULL_STACK = 'full_stack',
}

export enum AgentStatus {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
  BUSY = 'busy',
  ERROR = 'error',
  STARTING = 'starting',
  STOPPING = 'stopping',
}

export interface AgentCapability {
  name: string;
  level: number; // 1-10 proficiency level
  description: string;
}

export interface AgentMetrics {
  tasksCompleted: number;
  averageTaskDuration: number;
  successRate: number;
  codeQualityScore: number;
  collaborationScore: number;
  lastActivityTime: Date;
}

export interface IAgent {
  id: string;
  name: string;
  role: AgentRole;
  capabilities: AgentCapability[];
  status: AgentStatus;
  workingDirectory: string;
  lastActivity: Date;
  metrics: AgentMetrics;
  metadata: Record<string, any>;
  
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  sendMessage(message: Message): Promise<void>;
  executeTask(task: Task): Promise<TaskResult>;
  updateStatus(status: AgentStatus): Promise<void>;
  getHealth(): Promise<AgentHealth>;
}

export interface AgentHealth {
  status: AgentStatus;
  cpu: number;
  memory: number;
  diskSpace: number;
  responseTime: number;
  errorRate: number;
  lastCheck: Date;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  workingDirectory: string;
  capabilities: AgentCapability[];
  maxConcurrentTasks: number;
  healthCheckInterval: number;
  settings: Record<string, any>;
}

// Import Message and Task types
import { Message } from './message.types';
import { Task, TaskResult } from './task.types';