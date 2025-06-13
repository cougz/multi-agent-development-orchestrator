#!/usr/bin/env node

import { Command } from 'commander';
import { MADOOrchestrator } from '../index';
import { DevelopmentAgent } from '@agents/dev-agent';
import { AgentRole } from '../types/agent.types';
import { configManager } from '@core/config';
import { logger } from '@core/logger';

const program = new Command();

program
  .name('mado')
  .description('Multi-Agent Development Orchestrator CLI')
  .version('1.0.0');

// Start orchestrator command
program
  .command('start')
  .description('Start the MADO orchestrator with all agents')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-d, --detach', 'Run in background')
  .action(async (options) => {
    try {
      logger.info('Starting MADO Orchestrator via CLI');
      
      if (options.config) {
        // Load custom config
        const customConfigManager = new (require('@core/config').ConfigManager)(options.config);
        await customConfigManager.load();
      }

      const orchestrator = new MADOOrchestrator();
      await orchestrator.initialize();
      await orchestrator.start();

      if (!options.detach) {
        // Keep running in foreground
        logger.info('Orchestrator running. Press Ctrl+C to stop.');
        
        process.on('SIGINT', async () => {
          logger.info('Shutting down...');
          await orchestrator.stop();
          process.exit(0);
        });
      }
    } catch (error) {
      logger.error('Failed to start orchestrator', error);
      process.exit(1);
    }
  });

// Start single agent command
program
  .command('agent')
  .description('Start a single agent')
  .requiredOption('-r, --role <role>', 'Agent role (frontend, backend, qa, devops)')
  .option('-i, --id <id>', 'Agent ID')
  .option('-n, --name <name>', 'Agent name')
  .option('-w, --workdir <path>', 'Working directory')
  .action(async (options) => {
    try {
      const config = await configManager.load();
      
      const agentRole = options.role.toLowerCase() as AgentRole;
      if (!Object.values(AgentRole).includes(agentRole)) {
        logger.error(`Invalid role: ${options.role}. Valid roles: ${Object.values(AgentRole).join(', ')}`);
        process.exit(1);
      }

      const agentConfig = {
        id: options.id || `${agentRole}-${Date.now()}`,
        name: options.name || `${agentRole} Agent`,
        role: agentRole,
        workingDirectory: options.workdir || config.project.workingDirectory,
        capabilities: [],
        maxConcurrentTasks: 2,
        healthCheckInterval: 30000,
        settings: {}
      };

      const agent = new DevelopmentAgent(agentConfig);
      
      logger.info(`Starting ${agentRole} agent`, { id: agentConfig.id });
      
      await agent.start();
      
      logger.info(`Agent ${agentConfig.id} is running. Press Ctrl+C to stop.`);
      
      process.on('SIGINT', async () => {
        logger.info('Stopping agent...');
        await agent.stop();
        process.exit(0);
      });
      
    } catch (error) {
      logger.error('Failed to start agent', error as Error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show orchestrator and agent status')
  .action(async () => {
    try {
      // This would connect to a running orchestrator instance
      // For now, we'll show a placeholder
      console.log('MADO Orchestrator Status:');
      console.log('Status: Not implemented yet');
      console.log('Use the web dashboard at http://localhost:3000 for detailed status');
    } catch (error) {
      logger.error('Failed to get status', error);
      process.exit(1);
    }
  });

// Config commands
const configCmd = program
  .command('config')
  .description('Configuration management');

configCmd
  .command('init')
  .description('Initialize default configuration')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (options) => {
    try {
      const defaultConfig = configManager.createDefaultConfig();
      
      // Customize for current environment
      defaultConfig.project.workingDirectory = process.cwd();
      defaultConfig.project.name = require('path').basename(process.cwd()) + ' - MADO Project';
      
      const configPath = 'config/local.json';
      const fs = require('fs');
      
      if (fs.existsSync(configPath) && !options.force) {
        console.log('Configuration already exists. Use --force to overwrite.');
        process.exit(1);
      }
      
      // Ensure config directory exists
      if (!fs.existsSync('config')) {
        fs.mkdirSync('config', { recursive: true });
      }
      
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      console.log(`Configuration initialized: ${configPath}`);
    } catch (error) {
      logger.error('Failed to initialize configuration', error);
      process.exit(1);
    }
  });

configCmd
  .command('validate')
  .description('Validate configuration file')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    try {
      if (options.config) {
        const customConfigManager = new (require('@core/config').ConfigManager)(options.config);
        await customConfigManager.load();
      } else {
        await configManager.load();
      }
      
      console.log('✅ Configuration is valid');
    } catch (error) {
      console.log('❌ Configuration validation failed:', (error as Error).message);
      process.exit(1);
    }
  });

// Setup command
program
  .command('setup')
  .description('Run the setup script')
  .action(async () => {
    try {
      const setupScript = require('../../scripts/setup.js');
      await setupScript.main();
    } catch (error) {
      logger.error('Setup failed', error);
      process.exit(1);
    }
  });

// Version command is handled by commander automatically

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}