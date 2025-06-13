import { EventEmitter } from 'events';
import { logger } from './logger';

export enum SystemEvent {
  // Agent events
  AGENT_STARTED = 'agent:started',
  AGENT_STOPPED = 'agent:stopped',
  AGENT_ERROR = 'agent:error',
  AGENT_STATUS_CHANGED = 'agent:status_changed',
  AGENT_HEALTH_CHECK = 'agent:health_check',

  // Task events
  TASK_CREATED = 'task:created',
  TASK_ASSIGNED = 'task:assigned',
  TASK_STARTED = 'task:started',
  TASK_COMPLETED = 'task:completed',
  TASK_FAILED = 'task:failed',
  TASK_BLOCKED = 'task:blocked',
  TASK_PROGRESS_UPDATED = 'task:progress_updated',

  // Git events
  GIT_COMMIT = 'git:commit',
  GIT_BRANCH_CREATED = 'git:branch_created',
  GIT_MERGE = 'git:merge',
  GIT_CONFLICT = 'git:conflict',
  GIT_PUSH = 'git:push',
  GIT_PULL = 'git:pull',

  // System events
  SYSTEM_STARTED = 'system:started',
  SYSTEM_STOPPED = 'system:stopped',
  SYSTEM_ERROR = 'system:error',
  SYSTEM_HEALTH_CHECK = 'system:health_check',
  SYSTEM_RESOURCE_WARNING = 'system:resource_warning',

  // Message events
  MESSAGE_SENT = 'message:sent',
  MESSAGE_RECEIVED = 'message:received',
  MESSAGE_FAILED = 'message:failed',

  // Orchestrator events
  ORCHESTRATOR_DECISION = 'orchestrator:decision',
  ORCHESTRATOR_CONFLICT = 'orchestrator:conflict',
  ORCHESTRATOR_OPTIMIZATION = 'orchestrator:optimization',
}

export interface BaseEvent {
  id: string;
  type: SystemEvent;
  timestamp: Date;
  source: string;
  metadata: Record<string, any>;
}

export interface AgentEvent extends BaseEvent {
  agentId: string;
  data: any;
}

export interface TaskEvent extends BaseEvent {
  taskId: string;
  agentId?: string;
  data: any;
}

export interface GitEvent extends BaseEvent {
  repository: string;
  branch?: string;
  commit?: string;
  data: any;
}

export interface SystemHealthEvent extends BaseEvent {
  severity: 'info' | 'warning' | 'error' | 'critical';
  metrics: Record<string, number>;
}

export type MADOEvent = AgentEvent | TaskEvent | GitEvent | SystemHealthEvent | BaseEvent;

export class EventBus {
  private emitter: EventEmitter;
  private listeners: Map<string, Set<string>> = new Map();
  private eventHistory: MADOEvent[] = [];
  private maxHistorySize: number = 1000;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100); // Increase max listeners for multi-agent system
  }

  public emit(event: MADOEvent): void {
    try {
      // Add to history
      this.addToHistory(event);

      // Log event
      this.logEvent(event);

      // Emit to listeners
      this.emitter.emit(event.type, event);
      this.emitter.emit('*', event); // Wildcard listener

      // Track listeners
      const listenersForEvent = this.listeners.get(event.type) || new Set();
      listenersForEvent.forEach(listenerId => {
        logger.debug(`Event ${event.type} delivered to listener ${listenerId}`);
      });

    } catch (error) {
      logger.error('Error emitting event', { event, error });
    }
  }

  public on(eventType: SystemEvent | '*', listener: (event: MADOEvent) => void, listenerId?: string): void {
    this.emitter.on(eventType, listener);
    
    if (listenerId) {
      const listeners = this.listeners.get(eventType) || new Set();
      listeners.add(listenerId);
      this.listeners.set(eventType, listeners);
    }
  }

  public off(eventType: SystemEvent | '*', listener: (event: MADOEvent) => void, listenerId?: string): void {
    this.emitter.off(eventType, listener);
    
    if (listenerId) {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        listeners.delete(listenerId);
      }
    }
  }

  public once(eventType: SystemEvent, listener: (event: MADOEvent) => void): void {
    this.emitter.once(eventType, listener);
  }

  private addToHistory(event: MADOEvent): void {
    this.eventHistory.push(event);
    
    // Maintain history size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  private logEvent(event: MADOEvent): void {
    const logLevel = this.getLogLevel(event.type);
    const message = `Event: ${event.type}`;
    
    switch (logLevel) {
      case 'debug':
        logger.debug(message, { event });
        break;
      case 'info':
        logger.info(message, { event });
        break;
      case 'warn':
        logger.warn(message, { event });
        break;
      case 'error':
        logger.error(message, { event });
        break;
    }
  }

  private getLogLevel(eventType: SystemEvent): 'debug' | 'info' | 'warn' | 'error' {
    // Define log levels for different event types
    const errorEvents = [
      SystemEvent.AGENT_ERROR,
      SystemEvent.TASK_FAILED,
      SystemEvent.SYSTEM_ERROR,
      SystemEvent.MESSAGE_FAILED,
    ];

    const warningEvents = [
      SystemEvent.TASK_BLOCKED,
      SystemEvent.GIT_CONFLICT,
      SystemEvent.SYSTEM_RESOURCE_WARNING,
    ];

    const infoEvents = [
      SystemEvent.AGENT_STARTED,
      SystemEvent.AGENT_STOPPED,
      SystemEvent.TASK_COMPLETED,
      SystemEvent.GIT_COMMIT,
      SystemEvent.SYSTEM_STARTED,
    ];

    if (errorEvents.includes(eventType)) return 'error';
    if (warningEvents.includes(eventType)) return 'warn';
    if (infoEvents.includes(eventType)) return 'info';
    return 'debug';
  }

  public getEventHistory(
    eventType?: SystemEvent,
    since?: Date,
    limit?: number
  ): MADOEvent[] {
    let filtered = this.eventHistory;

    // Filter by event type
    if (eventType) {
      filtered = filtered.filter(event => event.type === eventType);
    }

    // Filter by timestamp
    if (since) {
      filtered = filtered.filter(event => event.timestamp >= since);
    }

    // Apply limit
    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  public getEventStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    this.eventHistory.forEach(event => {
      stats[event.type] = (stats[event.type] || 0) + 1;
    });

    return stats;
  }

  public clearHistory(): void {
    this.eventHistory = [];
    logger.info('Event history cleared');
  }

  public removeAllListeners(eventType?: SystemEvent): void {
    if (eventType) {
      this.emitter.removeAllListeners(eventType);
      this.listeners.delete(eventType);
    } else {
      this.emitter.removeAllListeners();
      this.listeners.clear();
    }
  }
}

// Event factory functions
export const createAgentEvent = (
  type: SystemEvent,
  agentId: string,
  data: any,
  source: string = 'system'
): AgentEvent => ({
  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type,
  timestamp: new Date(),
  source,
  agentId,
  data,
  metadata: {}
});

export const createTaskEvent = (
  type: SystemEvent,
  taskId: string,
  data: any,
  agentId?: string,
  source: string = 'system'
): TaskEvent => ({
  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type,
  timestamp: new Date(),
  source,
  taskId,
  agentId,
  data,
  metadata: {}
});

export const createGitEvent = (
  type: SystemEvent,
  repository: string,
  data: any,
  branch?: string,
  commit?: string,
  source: string = 'git'
): GitEvent => ({
  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type,
  timestamp: new Date(),
  source,
  repository,
  branch,
  commit,
  data,
  metadata: {}
});

export const createSystemEvent = (
  type: SystemEvent,
  data: any,
  source: string = 'system'
): BaseEvent => ({
  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type,
  timestamp: new Date(),
  source,
  metadata: { data }
});

// Global event bus instance
export const eventBus = new EventBus();