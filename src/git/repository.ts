import simpleGit, { SimpleGit, StatusResult, LogResult, DiffResult } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';
import { 
  GitAnalysis, 
  CommitInfo, 
  BranchInfo, 
  ConflictInfo, 
  CodeMetrics, 
  GitOperationResult,
  WorktreeInfo 
} from '../types/git.types';
import { logger } from '@core/logger';
import { eventBus, createGitEvent, SystemEvent } from '@core/events';

export class GitRepository {
  private git: SimpleGit;
  private repositoryPath: string;
  private worktrees: Map<string, WorktreeInfo> = new Map();

  constructor(repositoryPath: string) {
    this.repositoryPath = repositoryPath;
    this.git = simpleGit(repositoryPath);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Setup git hooks for event emission
    this.setupGitHooks();
  }

  private setupGitHooks(): void {
    const hooksDir = path.join(this.repositoryPath, '.git', 'hooks');
    
    if (fs.existsSync(hooksDir)) {
      // Create post-commit hook for event emission
      const postCommitHook = `#!/bin/sh
# MADO Orchestrator post-commit hook
echo "Commit event triggered by MADO" >> .git/mado-events.log
`;
      
      const hookPath = path.join(hooksDir, 'post-commit');
      if (!fs.existsSync(hookPath)) {
        fs.writeFileSync(hookPath, postCommitHook);
        fs.chmodSync(hookPath, 0o755);
      }
    }
  }

  public async initialize(): Promise<void> {
    try {
      const isRepo = await this.git.checkIsRepo();
      
      if (!isRepo) {
        await this.git.init();
        logger.info(`Initialized git repository at ${this.repositoryPath}`);
        
        eventBus.emit(createGitEvent(
          SystemEvent.SYSTEM_STARTED,
          this.repositoryPath,
          { message: 'Repository initialized' }
        ));
      }

      await this.loadWorktrees();
    } catch (error) {
      logger.error('Failed to initialize git repository', error);
      throw error;
    }
  }

  public async createBranch(branchName: string, baseBranch?: string): Promise<GitOperationResult> {
    const startTime = Date.now();
    
    try {
      if (baseBranch) {
        await this.git.checkoutBranch(branchName, baseBranch);
      } else {
        await this.git.checkoutLocalBranch(branchName);
      }

      const duration = Date.now() - startTime;
      
      eventBus.emit(createGitEvent(
        SystemEvent.GIT_BRANCH_CREATED,
        this.repositoryPath,
        { branchName, baseBranch },
        branchName
      ));

      logger.info(`Created branch: ${branchName}`, { baseBranch, duration });

      return {
        success: true,
        output: `Branch ${branchName} created successfully`,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to create branch: ${branchName}`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration
      };
    }
  }

  public async switchBranch(branchName: string): Promise<GitOperationResult> {
    const startTime = Date.now();
    
    try {
      await this.git.checkout(branchName);
      const duration = Date.now() - startTime;
      
      logger.info(`Switched to branch: ${branchName}`, { duration });

      return {
        success: true,
        output: `Switched to branch ${branchName}`,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to switch to branch: ${branchName}`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration
      };
    }
  }

  public async commit(message: string, files?: string[]): Promise<GitOperationResult> {
    const startTime = Date.now();
    
    try {
      if (files && files.length > 0) {
        await this.git.add(files);
      } else {
        await this.git.add('.');
      }

      const result = await this.git.commit(message);
      const duration = Date.now() - startTime;

      eventBus.emit(createGitEvent(
        SystemEvent.GIT_COMMIT,
        this.repositoryPath,
        { message, files: files || ['all'], commit: result.commit },
        undefined,
        result.commit
      ));

      logger.info(`Committed changes: ${message}`, { commit: result.commit, duration });

      return {
        success: true,
        output: `Committed: ${result.commit}`,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to commit: ${message}`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration
      };
    }
  }

  public async mergeBranch(branchName: string, strategy?: string): Promise<GitOperationResult> {
    const startTime = Date.now();
    
    try {
      const mergeOptions = strategy ? ['--strategy', strategy] : [];
      await this.git.merge([branchName, ...mergeOptions]);
      const duration = Date.now() - startTime;

      eventBus.emit(createGitEvent(
        SystemEvent.GIT_MERGE,
        this.repositoryPath,
        { branchName, strategy },
        branchName
      ));

      logger.info(`Merged branch: ${branchName}`, { strategy, duration });

      return {
        success: true,
        output: `Merged branch ${branchName}`,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to merge branch: ${branchName}`, error);

      // Check if it's a merge conflict
      const status = await this.getStatus();
      if (status.conflicted.length > 0) {
        eventBus.emit(createGitEvent(
          SystemEvent.GIT_CONFLICT,
          this.repositoryPath,
          { branchName, conflicts: status.conflicted },
          branchName
        ));
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration
      };
    }
  }

  public async getStatus(): Promise<StatusResult> {
    try {
      return await this.git.status();
    } catch (error) {
      logger.error('Failed to get git status', error);
      throw error;
    }
  }

  public async getBranches(): Promise<BranchInfo[]> {
    try {
      const branches = await this.git.branch();
      const branchInfos: BranchInfo[] = [];

      for (const branch of branches.all) {
        if (branch.startsWith('remotes/')) continue;

        const log = await this.git.log({ from: branch, maxCount: 1 });
        const latest = log.latest;

        branchInfos.push({
          name: branch,
          current: branch === branches.current,
          ahead: 0, // TODO: Calculate ahead/behind
          behind: 0,
          lastCommit: latest ? {
            hash: latest.hash,
            author: latest.author_name,
            date: new Date(latest.date),
            message: latest.message,
            files: [],
            insertions: 0,
            deletions: 0,
            branch: branch
          } : {} as CommitInfo
        });
      }

      return branchInfos;
    } catch (error) {
      logger.error('Failed to get branches', error);
      throw error;
    }
  }

  public async getCommitHistory(options?: {
    branch?: string;
    maxCount?: number;
    since?: Date;
    author?: string;
  }): Promise<CommitInfo[]> {
    try {
      const logOptions: any = {};
      
      if (options?.branch) logOptions.from = options.branch;
      if (options?.maxCount) logOptions.maxCount = options.maxCount;
      if (options?.since) logOptions.since = options.since.toISOString();
      if (options?.author) logOptions.author = options.author;

      const log = await this.git.log(logOptions);
      
      const commits: CommitInfo[] = [];
      for (const commit of log.all) {
        const diffStat = await this.git.diffSummary([`${commit.hash}~1`, commit.hash]);
        
        commits.push({
          hash: commit.hash,
          author: commit.author_name,
          date: new Date(commit.date),
          message: commit.message,
          files: diffStat.files.map(f => f.file),
          insertions: diffStat.insertions,
          deletions: diffStat.deletions,
          branch: options?.branch || 'current'
        });
      }

      return commits;
    } catch (error) {
      logger.error('Failed to get commit history', error);
      throw error;
    }
  }

  public async analyzeRepository(): Promise<GitAnalysis> {
    try {
      const [commits, branches, status] = await Promise.all([
        this.getCommitHistory({ maxCount: 100 }),
        this.getBranches(),
        this.getStatus()
      ]);

      const conflicts: ConflictInfo[] = [];
      if (status.conflicted.length > 0) {
        for (const file of status.conflicted) {
          conflicts.push({
            file,
            type: 'merge',
            sections: [], // TODO: Parse conflict sections
            severity: 'medium',
            autoResolvable: false
          });
        }
      }

      const metrics = await this.calculateCodeMetrics();
      const agentActivity = this.analyzeAgentActivity(commits);

      return {
        commits,
        branches,
        conflicts,
        metrics,
        recommendations: this.generateRecommendations(commits, branches, conflicts),
        agentActivity
      };
    } catch (error) {
      logger.error('Failed to analyze repository', error);
      throw error;
    }
  }

  private async calculateCodeMetrics(): Promise<CodeMetrics> {
    // Basic implementation - can be enhanced with external tools
    try {
      const log = await this.git.log({ maxCount: 10 });
      
      return {
        linesOfCode: 0, // TODO: Implement with cloc or similar
        complexity: 0, // TODO: Implement with complexity analysis
        testCoverage: 0, // TODO: Integrate with coverage tools
        duplicatedLines: 0, // TODO: Implement duplication detection
        technicalDebt: 0, // TODO: Calculate based on code smells
        maintainabilityIndex: 85, // Default good score
        qualityGate: 'passed'
      };
    } catch (error) {
      logger.error('Failed to calculate code metrics', error);
      return {
        linesOfCode: 0,
        complexity: 0,
        testCoverage: 0,
        duplicatedLines: 0,
        technicalDebt: 0,
        maintainabilityIndex: 0,
        qualityGate: 'failed'
      };
    }
  }

  private analyzeAgentActivity(commits: CommitInfo[]): any[] {
    const agentMap = new Map<string, any>();
    
    commits.forEach(commit => {
      if (commit.agentId) {
        const existing = agentMap.get(commit.agentId) || {
          agentId: commit.agentId,
          commits: 0,
          linesAdded: 0,
          linesRemoved: 0,
          filesModified: 0
        };

        existing.commits++;
        existing.linesAdded += commit.insertions;
        existing.linesRemoved += commit.deletions;
        existing.filesModified += commit.files.length;

        agentMap.set(commit.agentId, existing);
      }
    });

    return Array.from(agentMap.values()).map(agent => ({
      ...agent,
      averageCommitSize: agent.commits > 0 ? (agent.linesAdded + agent.linesRemoved) / agent.commits : 0,
      frequency: agent.commits / 7 // commits per week (assuming 7 day period)
    }));
  }

  private generateRecommendations(
    commits: CommitInfo[],
    branches: BranchInfo[],
    conflicts: ConflictInfo[]
  ): string[] {
    const recommendations: string[] = [];

    // Analyze commit patterns
    if (commits.length > 0) {
      const avgCommitSize = commits.reduce((sum, c) => sum + c.insertions + c.deletions, 0) / commits.length;
      if (avgCommitSize > 500) {
        recommendations.push('Consider making smaller, more focused commits');
      }
    }

    // Analyze branch structure
    if (branches.length > 10) {
      recommendations.push('Consider cleaning up old branches');
    }

    // Analyze conflicts
    if (conflicts.length > 0) {
      recommendations.push(`Resolve ${conflicts.length} merge conflicts before proceeding`);
    }

    return recommendations;
  }

  private async loadWorktrees(): Promise<void> {
    try {
      // Implementation for loading existing worktrees
      // This would scan for existing worktrees and update the worktrees map
      logger.debug('Loading existing worktrees');
    } catch (error) {
      logger.error('Failed to load worktrees', error);
    }
  }

  public async createWorktree(agentId: string, branchName: string): Promise<WorktreeInfo> {
    const worktreePath = path.join(this.repositoryPath, '..', `worktree-${agentId}`);
    
    try {
      await this.git.raw(['worktree', 'add', worktreePath, branchName]);
      
      const worktreeInfo: WorktreeInfo = {
        id: agentId,
        path: worktreePath,
        branch: branchName,
        agentId,
        status: 'active',
        lastActivity: new Date()
      };

      this.worktrees.set(agentId, worktreeInfo);
      logger.info(`Created worktree for agent ${agentId}`, { worktreePath, branchName });

      return worktreeInfo;
    } catch (error) {
      logger.error(`Failed to create worktree for agent ${agentId}`, error);
      throw error;
    }
  }

  public async removeWorktree(agentId: string): Promise<void> {
    const worktree = this.worktrees.get(agentId);
    if (!worktree) {
      throw new Error(`No worktree found for agent ${agentId}`);
    }

    try {
      await this.git.raw(['worktree', 'remove', worktree.path]);
      this.worktrees.delete(agentId);
      logger.info(`Removed worktree for agent ${agentId}`, { path: worktree.path });
    } catch (error) {
      logger.error(`Failed to remove worktree for agent ${agentId}`, error);
      throw error;
    }
  }

  public getWorktree(agentId: string): WorktreeInfo | undefined {
    return this.worktrees.get(agentId);
  }

  public getAllWorktrees(): WorktreeInfo[] {
    return Array.from(this.worktrees.values());
  }

  public async cleanup(): Promise<void> {
    try {
      // Cleanup any temporary files, hooks, etc.
      logger.info('Cleaning up git repository resources');
    } catch (error) {
      logger.error('Failed to cleanup git repository', error);
    }
  }
}