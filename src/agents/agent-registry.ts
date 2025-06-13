import { EventEmitter } from 'events';
import { 
  IAgent, 
  AgentRole, 
  AgentStatus, 
  AgentHealth, 
  AgentConfig 
} from '../types/agent.types';
import { Task, TaskAssignment } from '../types/task.types';
import { logger } from '@core/logger';
import { eventBus, createSystemEvent, SystemEvent } from '@core/events';

export interface AgentRegistryConfig {
  maxAgents: number;
  healthCheckInterval: number;
  autoRestart: boolean;
  loadBalancing: 'round-robin' | 'capability-based' | 'load-based';
}

export interface AgentMatchResult {
  agent: IAgent;
  confidence: number;
  reasoning: string[];
}

export class AgentRegistry extends EventEmitter {
  private agents: Map<string, IAgent> = new Map();
  private agentConfigs: Map<string, AgentConfig> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private config: AgentRegistryConfig;
  private assignmentHistory: TaskAssignment[] = [];

  constructor(config: AgentRegistryConfig) {
    super();
    this.config = config;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for agent events
    eventBus.on(SystemEvent.AGENT_STARTED, this.handleAgentStarted.bind(this));
    eventBus.on(SystemEvent.AGENT_STOPPED, this.handleAgentStopped.bind(this));
    eventBus.on(SystemEvent.AGENT_ERROR, this.handleAgentError.bind(this));
  }

  public async initialize(): Promise<void> {
    try {
      this.startHealthMonitoring();
      
      eventBus.emit(createSystemEvent(
        SystemEvent.SYSTEM_STARTED,
        { component: 'AgentRegistry', maxAgents: this.config.maxAgents }
      ));
      
      logger.info('Agent registry initialized', {
        maxAgents: this.config.maxAgents,
        healthCheckInterval: this.config.healthCheckInterval
      });
    } catch (error) {
      logger.error('Failed to initialize agent registry', error);
      throw error;
    }
  }

  public async registerAgent(agent: IAgent, config: AgentConfig): Promise<void> {
    try {
      // Check if we've reached the maximum number of agents
      if (this.agents.size >= this.config.maxAgents) {
        throw new Error(`Maximum number of agents (${this.config.maxAgents}) reached`);
      }

      // Check if agent ID is already registered
      if (this.agents.has(agent.id)) {
        throw new Error(`Agent with ID ${agent.id} is already registered`);
      }

      // Validate agent configuration
      this.validateAgentConfig(config);

      // Register the agent
      this.agents.set(agent.id, agent);
      this.agentConfigs.set(agent.id, config);

      // Setup agent event forwarding
      this.setupAgentEventForwarding(agent);

      logger.info(`Registered agent: ${agent.name} (${agent.id})`, {
        role: agent.role,
        capabilities: agent.capabilities.map(c => c.name)
      });

      eventBus.emit(createSystemEvent(
        SystemEvent.SYSTEM_STARTED,
        { 
          component: 'Agent',
          agentId: agent.id,
          agentName: agent.name,
          role: agent.role
        }
      ));

      this.emit('agent:registered', agent);
    } catch (error) {
      logger.error(`Failed to register agent ${agent.id}`, error);
      throw error;
    }
  }

  public async unregisterAgent(agentId: string): Promise<void> {
    try {
      const agent = this.agents.get(agentId);
      
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Stop the agent if it's running
      if (agent.status !== AgentStatus.INACTIVE) {
        await agent.stop();
      }

      // Remove from registry
      this.agents.delete(agentId);
      this.agentConfigs.delete(agentId);

      logger.info(`Unregistered agent: ${agent.name} (${agentId})`);

      eventBus.emit(createSystemEvent(
        SystemEvent.SYSTEM_STOPPED,
        { 
          component: 'Agent',
          agentId: agentId,
          agentName: agent.name
        }
      ));

      this.emit('agent:unregistered', agent);
    } catch (error) {
      logger.error(`Failed to unregister agent ${agentId}`, error);
      throw error;
    }
  }

  public getAgent(agentId: string): IAgent | undefined {
    return this.agents.get(agentId);
  }

  public getAllAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  public getAgentsByRole(role: AgentRole): IAgent[] {
    return this.getAllAgents().filter(agent => agent.role === role);
  }

  public getAgentsByStatus(status: AgentStatus): IAgent[] {
    return this.getAllAgents().filter(agent => agent.status === status);
  }

  public getActiveAgents(): IAgent[] {
    return this.getAgentsByStatus(AgentStatus.ACTIVE);
  }

  public async findBestAgentForTask(task: Task): Promise<AgentMatchResult | null> {
    const availableAgents = this.getAllAgents().filter(agent => 
      agent.status === AgentStatus.ACTIVE && this.canAgentHandleTask(agent, task)
    );

    if (availableAgents.length === 0) {
      return null;
    }

    let bestMatch: AgentMatchResult | null = null;

    for (const agent of availableAgents) {
      const matchResult = await this.calculateAgentTaskMatch(agent, task);
      
      if (!bestMatch || matchResult.confidence > bestMatch.confidence) {
        bestMatch = matchResult;
      }
    }

    return bestMatch;
  }

  public async assignTaskToAgent(task: Task, agentId?: string): Promise<TaskAssignment> {
    try {
      let targetAgent: IAgent;

      if (agentId) {
        // Specific agent requested
        const agent = this.getAgent(agentId);
        if (!agent) {
          throw new Error(`Agent ${agentId} not found`);
        }
        if (agent.status !== AgentStatus.ACTIVE) {
          throw new Error(`Agent ${agentId} is not active (status: ${agent.status})`);
        }
        targetAgent = agent;
      } else {
        // Find best agent automatically
        const matchResult = await this.findBestAgentForTask(task);
        if (!matchResult) {
          throw new Error('No suitable agent found for task');
        }
        targetAgent = matchResult.agent;
      }

      // Create task assignment
      const assignment: TaskAssignment = {
        taskId: task.id,
        agentId: targetAgent.id,
        assignedAt: new Date(),
        estimatedCompletion: this.calculateEstimatedCompletion(task, targetAgent),
        confidence: agentId ? 1.0 : await this.calculateAssignmentConfidence(task, targetAgent)
      };

      // Store assignment history
      this.assignmentHistory.push(assignment);

      logger.info(`Assigned task ${task.id} to agent ${targetAgent.id}`, {
        taskTitle: task.title,
        agentName: targetAgent.name,
        confidence: assignment.confidence
      });

      eventBus.emit(createSystemEvent(
        SystemEvent.TASK_ASSIGNED,
        {
          taskId: task.id,
          agentId: targetAgent.id,
          assignment
        }
      ));

      return assignment;
    } catch (error) {
      logger.error(`Failed to assign task ${task.id}`, error);
      throw error;
    }
  }

  public async startAllAgents(): Promise<void> {
    logger.info('Starting all registered agents');
    
    const startPromises = this.getAllAgents().map(async agent => {
      try {
        if (agent.status === AgentStatus.INACTIVE) {
          await agent.start();
        }
      } catch (error) {
        logger.error(`Failed to start agent ${agent.id}`, error);
      }
    });

    await Promise.all(startPromises);
    
    const activeAgents = this.getActiveAgents();
    logger.info(`Started ${activeAgents.length} agents`);
  }

  public async stopAllAgents(): Promise<void> {
    logger.info('Stopping all agents');
    
    const stopPromises = this.getAllAgents().map(async agent => {
      try {
        if (agent.status !== AgentStatus.INACTIVE) {
          await agent.stop();
        }
      } catch (error) {
        logger.error(`Failed to stop agent ${agent.id}`, error);
      }
    });

    await Promise.all(stopPromises);
    
    logger.info('All agents stopped');
  }

  public async getSystemHealth(): Promise<{
    totalAgents: number;
    activeAgents: number;
    healthyAgents: number;
    agentHealth: Record<string, AgentHealth>;
  }> {
    const agents = this.getAllAgents();
    const healthResults = await Promise.all(
      agents.map(async agent => {
        try {
          const health = await agent.getHealth();
          return { agentId: agent.id, health };
        } catch (error) {
          logger.error(`Failed to get health for agent ${agent.id}`, error);
          return {
            agentId: agent.id,
            health: {
              status: AgentStatus.ERROR,
              cpu: 0,
              memory: 0,
              diskSpace: 0,
              responseTime: 0,
              errorRate: 1,
              lastCheck: new Date()
            }
          };
        }
      })
    );

    const agentHealth: Record<string, AgentHealth> = {};
    let healthyAgents = 0;

    healthResults.forEach(({ agentId, health }) => {
      agentHealth[agentId] = health;
      if (health.status === AgentStatus.ACTIVE && health.errorRate < 0.1) {
        healthyAgents++;
      }
    });

    return {
      totalAgents: agents.length,
      activeAgents: this.getActiveAgents().length,
      healthyAgents,
      agentHealth
    };
  }

  public getAgentStatistics(): {
    byRole: Record<AgentRole, number>;
    byStatus: Record<AgentStatus, number>;
    averageUptime: number;
    totalTaskAssignments: number;
  } {
    const agents = this.getAllAgents();
    
    const byRole: Record<AgentRole, number> = {} as Record<AgentRole, number>;
    const byStatus: Record<AgentStatus, number> = {} as Record<AgentStatus, number>;

    // Initialize counters
    Object.values(AgentRole).forEach(role => { byRole[role] = 0; });
    Object.values(AgentStatus).forEach(status => { byStatus[status] = 0; });

    let totalUptime = 0;
    let agentsWithUptime = 0;

    agents.forEach(agent => {
      byRole[agent.role]++;
      byStatus[agent.status]++;

      // Calculate uptime if agent has metrics
      if (agent.metrics && agent.status !== AgentStatus.INACTIVE) {
        const uptime = Date.now() - agent.lastActivity.getTime();
        totalUptime += uptime;
        agentsWithUptime++;
      }
    });

    return {
      byRole,
      byStatus,
      averageUptime: agentsWithUptime > 0 ? totalUptime / agentsWithUptime : 0,
      totalTaskAssignments: this.assignmentHistory.length
    };
  }

  private validateAgentConfig(config: AgentConfig): void {
    if (!config.id || config.id.trim() === '') {
      throw new Error('Agent ID is required');
    }

    if (!config.name || config.name.trim() === '') {
      throw new Error('Agent name is required');
    }

    if (!Object.values(AgentRole).includes(config.role)) {
      throw new Error(`Invalid agent role: ${config.role}`);
    }

    if (!config.workingDirectory || config.workingDirectory.trim() === '') {
      throw new Error('Working directory is required');
    }

    if (config.maxConcurrentTasks < 1) {
      throw new Error('Max concurrent tasks must be at least 1');
    }
  }

  private setupAgentEventForwarding(agent: IAgent): void {
    // Forward agent events through the registry
    // Cast to EventEmitter since BaseAgent extends EventEmitter
    const agentEmitter = agent as any;
    if (agentEmitter.on && typeof agentEmitter.on === 'function') {
      agentEmitter.on('error', (error: any) => {
        this.emit('agent:error', { agent, error });
      });

      agentEmitter.on('task:completed', (result: any) => {
        this.emit('agent:task:completed', { agent, result });
      });

      agentEmitter.on('status:changed', (status: any) => {
        this.emit('agent:status:changed', { agent, status });
      });
    }
  }

  private canAgentHandleTask(agent: IAgent, task: Task): boolean {
    // Basic capability checking - can be enhanced
    const requiredCapabilities = task.requirements
      .filter(req => req.type === 'technical')
      .map(req => req.description);

    return requiredCapabilities.every(capability =>
      agent.capabilities.some(agentCap => 
        agentCap.name.toLowerCase().includes(capability.toLowerCase())
      )
    );
  }

  private async calculateAgentTaskMatch(agent: IAgent, task: Task): Promise<AgentMatchResult> {
    const reasoning: string[] = [];
    let confidence = 0;

    // Role matching
    const roleBonus = this.getRoleTaskBonus(agent.role, task.type);
    confidence += roleBonus;
    if (roleBonus > 0) {
      reasoning.push(`Role ${agent.role} matches task type ${task.type}`);
    }

    // Capability matching
    const capabilityScore = this.calculateCapabilityScore(agent, task);
    confidence += capabilityScore;
    if (capabilityScore > 0) {
      reasoning.push(`Agent has relevant capabilities`);
    }

    // Load balancing
    const loadScore = this.calculateLoadScore(agent);
    confidence += loadScore;
    if (loadScore > 0) {
      reasoning.push(`Agent has low current load`);
    }

    // Performance history
    const performanceScore = this.calculatePerformanceScore(agent);
    confidence += performanceScore;
    if (performanceScore > 0) {
      reasoning.push(`Agent has good performance history`);
    }

    return {
      agent,
      confidence: Math.min(1.0, confidence),
      reasoning
    };
  }

  private getRoleTaskBonus(role: AgentRole, taskType: string): number {
    // Define role-task compatibility matrix
    const compatibility: Record<AgentRole, string[]> = {
      [AgentRole.FRONTEND]: ['frontend', 'ui', 'component', 'styling'],
      [AgentRole.BACKEND]: ['backend', 'api', 'database', 'server'],
      [AgentRole.DEVOPS]: ['deployment', 'infrastructure', 'ci/cd', 'monitoring'],
      [AgentRole.QA]: ['testing', 'quality', 'validation', 'bug'],
      [AgentRole.FULL_STACK]: ['frontend', 'backend', 'ui', 'api'],
      [AgentRole.ORCHESTRATOR]: ['coordination', 'management', 'planning']
    };

    const roleKeywords = compatibility[role] || [];
    const taskTypeLower = taskType.toLowerCase();
    
    return roleKeywords.some(keyword => taskTypeLower.includes(keyword)) ? 0.3 : 0;
  }

  private calculateCapabilityScore(agent: IAgent, task: Task): number {
    const requiredCapabilities = task.requirements
      .filter(req => req.type === 'technical')
      .length;

    if (requiredCapabilities === 0) return 0.2;

    const matchingCapabilities = agent.capabilities.filter(capability =>
      task.requirements.some(req => 
        req.description.toLowerCase().includes(capability.name.toLowerCase())
      )
    );

    return Math.min(0.3, (matchingCapabilities.length / requiredCapabilities) * 0.3);
  }

  private calculateLoadScore(agent: IAgent): number {
    // Simple load calculation - can be enhanced with actual task queue analysis
    if (agent.status === AgentStatus.ACTIVE) {
      return 0.2;
    } else if (agent.status === AgentStatus.BUSY) {
      return 0.1;
    }
    return 0;
  }

  private calculatePerformanceScore(agent: IAgent): number {
    if (!agent.metrics) return 0.1;
    
    const successRate = agent.metrics.successRate;
    const qualityScore = agent.metrics.codeQualityScore / 100;
    
    return Math.min(0.2, (successRate + qualityScore) / 2 * 0.2);
  }

  private calculateEstimatedCompletion(task: Task, agent: IAgent): Date {
    const baseEstimate = task.estimatedDuration || 3600000; // 1 hour default
    const agentModifier = agent.metrics.averageTaskDuration > 0 ? 
      agent.metrics.averageTaskDuration / baseEstimate : 1;
    
    const adjustedEstimate = baseEstimate * agentModifier;
    return new Date(Date.now() + adjustedEstimate);
  }

  private async calculateAssignmentConfidence(task: Task, agent: IAgent): Promise<number> {
    const matchResult = await this.calculateAgentTaskMatch(agent, task);
    return matchResult.confidence;
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        
        // Check for agents that need attention
        Object.entries(health.agentHealth).forEach(([agentId, agentHealth]) => {
          if (agentHealth.status === AgentStatus.ERROR) {
            this.handleUnhealthyAgent(agentId, agentHealth);
          }
        });

        eventBus.emit(createSystemEvent(
          SystemEvent.SYSTEM_HEALTH_CHECK,
          { registryHealth: health }
        ));
      } catch (error) {
        logger.error('Registry health check failed', error);
      }
    }, this.config.healthCheckInterval);
  }

  private async handleUnhealthyAgent(agentId: string, health: AgentHealth): Promise<void> {
    const agent = this.getAgent(agentId);
    if (!agent) return;

    logger.warn(`Unhealthy agent detected: ${agentId}`, { health });

    if (this.config.autoRestart && health.status === AgentStatus.ERROR) {
      try {
        logger.info(`Attempting to restart unhealthy agent: ${agentId}`);
        await agent.restart();
      } catch (error) {
        logger.error(`Failed to restart agent ${agentId}`, error);
      }
    }
  }

  private handleAgentStarted(event: any): void {
    logger.debug(`Agent started event received`, event.data);
  }

  private handleAgentStopped(event: any): void {
    logger.debug(`Agent stopped event received`, event.data);
  }

  private handleAgentError(event: any): void {
    logger.warn(`Agent error event received`, event.data);
  }

  public async cleanup(): Promise<void> {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      await this.stopAllAgents();
      
      this.agents.clear();
      this.agentConfigs.clear();
      this.assignmentHistory = [];

      logger.info('Agent registry cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup agent registry', error);
      throw error;
    }
  }
}