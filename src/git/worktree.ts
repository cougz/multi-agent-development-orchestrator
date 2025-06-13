import * as path from 'path';
import * as fs from 'fs';
import { WorktreeInfo, GitOperationResult } from '../types/git.types';
import { GitRepository } from './repository';
import { logger } from '@core/logger';
import { eventBus, createGitEvent, SystemEvent } from '@core/events';

export class WorktreeManager {
  private mainRepository: GitRepository;
  private worktrees: Map<string, WorktreeInfo> = new Map();
  private baseWorkingDirectory: string;

  constructor(mainRepository: GitRepository, baseWorkingDirectory: string) {
    this.mainRepository = mainRepository;
    this.baseWorkingDirectory = baseWorkingDirectory;
  }

  public async initialize(): Promise<void> {
    try {
      await this.discoverExistingWorktrees();
      await this.cleanupStaleWorktrees();
      logger.info('Worktree manager initialized');
    } catch (error) {
      logger.error('Failed to initialize worktree manager', error);
      throw error;
    }
  }

  public async createWorktreeForAgent(
    agentId: string, 
    branchName?: string
  ): Promise<WorktreeInfo> {
    try {
      // Generate branch name if not provided
      const finalBranchName = branchName || `agent-${agentId}-${Date.now()}`;
      
      // Create unique worktree path
      const worktreePath = this.generateWorktreePath(agentId);
      
      // Ensure the worktree directory doesn't exist
      if (fs.existsSync(worktreePath)) {
        await this.removeWorktreeDirectory(worktreePath);
      }

      // Create the branch first if it doesn't exist
      await this.ensureBranchExists(finalBranchName);

      // Create the worktree
      const result = await this.createWorktreeDirectory(worktreePath, finalBranchName);
      
      if (!result.success) {
        throw new Error(`Failed to create worktree: ${result.error}`);
      }

      const worktreeInfo: WorktreeInfo = {
        id: agentId,
        path: worktreePath,
        branch: finalBranchName,
        agentId,
        status: 'active',
        lastActivity: new Date()
      };

      this.worktrees.set(agentId, worktreeInfo);

      eventBus.emit(createGitEvent(
        SystemEvent.SYSTEM_STARTED,
        worktreePath,
        { agentId, worktreeCreated: true },
        finalBranchName
      ));

      logger.info(`Created worktree for agent ${agentId}`, {
        path: worktreePath,
        branch: finalBranchName
      });

      return worktreeInfo;
    } catch (error) {
      logger.error(`Failed to create worktree for agent ${agentId}`, error);
      throw error;
    }
  }

  public async removeWorktreeForAgent(agentId: string): Promise<GitOperationResult> {
    const startTime = Date.now();
    
    try {
      const worktree = this.worktrees.get(agentId);
      
      if (!worktree) {
        return {
          success: false,
          error: `No worktree found for agent ${agentId}`,
          duration: Date.now() - startTime
        };
      }

      // Remove the worktree directory
      const result = await this.removeWorktreeDirectory(worktree.path);
      
      if (result.success) {
        this.worktrees.delete(agentId);
        
        eventBus.emit(createGitEvent(
          SystemEvent.SYSTEM_STOPPED,
          worktree.path,
          { agentId, worktreeRemoved: true },
          worktree.branch
        ));

        logger.info(`Removed worktree for agent ${agentId}`, {
          path: worktree.path,
          branch: worktree.branch
        });
      }

      return {
        ...result,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  public getWorktreeForAgent(agentId: string): WorktreeInfo | undefined {
    return this.worktrees.get(agentId);
  }

  public getAllWorktrees(): WorktreeInfo[] {
    return Array.from(this.worktrees.values());
  }

  public getActiveWorktrees(): WorktreeInfo[] {
    return this.getAllWorktrees().filter(wt => wt.status === 'active');
  }

  public async updateWorktreeActivity(agentId: string): Promise<void> {
    const worktree = this.worktrees.get(agentId);
    if (worktree) {
      worktree.lastActivity = new Date();
      this.worktrees.set(agentId, worktree);
    }
  }

  public async switchWorktreeBranch(
    agentId: string, 
    newBranch: string
  ): Promise<GitOperationResult> {
    const startTime = Date.now();
    
    try {
      const worktree = this.worktrees.get(agentId);
      
      if (!worktree) {
        return {
          success: false,
          error: `No worktree found for agent ${agentId}`,
          duration: Date.now() - startTime
        };
      }

      // Create a git instance for this worktree
      const simpleGit = (await import('simple-git')).default;
      const git = simpleGit(worktree.path);
      
      // Ensure the branch exists
      await this.ensureBranchExists(newBranch);
      
      // Switch to the new branch
      await git.checkout(newBranch);
      
      // Update worktree info
      worktree.branch = newBranch;
      worktree.lastActivity = new Date();
      this.worktrees.set(agentId, worktree);

      logger.info(`Switched worktree branch for agent ${agentId}`, {
        path: worktree.path,
        newBranch
      });

      return {
        success: true,
        output: `Switched to branch ${newBranch}`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  public async cleanupStaleWorktrees(): Promise<void> {
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
    const now = new Date();

    for (const [agentId, worktree] of this.worktrees.entries()) {
      const timeSinceLastActivity = now.getTime() - worktree.lastActivity.getTime();
      
      if (timeSinceLastActivity > staleThreshold) {
        logger.warn(`Cleaning up stale worktree for agent ${agentId}`, {
          path: worktree.path,
          lastActivity: worktree.lastActivity
        });

        try {
          await this.removeWorktreeForAgent(agentId);
        } catch (error) {
          logger.error(`Failed to cleanup stale worktree for agent ${agentId}`, error);
          // Mark as corrupted instead of removing from map
          worktree.status = 'corrupted';
          this.worktrees.set(agentId, worktree);
        }
      }
    }
  }

  public async syncWorktreeWithMain(agentId: string): Promise<GitOperationResult> {
    const startTime = Date.now();
    
    try {
      const worktree = this.worktrees.get(agentId);
      
      if (!worktree) {
        return {
          success: false,
          error: `No worktree found for agent ${agentId}`,
          duration: Date.now() - startTime
        };
      }

      const simpleGit = (await import('simple-git')).default;
      const git = simpleGit(worktree.path);
      
      // Fetch latest changes
      await git.fetch('origin');
      
      // Get the default branch (usually main or master)
      const branches = await git.branch();
      const defaultBranch = 'main'; // This could be configurable
      
      // Merge or rebase with the default branch
      await git.merge([`origin/${defaultBranch}`]);

      worktree.lastActivity = new Date();
      this.worktrees.set(agentId, worktree);

      logger.info(`Synced worktree with main for agent ${agentId}`, {
        path: worktree.path,
        branch: worktree.branch
      });

      return {
        success: true,
        output: `Synced with ${defaultBranch}`,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  private generateWorktreePath(agentId: string): string {
    const worktreeDir = path.join(this.baseWorkingDirectory, 'worktrees');
    
    // Ensure worktrees directory exists
    if (!fs.existsSync(worktreeDir)) {
      fs.mkdirSync(worktreeDir, { recursive: true });
    }

    return path.join(worktreeDir, `agent-${agentId}`);
  }

  private async ensureBranchExists(branchName: string): Promise<void> {
    try {
      const branches = await this.mainRepository.getBranches();
      const branchExists = branches.some(b => b.name === branchName);
      
      if (!branchExists) {
        await this.mainRepository.createBranch(branchName);
      }
    } catch (error) {
      logger.error(`Failed to ensure branch exists: ${branchName}`, error);
      throw error;
    }
  }

  private async createWorktreeDirectory(
    worktreePath: string, 
    branchName: string
  ): Promise<GitOperationResult> {
    try {
      const simpleGit = (await import('simple-git')).default;
      const mainGit = simpleGit(this.baseWorkingDirectory);
      
      await mainGit.raw(['worktree', 'add', worktreePath, branchName]);
      
      return {
        success: true,
        output: `Worktree created at ${worktreePath}`,
        duration: 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: 0
      };
    }
  }

  private async removeWorktreeDirectory(worktreePath: string): Promise<GitOperationResult> {
    try {
      const simpleGit = (await import('simple-git')).default;
      const mainGit = simpleGit(this.baseWorkingDirectory);
      
      // Try to remove using git worktree remove
      try {
        await mainGit.raw(['worktree', 'remove', worktreePath, '--force']);
      } catch (gitError) {
        // If git command fails, try manual removal
        if (fs.existsSync(worktreePath)) {
          await fs.promises.rm(worktreePath, { recursive: true, force: true });
        }
      }
      
      return {
        success: true,
        output: `Worktree removed from ${worktreePath}`,
        duration: 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: 0
      };
    }
  }

  private async discoverExistingWorktrees(): Promise<void> {
    try {
      const simpleGit = (await import('simple-git')).default;
      const mainGit = simpleGit(this.baseWorkingDirectory);
      
      const worktreeList = await mainGit.raw(['worktree', 'list', '--porcelain']);
      const lines = worktreeList.split('\n');
      
      let currentWorktree: Partial<WorktreeInfo> = {};
      
      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          const worktreePath = line.substring(9);
          
          // Extract agent ID from path if it follows our naming convention
          const pathParts = worktreePath.split(path.sep);
          const dirName = pathParts[pathParts.length - 1];
          
          if (dirName.startsWith('agent-')) {
            const agentId = dirName.substring(6);
            currentWorktree = {
              id: agentId,
              path: worktreePath,
              agentId,
              status: 'active',
              lastActivity: new Date()
            };
          }
        } else if (line.startsWith('branch ') && currentWorktree.id) {
          currentWorktree.branch = line.substring(7);
          
          if (currentWorktree.id && currentWorktree.path && currentWorktree.branch) {
            this.worktrees.set(currentWorktree.id, currentWorktree as WorktreeInfo);
            logger.debug(`Discovered existing worktree for agent ${currentWorktree.id}`, {
              path: currentWorktree.path,
              branch: currentWorktree.branch
            });
          }
          
          currentWorktree = {};
        }
      }
    } catch (error) {
      // It's okay if this fails - might be no existing worktrees
      logger.debug('No existing worktrees found or failed to discover them', error);
    }
  }

  public async getWorktreeStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    corrupted: number;
  }> {
    const worktrees = this.getAllWorktrees();
    
    return {
      total: worktrees.length,
      active: worktrees.filter(wt => wt.status === 'active').length,
      inactive: worktrees.filter(wt => wt.status === 'inactive').length,
      corrupted: worktrees.filter(wt => wt.status === 'corrupted').length
    };
  }

  public async cleanup(): Promise<void> {
    try {
      // Clean up all managed worktrees
      const removePromises = Array.from(this.worktrees.keys()).map(agentId =>
        this.removeWorktreeForAgent(agentId)
      );
      
      await Promise.all(removePromises);
      
      logger.info('Worktree manager cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup worktree manager', error);
    }
  }
}