import { configManager } from '@core/config';
import { logger } from '@core/logger';
import { eventBus } from '@core/events';
import { AgentRegistry } from '@agents/agent-registry';
import { DevelopmentAgent } from '@agents/dev-agent';
import { AgentRole } from './types/agent.types';

export class MADOOrchestrator {
  private agentRegistry: AgentRegistry;
  private isRunning = false;

  constructor() {
    this.agentRegistry = new AgentRegistry({
      maxAgents: 10,
      healthCheckInterval: 30000,
      autoRestart: true,
      loadBalancing: 'capability-based'
    });
  }

  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing MADO Orchestrator...');

      // Load configuration
      await configManager.load();
      const config = configManager.get();

      logger.info('Configuration loaded successfully', {
        project: config.project.name,
        maxAgents: config.agents.maxConcurrentAgents
      });

      // Initialize agent registry
      await this.agentRegistry.initialize();

      // Create sample agents for demonstration
      await this.createSampleAgents();

      this.isRunning = true;
      logger.info('MADO Orchestrator initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize MADO Orchestrator', error);
      throw error;
    }
  }

  private async createSampleAgents(): Promise<void> {
    const config = configManager.get();
    const workingDir = config.project.workingDirectory;

    // Create a frontend agent
    const frontendAgent = new DevelopmentAgent({
      id: 'frontend-001',
      name: 'Frontend Developer',
      role: AgentRole.FRONTEND,
      workingDirectory: workingDir,
      capabilities: [],
      maxConcurrentTasks: 2,
      healthCheckInterval: 30000,
      settings: {}
    });

    // Create a backend agent
    const backendAgent = new DevelopmentAgent({
      id: 'backend-001',
      name: 'Backend Developer',
      role: AgentRole.BACKEND,
      workingDirectory: workingDir,
      capabilities: [],
      maxConcurrentTasks: 2,
      healthCheckInterval: 30000,
      settings: {}
    });

    // Create a QA agent
    const qaAgent = new DevelopmentAgent({
      id: 'qa-001',
      name: 'Quality Assurance',
      role: AgentRole.QA,
      workingDirectory: workingDir,
      capabilities: [],
      maxConcurrentTasks: 1,
      healthCheckInterval: 30000,
      settings: {}
    });

    // Register agents
    await this.agentRegistry.registerAgent(frontendAgent, frontendAgent as any);
    await this.agentRegistry.registerAgent(backendAgent, backendAgent as any);
    await this.agentRegistry.registerAgent(qaAgent, qaAgent as any);

    logger.info('Sample agents created and registered', {
      agents: ['frontend-001', 'backend-001', 'qa-001']
    });
  }

  public async start(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }

    try {
      logger.info('Starting MADO Orchestrator...');

      // Start all registered agents
      await this.agentRegistry.startAllAgents();

      logger.info('MADO Orchestrator started successfully');

      // Log system status
      await this.logSystemStatus();

    } catch (error) {
      logger.error('Failed to start MADO Orchestrator', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      logger.info('Stopping MADO Orchestrator...');

      // Stop all agents
      await this.agentRegistry.stopAllAgents();

      // Cleanup
      await this.agentRegistry.cleanup();

      this.isRunning = false;

      logger.info('MADO Orchestrator stopped successfully');

    } catch (error) {
      logger.error('Failed to stop MADO Orchestrator', error);
      throw error;
    }
  }

  public getAgentRegistry(): AgentRegistry {
    return this.agentRegistry;
  }

  private async logSystemStatus(): Promise<void> {
    const health = await this.agentRegistry.getSystemHealth();
    const stats = this.agentRegistry.getAgentStatistics();

    logger.info('System Status', {
      totalAgents: health.totalAgents,
      activeAgents: health.activeAgents,
      healthyAgents: health.healthyAgents,
      agentsByRole: stats.byRole,
      agentsByStatus: stats.byStatus
    });
  }

  public async getStatus(): Promise<{
    isRunning: boolean;
    systemHealth: any;
    agentStatistics: any;
  }> {
    const systemHealth = await this.agentRegistry.getSystemHealth();
    const agentStatistics = this.agentRegistry.getAgentStatistics();

    return {
      isRunning: this.isRunning,
      systemHealth,
      agentStatistics
    };
  }
}

// Main execution function
export async function main(): Promise<void> {
  const orchestrator = new MADOOrchestrator();

  try {
    await orchestrator.initialize();
    await orchestrator.start();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await orchestrator.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await orchestrator.stop();
      process.exit(0);
    });

    // Keep the process running
    logger.info('MADO Orchestrator is running. Press Ctrl+C to stop.');

  } catch (error) {
    logger.error('Fatal error in MADO Orchestrator', error);
    process.exit(1);
  }
}

// Export main components
export { configManager } from '@core/config';
export { logger } from '@core/logger';
export { eventBus } from '@core/events';
export { AgentRegistry } from '@agents/agent-registry';
export { DevelopmentAgent } from '@agents/dev-agent';
export * from './types/index';

// Run main if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Failed to start MADO Orchestrator:', error);
    process.exit(1);
  });
}