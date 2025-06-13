import * as path from 'path';
import * as fs from 'fs';
import { BaseAgent } from './base-agent';
import { 
  AgentConfig, 
  AgentRole, 
  AgentCapability 
} from '../types/agent.types';
import { Task, TaskResult, TaskType } from '../types/task.types';
import { GitRepository } from '@git/repository';
import { WorktreeManager } from '@git/worktree';

export class DevelopmentAgent extends BaseAgent {
  private gitRepository: GitRepository;
  private worktreeManager: WorktreeManager;
  private personalWorktree: string | null = null;

  constructor(config: AgentConfig) {
    super(config);
    
    this.gitRepository = new GitRepository(config.workingDirectory);
    this.worktreeManager = new WorktreeManager(this.gitRepository, config.workingDirectory);

    // Add default development capabilities
    this.addDefaultCapabilities();
  }

  private addDefaultCapabilities(): void {
    const defaultCapabilities: AgentCapability[] = [
      {
        name: 'git',
        level: 8,
        description: 'Git version control operations'
      },
      {
        name: 'coding',
        level: 7,
        description: 'General programming and code development'
      },
      {
        name: 'file-management',
        level: 9,
        description: 'File system operations and management'
      },
      {
        name: 'debugging',
        level: 6,
        description: 'Code debugging and troubleshooting'
      }
    ];

    // Add role-specific capabilities
    switch (this.role) {
      case AgentRole.FRONTEND:
        defaultCapabilities.push(
          {
            name: 'javascript',
            level: 8,
            description: 'JavaScript/TypeScript development'
          },
          {
            name: 'react',
            level: 7,
            description: 'React framework development'
          },
          {
            name: 'css',
            level: 8,
            description: 'CSS and styling'
          },
          {
            name: 'html',
            level: 9,
            description: 'HTML markup'
          }
        );
        break;

      case AgentRole.BACKEND:
        defaultCapabilities.push(
          {
            name: 'nodejs',
            level: 8,
            description: 'Node.js backend development'
          },
          {
            name: 'databases',
            level: 7,
            description: 'Database design and operations'
          },
          {
            name: 'apis',
            level: 8,
            description: 'REST API development'
          },
          {
            name: 'server-architecture',
            level: 6,
            description: 'Server architecture and design'
          }
        );
        break;

      case AgentRole.QA:
        defaultCapabilities.push(
          {
            name: 'testing',
            level: 9,
            description: 'Software testing and quality assurance'
          },
          {
            name: 'test-automation',
            level: 7,
            description: 'Automated testing frameworks'
          },
          {
            name: 'quality-metrics',
            level: 8,
            description: 'Code quality analysis and metrics'
          }
        );
        break;

      case AgentRole.DEVOPS:
        defaultCapabilities.push(
          {
            name: 'docker',
            level: 8,
            description: 'Docker containerization'
          },
          {
            name: 'ci-cd',
            level: 7,
            description: 'Continuous integration and deployment'
          },
          {
            name: 'infrastructure',
            level: 6,
            description: 'Infrastructure management'
          },
          {
            name: 'monitoring',
            level: 7,
            description: 'System monitoring and observability'
          }
        );
        break;
    }

    defaultCapabilities.forEach(capability => {
      this.addCapability(capability);
    });
  }

  protected async initialize(): Promise<void> {
    try {
      // Initialize git repository
      await this.gitRepository.initialize();
      await this.worktreeManager.initialize();

      // Create personal worktree for this agent
      const worktreeInfo = await this.worktreeManager.createWorktreeForAgent(this.id);
      this.personalWorktree = worktreeInfo.path;

      // Ensure working directory exists and is accessible
      if (!fs.existsSync(this.workingDirectory)) {
        fs.mkdirSync(this.workingDirectory, { recursive: true });
      }

      this.agentLogger.info(`Development agent initialized with worktree: ${this.personalWorktree}`);
    } catch (error) {
      this.agentLogger.error('Failed to initialize development agent', error);
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    try {
      // Remove personal worktree
      if (this.personalWorktree) {
        await this.worktreeManager.removeWorktreeForAgent(this.id);
        this.personalWorktree = null;
      }

      this.agentLogger.info('Development agent cleanup completed');
    } catch (error) {
      this.agentLogger.error('Failed to cleanup development agent', error);
      throw error;
    }
  }

  protected canHandleTask(task: Task): boolean {
    const supportedTaskTypes = [
      TaskType.FEATURE,
      TaskType.BUG_FIX,
      TaskType.REFACTOR,
      TaskType.CODE_REVIEW,
      TaskType.DOCUMENTATION
    ];

    // Check if task type is supported
    if (!supportedTaskTypes.includes(task.type)) {
      return false;
    }

    // Check if we have the required capabilities
    const requiredCapabilities = task.requirements
      .filter(req => req.type === 'technical')
      .map(req => req.description.toLowerCase());

    return requiredCapabilities.every(capability =>
      this.capabilities.some(agentCap => 
        agentCap.name.toLowerCase().includes(capability) && agentCap.level >= 5
      )
    );
  }

  protected async performTask(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const changedFiles: string[] = [];

    try {
      this.agentLogger.info(`Starting task execution: ${task.title}`, {
        type: task.type,
        priority: task.priority
      });

      // Switch to personal worktree
      process.chdir(this.personalWorktree || this.workingDirectory);

      // Execute task based on type
      let output: string;
      
      switch (task.type) {
        case TaskType.FEATURE:
          output = await this.implementFeature(task);
          break;
        case TaskType.BUG_FIX:
          output = await this.fixBug(task);
          break;
        case TaskType.REFACTOR:
          output = await this.refactorCode(task);
          break;
        case TaskType.CODE_REVIEW:
          output = await this.reviewCode(task);
          break;
        case TaskType.DOCUMENTATION:
          output = await this.writeDocumentation(task);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      // Track changed files (simplified implementation)
      const gitStatus = await this.gitRepository.getStatus();
      changedFiles.push(...gitStatus.modified, ...gitStatus.created);

      // Commit changes if any
      if (changedFiles.length > 0) {
        const commitMessage = this.generateCommitMessage(task, output);
        await this.gitRepository.commit(commitMessage, changedFiles);
      }

      const duration = Date.now() - startTime;

      this.agentLogger.info(`Task completed successfully: ${task.title}`, {
        duration: `${duration}ms`,
        filesChanged: changedFiles.length
      });

      return {
        taskId: task.id,
        success: true,
        output,
        duration,
        metadata: {
          taskType: task.type,
          agent: this.id,
          worktree: this.personalWorktree
        },
        changedFiles,
        completedAt: new Date()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.agentLogger.error(`Task failed: ${task.title}`, error);

      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
        metadata: {
          taskType: task.type,
          agent: this.id,
          worktree: this.personalWorktree
        },
        changedFiles,
        completedAt: new Date()
      };
    }
  }

  private async implementFeature(task: Task): Promise<string> {
    this.agentLogger.info(`Implementing feature: ${task.description}`);
    
    // This is a simplified implementation
    // In a real scenario, this would involve complex code generation,
    // file creation, and integration with existing code
    
    const featureFiles = task.files || [];
    const implementationSteps: string[] = [];

    for (const file of featureFiles) {
      const filePath = path.join(this.personalWorktree || this.workingDirectory, file);
      
      if (fs.existsSync(filePath)) {
        // Modify existing file
        implementationSteps.push(`Modified ${file}`);
      } else {
        // Create new file
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        const content = this.generateCodeTemplate(task, file);
        fs.writeFileSync(filePath, content);
        implementationSteps.push(`Created ${file}`);
      }
    }

    return `Feature implementation completed:\n${implementationSteps.join('\n')}`;
  }

  private async fixBug(task: Task): Promise<string> {
    this.agentLogger.info(`Fixing bug: ${task.description}`);
    
    const bugFiles = task.files || [];
    const fixSteps: string[] = [];

    for (const file of bugFiles) {
      const filePath = path.join(this.personalWorktree || this.workingDirectory, file);
      
      if (fs.existsSync(filePath)) {
        // Read and analyze the file
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Apply bug fix (simplified)
        const fixedContent = this.applyBugFix(content, task);
        fs.writeFileSync(filePath, fixedContent);
        
        fixSteps.push(`Fixed bug in ${file}`);
      }
    }

    return `Bug fix completed:\n${fixSteps.join('\n')}`;
  }

  private async refactorCode(task: Task): Promise<string> {
    this.agentLogger.info(`Refactoring code: ${task.description}`);
    
    const refactorFiles = task.files || [];
    const refactorSteps: string[] = [];

    for (const file of refactorFiles) {
      const filePath = path.join(this.personalWorktree || this.workingDirectory, file);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const refactoredContent = this.applyRefactoring(content, task);
        fs.writeFileSync(filePath, refactoredContent);
        
        refactorSteps.push(`Refactored ${file}`);
      }
    }

    return `Code refactoring completed:\n${refactorSteps.join('\n')}`;
  }

  private async reviewCode(task: Task): Promise<string> {
    this.agentLogger.info(`Reviewing code: ${task.description}`);
    
    const reviewFiles = task.files || [];
    const reviewComments: string[] = [];

    for (const file of reviewFiles) {
      const filePath = path.join(this.personalWorktree || this.workingDirectory, file);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const comments = this.generateCodeReview(content, file);
        reviewComments.push(`${file}:\n${comments}`);
      }
    }

    return `Code review completed:\n${reviewComments.join('\n\n')}`;
  }

  private async writeDocumentation(task: Task): Promise<string> {
    this.agentLogger.info(`Writing documentation: ${task.description}`);
    
    const docFiles = task.files || ['README.md'];
    const docSteps: string[] = [];

    for (const file of docFiles) {
      const filePath = path.join(this.personalWorktree || this.workingDirectory, file);
      const dir = path.dirname(filePath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const content = this.generateDocumentation(task, file);
      fs.writeFileSync(filePath, content);
      
      docSteps.push(`Created/updated ${file}`);
    }

    return `Documentation completed:\n${docSteps.join('\n')}`;
  }

  private generateCodeTemplate(task: Task, fileName: string): string {
    const ext = path.extname(fileName);
    
    switch (ext) {
      case '.ts':
      case '.js':
        return `// ${task.title}\n// Generated by Agent: ${this.name}\n\nexport class ${task.title.replace(/\s+/g, '')} {\n  // Implementation goes here\n}\n`;
      case '.tsx':
      case '.jsx':
        return `// ${task.title}\n// Generated by Agent: ${this.name}\n\nimport React from 'react';\n\nconst ${task.title.replace(/\s+/g, '')}: React.FC = () => {\n  return (\n    <div>\n      {/* Implementation goes here */}\n    </div>\n  );\n};\n\nexport default ${task.title.replace(/\s+/g, '')};\n`;
      case '.css':
        return `/* ${task.title} */\n/* Generated by Agent: ${this.name} */\n\n.container {\n  /* Styles go here */\n}\n`;
      case '.md':
        return `# ${task.title}\n\nGenerated by Agent: ${this.name}\n\n## Description\n\n${task.description}\n\n## Implementation\n\nTODO: Add implementation details\n`;
      default:
        return `${task.title}\nGenerated by Agent: ${this.name}\n\n${task.description}\n`;
    }
  }

  private applyBugFix(content: string, task: Task): string {
    // Simplified bug fix logic
    // In practice, this would involve sophisticated code analysis and patching
    return content + `\n// Bug fix applied by ${this.name} for: ${task.description}\n`;
  }

  private applyRefactoring(content: string, task: Task): string {
    // Simplified refactoring logic
    // In practice, this would involve AST manipulation and code transformation
    return content + `\n// Refactored by ${this.name}: ${task.description}\n`;
  }

  private generateCodeReview(content: string, fileName: string): string {
    // Simplified code review
    const lines = content.split('\n').length;
    const issues: string[] = [];
    
    if (lines > 500) {
      issues.push('- File is quite large, consider breaking it into smaller modules');
    }
    
    if (content.includes('console.log')) {
      issues.push('- Remove console.log statements before production');
    }
    
    if (content.includes('TODO') || content.includes('FIXME')) {
      issues.push('- Address TODO/FIXME comments');
    }

    return issues.length > 0 ? issues.join('\n') : '- Code looks good, no issues found';
  }

  private generateDocumentation(task: Task, fileName: string): string {
    return `# ${task.title}

**Generated by:** ${this.name} (${this.role})
**Date:** ${new Date().toISOString()}

## Overview

${task.description}

## Requirements

${task.requirements.map(req => `- ${req.description}`).join('\n')}

## Implementation Notes

This documentation was automatically generated as part of task ${task.id}.

## Next Steps

- Review the implementation
- Add additional details as needed
- Update with actual implementation specifics
`;
  }

  private generateCommitMessage(task: Task, output: string): string {
    const prefix = this.getCommitPrefix(task.type);
    const scope = this.role.toLowerCase();
    
    return `${prefix}(${scope}): ${task.title}

${task.description}

Agent: ${this.name} (${this.id})
Task ID: ${task.id}
Files changed: ${task.files?.length || 0}

${output}`;
  }

  private getCommitPrefix(taskType: TaskType): string {
    switch (taskType) {
      case TaskType.FEATURE:
        return 'feat';
      case TaskType.BUG_FIX:
        return 'fix';
      case TaskType.REFACTOR:
        return 'refactor';
      case TaskType.DOCUMENTATION:
        return 'docs';
      case TaskType.TEST:
        return 'test';
      default:
        return 'chore';
    }
  }
}