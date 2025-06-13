import { AgentHealth, AgentMetrics } from './agent.types';
import { Task, TaskResult } from './task.types';
import { CodeMetrics } from './git.types';

export interface OrchestratorState {
  activeAgents: string[];
  currentTasks: Task[];
  systemHealth: SystemHealth;
  projectMetrics: ProjectMetrics;
  lastUpdate: Date;
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  agents: Record<string, AgentHealth>;
  resources: ResourceUsage;
  performance: PerformanceMetrics;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  activeProcesses: number;
}

export interface PerformanceMetrics {
  averageTaskDuration: number;
  throughput: number; // tasks per hour
  successRate: number;
  responseTime: number;
  queueLength: number;
}

export interface ProjectMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageVelocity: number; // tasks per sprint
  codeQuality: CodeMetrics;
  collaboration: CollaborationMetrics;
  timeline: TimelineMetrics;
}

export interface CollaborationMetrics {
  agentInteractions: number;
  conflictResolutions: number;
  knowledgeSharing: number;
  crossTeamTasks: number;
}

export interface TimelineMetrics {
  sprintProgress: number; // 0-100
  estimatedCompletion: Date;
  blockers: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface DecisionContext {
  taskQueue: Task[];
  agentCapabilities: Record<string, string[]>;
  systemLoad: ResourceUsage;
  priorities: string[];
  constraints: string[];
}

export interface OrchestratorDecision {
  type: 'task_assignment' | 'resource_allocation' | 'conflict_resolution' | 'scaling';
  action: string;
  reasoning: string;
  confidence: number; // 0-1
  expectedOutcome: string;
  alternatives: string[];
}

export interface ConflictResolution {
  id: string;
  type: 'resource' | 'priority' | 'technical' | 'coordination';
  parties: string[];
  description: string;
  resolution: string;
  timestamp: Date;
  success: boolean;
}

export interface LearningData {
  taskOutcomes: TaskResult[];
  agentPerformance: Record<string, AgentMetrics>;
  systemPatterns: any[];
  optimizations: string[];
}