export enum TaskType {
  FEATURE = 'feature',
  BUG_FIX = 'bug_fix',
  REFACTOR = 'refactor',
  TEST = 'test',
  DOCUMENTATION = 'documentation',
  DEPLOYMENT = 'deployment',
  CODE_REVIEW = 'code_review',
  INTEGRATION = 'integration',
  OPTIMIZATION = 'optimization',
}

export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  REVIEW = 'review',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface TaskRequirement {
  id: string;
  description: string;
  type: 'functional' | 'technical' | 'quality';
  satisfied: boolean;
}

export interface Task {
  id: string;
  type: TaskType;
  priority: Priority;
  assignedAgent?: string;
  dependencies: string[];
  estimatedDuration: number; // in minutes
  actualDuration?: number;
  deadline?: Date;
  title: string;
  description: string;
  requirements: TaskRequirement[];
  status: TaskStatus;
  progress: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
  tags: string[];
  files: string[]; // affected files
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  metadata: Record<string, any>;
  changedFiles: string[];
  completedAt: Date;
}

export interface TaskDependency {
  taskId: string;
  dependsOn: string;
  type: 'blocks' | 'waits_for' | 'enhances';
  description?: string;
}

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: Date;
  estimatedCompletion: Date;
  confidence: number; // 0-1, how confident the assignment is
}