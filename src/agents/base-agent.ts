import { EventEmitter } from 'events';
import { 
  IAgent, 
  AgentRole, 
  AgentStatus, 
  AgentHealth, 
  AgentCapability, 
  AgentMetrics,
  AgentConfig 
} from '../types/agent.types';
import { Task, TaskResult, TaskStatus } from '../types/task.types';
import { Message, MessageType } from '../types/message.types';
import { logger, AgentLogger } from '@core/logger';
import { eventBus, createAgentEvent, SystemEvent } from '@core/events';

export abstract class BaseAgent extends EventEmitter implements IAgent {
  public readonly id: string;
  public readonly name: string;
  public readonly role: AgentRole;
  public capabilities: AgentCapability[];
  public status: AgentStatus = AgentStatus.INACTIVE;
  public workingDirectory: string;
  public lastActivity: Date = new Date();
  public metrics: AgentMetrics;
  public metadata: Record<string, any> = {};

  protected agentLogger: AgentLogger;
  protected currentTask: Task | null = null;
  protected healthCheckInterval: NodeJS.Timeout | null = null;
  protected maxConcurrentTasks: number = 1;
  protected startTime: Date | null = null;

  constructor(config: AgentConfig) {
    super();
    
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.capabilities = config.capabilities;
    this.workingDirectory = config.workingDirectory;
    this.maxConcurrentTasks = config.maxConcurrentTasks || 1;
    
    this.agentLogger = new AgentLogger(this.id);
    
    this.metrics = {
      tasksCompleted: 0,
      averageTaskDuration: 0,
      successRate: 0,
      codeQualityScore: 85, // Default score
      collaborationScore: 0,
      lastActivityTime: new Date()
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.on('task:assigned', this.handleTaskAssigned.bind(this));
    this.on('task:completed', this.handleTaskCompleted.bind(this));
    this.on('task:failed', this.handleTaskFailed.bind(this));
    this.on('health:check', this.handleHealthCheck.bind(this));
  }

  public async start(): Promise<void> {
    try {
      this.startTime = new Date();
      await this.updateStatus(AgentStatus.STARTING);
      
      this.agentLogger.info(`Starting agent ${this.name} (${this.role})`);
      
      // Initialize agent-specific resources
      await this.initialize();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      await this.updateStatus(AgentStatus.ACTIVE);
      
      eventBus.emit(createAgentEvent(
        SystemEvent.AGENT_STARTED,
        this.id,
        { role: this.role, capabilities: this.capabilities.map(c => c.name) }
      ));
      
      this.agentLogger.info(`Agent ${this.name} started successfully`);
    } catch (error) {
      await this.updateStatus(AgentStatus.ERROR);
      this.agentLogger.error('Failed to start agent', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      await this.updateStatus(AgentStatus.STOPPING);
      
      this.agentLogger.info(`Stopping agent ${this.name}`);
      
      // Stop health monitoring
      this.stopHealthMonitoring();
      
      // Cancel current task if any
      if (this.currentTask) {
        await this.cancelCurrentTask();
      }
      
      // Cleanup agent-specific resources
      await this.cleanup();
      
      await this.updateStatus(AgentStatus.INACTIVE);
      
      eventBus.emit(createAgentEvent(
        SystemEvent.AGENT_STOPPED,
        this.id,
        { role: this.role, uptime: this.getUptime() }
      ));
      
      this.agentLogger.info(`Agent ${this.name} stopped successfully`);
    } catch (error) {
      this.agentLogger.error('Failed to stop agent', error);
      throw error;
    }
  }

  public async restart(): Promise<void> {
    this.agentLogger.info(`Restarting agent ${this.name}`);
    await this.stop();
    await this.start();
  }

  public async sendMessage(message: Message): Promise<void> {
    try {
      this.agentLogger.debug(`Sending message to ${message.to}`, {
        type: message.type,
        correlationId: message.correlationId
      });

      // Emit message through event bus (message routing will handle delivery)
      eventBus.emit(createAgentEvent(
        SystemEvent.MESSAGE_SENT,
        this.id,
        { message }
      ));

      this.updateLastActivity();
    } catch (error) {
      this.agentLogger.error('Failed to send message', error);
      throw error;
    }
  }

  public async executeTask(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      await this.updateStatus(AgentStatus.BUSY);
      this.currentTask = task;
      
      this.agentLogger.info(`Executing task: ${task.title}`, {
        taskId: task.id,
        type: task.type,
        priority: task.priority
      });

      eventBus.emit(createAgentEvent(
        SystemEvent.TASK_STARTED,
        this.id,
        { taskId: task.id, title: task.title }
      ));

      // Validate that we can handle this task
      if (!this.canHandleTask(task)) {
        throw new Error(`Agent ${this.id} cannot handle task of type ${task.type}`);
      }

      // Execute the task
      const result = await this.performTask(task);
      
      const duration = Date.now() - startTime;
      result.duration = duration;
      result.completedAt = new Date();

      // Update metrics
      this.updateMetrics(result);
      
      this.currentTask = null;
      await this.updateStatus(AgentStatus.ACTIVE);
      
      this.agentLogger.info(`Task completed: ${task.title}`, {
        taskId: task.id,
        success: result.success,
        duration: `${duration}ms`
      });

      eventBus.emit(createAgentEvent(
        SystemEvent.TASK_COMPLETED,
        this.id,
        { taskId: task.id, result }
      ));

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorResult: TaskResult = {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
        metadata: {},
        changedFiles: [],
        completedAt: new Date()
      };

      this.updateMetrics(errorResult);
      this.currentTask = null;
      await this.updateStatus(AgentStatus.ACTIVE);

      this.agentLogger.error(`Task failed: ${task.title}`, error);

      eventBus.emit(createAgentEvent(
        SystemEvent.TASK_FAILED,
        this.id,
        { taskId: task.id, error: errorResult.error }
      ));

      return errorResult;
    }
  }

  public async updateStatus(status: AgentStatus): Promise<void> {
    const previousStatus = this.status;
    this.status = status;
    this.updateLastActivity();

    if (previousStatus !== status) {
      this.agentLogger.debug(`Status changed: ${previousStatus} -> ${status}`);
      
      eventBus.emit(createAgentEvent(
        SystemEvent.AGENT_STATUS_CHANGED,
        this.id,
        { previousStatus, currentStatus: status }
      ));
    }
  }

  public async getHealth(): Promise<AgentHealth> {
    try {
      const systemUsage = await this.getSystemUsage();
      const responseTime = await this.measureResponseTime();
      
      return {
        status: this.status,
        cpu: systemUsage.cpu,
        memory: systemUsage.memory,
        diskSpace: systemUsage.diskSpace,
        responseTime,
        errorRate: this.calculateErrorRate(),
        lastCheck: new Date()
      };
    } catch (error) {
      this.agentLogger.error('Failed to get health status', error);
      return {
        status: AgentStatus.ERROR,
        cpu: 0,
        memory: 0,
        diskSpace: 0,
        responseTime: 0,
        errorRate: 1,
        lastCheck: new Date()
      };
    }
  }

  // Abstract methods that must be implemented by concrete agents
  protected abstract initialize(): Promise<void>;
  protected abstract cleanup(): Promise<void>;
  protected abstract performTask(task: Task): Promise<TaskResult>;
  protected abstract canHandleTask(task: Task): boolean;

  // Helper methods
  protected updateLastActivity(): void {
    this.lastActivity = new Date();
    this.metrics.lastActivityTime = this.lastActivity;
  }

  protected getUptime(): number {
    return this.startTime ? Date.now() - this.startTime.getTime() : 0;
  }

  private startHealthMonitoring(): void {
    // Health check every 30 seconds by default
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealth();
        
        eventBus.emit(createAgentEvent(
          SystemEvent.AGENT_HEALTH_CHECK,
          this.id,
          { health }
        ));

        // Check for potential issues
        if (health.memory > 80 || health.cpu > 90) {
          this.agentLogger.warn('High resource usage detected', {
            memory: health.memory,
            cpu: health.cpu
          });
        }
      } catch (error) {
        this.agentLogger.error('Health check failed', error);
      }
    }, 30000);
  }

  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async cancelCurrentTask(): Promise<void> {
    if (this.currentTask) {
      this.agentLogger.info(`Cancelling current task: ${this.currentTask.title}`);
      
      eventBus.emit(createAgentEvent(
        SystemEvent.TASK_FAILED,
        this.id,
        { taskId: this.currentTask.id, reason: 'Agent shutdown' }
      ));
      
      this.currentTask = null;
    }
  }

  private updateMetrics(result: TaskResult): void {
    // Update task completion metrics
    if (result.success) {
      this.metrics.tasksCompleted++;
    }

    // Update average task duration
    const currentAvg = this.metrics.averageTaskDuration;
    const totalTasks = this.metrics.tasksCompleted + (result.success ? 0 : 1);
    this.metrics.averageTaskDuration = 
      (currentAvg * (totalTasks - 1) + result.duration) / totalTasks;

    // Update success rate
    const successfulTasks = this.metrics.tasksCompleted;
    this.metrics.successRate = totalTasks > 0 ? successfulTasks / totalTasks : 0;

    this.updateLastActivity();
  }

  private async getSystemUsage(): Promise<{
    cpu: number;
    memory: number;
    diskSpace: number;
  }> {
    // Simplified system usage measurement
    // In production, you'd use proper system monitoring tools
    return {
      cpu: Math.random() * 100, // Placeholder
      memory: Math.random() * 100, // Placeholder
      diskSpace: Math.random() * 100 // Placeholder
    };
  }

  private async measureResponseTime(): Promise<number> {
    const start = Date.now();
    // Simple ping operation
    await new Promise(resolve => setTimeout(resolve, 1));
    return Date.now() - start;
  }

  private calculateErrorRate(): number {
    const totalTasks = this.metrics.tasksCompleted;
    if (totalTasks === 0) return 0;
    
    // This would be calculated based on actual error tracking
    return Math.max(0, 1 - this.metrics.successRate);
  }

  // Event handlers
  private async handleTaskAssigned(task: Task): Promise<void> {
    this.agentLogger.info(`Task assigned: ${task.title}`, { taskId: task.id });
  }

  private async handleTaskCompleted(result: TaskResult): Promise<void> {
    this.agentLogger.info(`Task completed successfully`, { 
      taskId: result.taskId,
      duration: result.duration 
    });
  }

  private async handleTaskFailed(error: any): Promise<void> {
    this.agentLogger.error('Task execution failed', error);
  }

  private async handleHealthCheck(): Promise<void> {
    const health = await this.getHealth();
    this.agentLogger.debug('Health check completed', { health });
  }

  // Capability management
  public hasCapability(capabilityName: string): boolean {
    return this.capabilities.some(cap => cap.name === capabilityName);
  }

  public getCapabilityLevel(capabilityName: string): number {
    const capability = this.capabilities.find(cap => cap.name === capabilityName);
    return capability ? capability.level : 0;
  }

  public addCapability(capability: AgentCapability): void {
    const existingIndex = this.capabilities.findIndex(cap => cap.name === capability.name);
    if (existingIndex >= 0) {
      this.capabilities[existingIndex] = capability;
    } else {
      this.capabilities.push(capability);
    }
    
    this.agentLogger.info(`Capability updated: ${capability.name} (level ${capability.level})`);
  }

  public removeCapability(capabilityName: string): void {
    this.capabilities = this.capabilities.filter(cap => cap.name !== capabilityName);
    this.agentLogger.info(`Capability removed: ${capabilityName}`);
  }
}