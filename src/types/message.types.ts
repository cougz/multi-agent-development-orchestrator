import { Priority } from './task.types';

export enum MessageType {
  TASK_ASSIGNMENT = 'task_assignment',
  TASK_UPDATE = 'task_update',
  TASK_COMPLETED = 'task_completed',
  AGENT_STATUS = 'agent_status',
  COORDINATION = 'coordination',
  ERROR = 'error',
  NOTIFICATION = 'notification',
  REQUEST = 'request',
  RESPONSE = 'response',
  BROADCAST = 'broadcast',
  HEALTH_CHECK = 'health_check',
}

export interface Message {
  id: string;
  from: string;
  to: string | string[];
  type: MessageType;
  priority: Priority;
  content: any;
  timestamp: Date;
  correlationId?: string; // for request-response pairs
  expiresAt?: Date;
  retryCount?: number;
  metadata: Record<string, any>;
}

export interface MessageRoute {
  pattern: string;
  handler: string;
  priority: number;
}

export interface MessageQueueConfig {
  maxSize: number;
  retryAttempts: number;
  retryDelay: number;
  deadLetterQueue: boolean;
}

export interface MessageMetrics {
  sent: number;
  received: number;
  processed: number;
  failed: number;
  averageProcessingTime: number;
}