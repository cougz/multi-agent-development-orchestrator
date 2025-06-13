import { CommitInfo, AgentActivitySummary } from '../types/git.types';
import { logger } from '@core/logger';

export interface CommitPattern {
  type: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'test' | 'chore';
  confidence: number;
  indicators: string[];
}

export interface CommitQuality {
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
}

export interface AgentPerformance {
  agentId: string;
  productivity: number; // commits per day
  codeQuality: number; // average commit quality
  collaboration: number; // frequency of cross-agent interactions
  consistency: number; // regularity of commits
  impact: number; // size and importance of changes
}

export class CommitAnalyzer {
  private commitPatterns: Map<string, RegExp[]> = new Map();

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns(): void {
    this.commitPatterns.set('feature', [
      /^(feat|feature)(\(.+\))?\s*:\s*.+/i,
      /add(ed|s)?\s+.+/i,
      /implement(ed|s)?\s+.+/i,
      /create(d|s)?\s+.+/i,
      /new\s+.+/i
    ]);

    this.commitPatterns.set('bugfix', [
      /^(fix|bugfix)(\(.+\))?\s*:\s*.+/i,
      /fix(ed|es)?\s+.+/i,
      /resolve(d|s)?\s+.+/i,
      /correct(ed|s)?\s+.+/i,
      /bug\s+.+/i
    ]);

    this.commitPatterns.set('refactor', [
      /^refactor(\(.+\))?\s*:\s*.+/i,
      /refactor(ed|s)?\s+.+/i,
      /restructure(d|s)?\s+.+/i,
      /reorganize(d|s)?\s+.+/i,
      /cleanup\s+.+/i
    ]);

    this.commitPatterns.set('docs', [
      /^docs?(\(.+\))?\s*:\s*.+/i,
      /update(d|s)?\s+(readme|documentation|docs)/i,
      /add(ed|s)?\s+(readme|documentation|docs)/i,
      /document(ed|s)?\s+.+/i
    ]);

    this.commitPatterns.set('test', [
      /^test(\(.+\))?\s*:\s*.+/i,
      /add(ed|s)?\s+test/i,
      /test(ed|s|ing)?\s+.+/i,
      /spec(ification)?s?\s+.+/i
    ]);

    this.commitPatterns.set('chore', [
      /^chore(\(.+\))?\s*:\s*.+/i,
      /update(d|s)?\s+(dependencies|packages)/i,
      /bump\s+version/i,
      /maintenance/i,
      /housekeeping/i
    ]);
  }

  public analyzeCommit(commit: CommitInfo): {
    pattern: CommitPattern;
    quality: CommitQuality;
  } {
    const pattern = this.detectCommitPattern(commit);
    const quality = this.assessCommitQuality(commit);

    return { pattern, quality };
  }

  public analyzeCommitHistory(commits: CommitInfo[]): {
    patterns: Record<string, number>;
    qualityTrend: number[];
    agentPerformance: AgentPerformance[];
    insights: string[];
  } {
    const patterns: Record<string, number> = {};
    const qualityTrend: number[] = [];
    const agentMap = new Map<string, CommitInfo[]>();

    // Group commits by agent and analyze patterns
    commits.forEach(commit => {
      const analysis = this.analyzeCommit(commit);
      patterns[analysis.pattern.type] = (patterns[analysis.pattern.type] || 0) + 1;
      qualityTrend.push(analysis.quality.score);

      if (commit.agentId) {
        const agentCommits = agentMap.get(commit.agentId) || [];
        agentCommits.push(commit);
        agentMap.set(commit.agentId, agentCommits);
      }
    });

    const agentPerformance = Array.from(agentMap.entries()).map(([agentId, agentCommits]) =>
      this.analyzeAgentPerformance(agentId, agentCommits)
    );

    const insights = this.generateInsights(commits, patterns, agentPerformance);

    return {
      patterns,
      qualityTrend,
      agentPerformance,
      insights
    };
  }

  private detectCommitPattern(commit: CommitInfo): CommitPattern {
    const message = commit.message.toLowerCase();
    const indicators: string[] = [];
    let bestMatch: { type: string; confidence: number } = { type: 'chore', confidence: 0 };

    for (const [type, patterns] of this.commitPatterns.entries()) {
      let confidence = 0;
      const typeIndicators: string[] = [];

      for (const pattern of patterns) {
        if (pattern.test(commit.message)) {
          confidence += 0.3;
          typeIndicators.push(`Matches ${type} pattern`);
        }
      }

      // Additional heuristics based on files changed
      if (commit.files.some(file => file.endsWith('.test.js') || file.endsWith('.spec.ts'))) {
        if (type === 'test') confidence += 0.2;
        typeIndicators.push('Contains test files');
      }

      if (commit.files.some(file => file.includes('README') || file.endsWith('.md'))) {
        if (type === 'docs') confidence += 0.2;
        typeIndicators.push('Contains documentation files');
      }

      if (commit.files.some(file => file.includes('package.json') || file.includes('yarn.lock'))) {
        if (type === 'chore') confidence += 0.2;
        typeIndicators.push('Contains dependency files');
      }

      if (confidence > bestMatch.confidence) {
        bestMatch = { type, confidence };
        indicators.splice(0, indicators.length, ...typeIndicators);
      }
    }

    return {
      type: bestMatch.type as CommitPattern['type'],
      confidence: Math.min(bestMatch.confidence, 1.0),
      indicators
    };
  }

  private assessCommitQuality(commit: CommitInfo): CommitQuality {
    let score = 100;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Message quality checks
    if (commit.message.length < 10) {
      score -= 20;
      issues.push('Commit message too short');
      suggestions.push('Write more descriptive commit messages');
    }

    if (commit.message.length > 72) {
      score -= 10;
      issues.push('Commit message too long for first line');
      suggestions.push('Keep first line under 72 characters');
    }

    if (!/^[A-Z]/.test(commit.message) && !/^(feat|fix|docs|chore|test|refactor)/.test(commit.message)) {
      score -= 5;
      issues.push('Message should start with capital letter or conventional prefix');
    }

    // Change size checks
    const totalChanges = commit.insertions + commit.deletions;
    if (totalChanges > 1000) {
      score -= 15;
      issues.push('Very large commit - consider breaking into smaller changes');
    }

    if (totalChanges === 0) {
      score -= 30;
      issues.push('Empty commit with no changes');
    }

    // File diversity checks
    const fileTypes = new Set(commit.files.map(file => {
      const ext = file.split('.').pop();
      return ext || 'no-extension';
    }));

    if (fileTypes.size > 5) {
      score -= 10;
      issues.push('Commit touches many different file types');
      suggestions.push('Consider separating changes by file type or functionality');
    }

    // Timing checks (if we have previous commit data)
    // This would require additional context about previous commits

    return {
      score: Math.max(0, score),
      issues,
      suggestions
    };
  }

  private analyzeAgentPerformance(agentId: string, commits: CommitInfo[]): AgentPerformance {
    if (commits.length === 0) {
      return {
        agentId,
        productivity: 0,
        codeQuality: 0,
        collaboration: 0,
        consistency: 0,
        impact: 0
      };
    }

    // Calculate productivity (commits per day)
    const sortedCommits = commits.sort((a, b) => a.date.getTime() - b.date.getTime());
    const firstCommit = sortedCommits[0].date;
    const lastCommit = sortedCommits[sortedCommits.length - 1].date;
    const daysDiff = Math.max(1, (lastCommit.getTime() - firstCommit.getTime()) / (1000 * 60 * 60 * 24));
    const productivity = commits.length / daysDiff;

    // Calculate average code quality
    const qualityScores = commits.map(commit => this.assessCommitQuality(commit).score);
    const codeQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;

    // Calculate collaboration score (simplified - based on frequency)
    const collaboration = Math.min(100, productivity * 10); // Placeholder calculation

    // Calculate consistency (regularity of commits)
    const consistency = this.calculateConsistency(commits);

    // Calculate impact (average change size normalized)
    const totalChanges = commits.reduce((sum, commit) => sum + commit.insertions + commit.deletions, 0);
    const averageChange = totalChanges / commits.length;
    const impact = Math.min(100, averageChange / 10); // Normalize to 0-100

    return {
      agentId,
      productivity: Math.round(productivity * 100) / 100,
      codeQuality: Math.round(codeQuality),
      collaboration: Math.round(collaboration),
      consistency: Math.round(consistency),
      impact: Math.round(impact)
    };
  }

  private calculateConsistency(commits: CommitInfo[]): number {
    if (commits.length < 2) return 100;

    // Calculate standard deviation of time intervals between commits
    const intervals: number[] = [];
    for (let i = 1; i < commits.length; i++) {
      const interval = commits[i].date.getTime() - commits[i - 1].date.getTime();
      intervals.push(interval);
    }

    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Convert to consistency score (lower deviation = higher consistency)
    const normalizedStdDev = stdDev / (1000 * 60 * 60 * 24); // Normalize to days
    const consistency = Math.max(0, 100 - normalizedStdDev);

    return consistency;
  }

  private generateInsights(
    commits: CommitInfo[],
    patterns: Record<string, number>,
    agentPerformance: AgentPerformance[]
  ): string[] {
    const insights: string[] = [];

    // Pattern insights
    const totalCommits = commits.length;
    const featureCommits = patterns.feature || 0;
    const bugfixCommits = patterns.bugfix || 0;

    if (featureCommits / totalCommits > 0.6) {
      insights.push('High feature development activity detected');
    }

    if (bugfixCommits / totalCommits > 0.3) {
      insights.push('High bug fixing activity - consider reviewing code quality processes');
    }

    // Agent performance insights
    if (agentPerformance.length > 0) {
      const avgProductivity = agentPerformance.reduce((sum, ap) => sum + ap.productivity, 0) / agentPerformance.length;
      const avgQuality = agentPerformance.reduce((sum, ap) => sum + ap.codeQuality, 0) / agentPerformance.length;

      if (avgProductivity > 5) {
        insights.push('Team is highly productive with frequent commits');
      } else if (avgProductivity < 1) {
        insights.push('Low commit frequency - consider checking for blockers');
      }

      if (avgQuality > 80) {
        insights.push('High code quality standards being maintained');
      } else if (avgQuality < 60) {
        insights.push('Code quality concerns detected - consider additional reviews');
      }

      // Find top performer
      const topPerformer = agentPerformance.reduce((best, current) => 
        current.codeQuality > best.codeQuality ? current : best
      );
      insights.push(`Agent ${topPerformer.agentId} shows highest code quality (${topPerformer.codeQuality}%)`);
    }

    // Time-based insights
    const recentCommits = commits.filter(commit => {
      const daysSince = (Date.now() - commit.date.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    });

    if (recentCommits.length === 0) {
      insights.push('No recent activity in the past week');
    } else if (recentCommits.length > totalCommits * 0.5) {
      insights.push('Most development activity is recent - project is actively being worked on');
    }

    return insights;
  }

  public generateAgentActivitySummary(commits: CommitInfo[]): AgentActivitySummary[] {
    const agentMap = new Map<string, CommitInfo[]>();

    // Group commits by agent
    commits.forEach(commit => {
      if (commit.agentId) {
        const agentCommits = agentMap.get(commit.agentId) || [];
        agentCommits.push(commit);
        agentMap.set(commit.agentId, agentCommits);
      }
    });

    return Array.from(agentMap.entries()).map(([agentId, agentCommits]) => {
      const linesAdded = agentCommits.reduce((sum, commit) => sum + commit.insertions, 0);
      const linesRemoved = agentCommits.reduce((sum, commit) => sum + commit.deletions, 0);
      const filesModified = new Set(agentCommits.flatMap(commit => commit.files)).size;
      const averageCommitSize = agentCommits.length > 0 ? 
        (linesAdded + linesRemoved) / agentCommits.length : 0;

      // Calculate frequency (commits per day over the active period)
      const sortedCommits = agentCommits.sort((a, b) => a.date.getTime() - b.date.getTime());
      const firstCommit = sortedCommits[0]?.date;
      const lastCommit = sortedCommits[sortedCommits.length - 1]?.date;
      const daysDiff = firstCommit && lastCommit ? 
        Math.max(1, (lastCommit.getTime() - firstCommit.getTime()) / (1000 * 60 * 60 * 24)) : 1;
      const frequency = agentCommits.length / daysDiff;

      return {
        agentId,
        commits: agentCommits.length,
        linesAdded,
        linesRemoved,
        filesModified,
        averageCommitSize: Math.round(averageCommitSize * 100) / 100,
        frequency: Math.round(frequency * 100) / 100
      };
    });
  }
}