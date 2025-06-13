export interface CommitInfo {
  hash: string;
  author: string;
  date: Date;
  message: string;
  files: string[];
  insertions: number;
  deletions: number;
  branch: string;
  agentId?: string;
}

export interface BranchInfo {
  name: string;
  current: boolean;
  remote?: string;
  ahead: number;
  behind: number;
  lastCommit: CommitInfo;
  agentId?: string;
}

export interface ConflictInfo {
  file: string;
  type: 'merge' | 'rebase' | 'cherry-pick';
  sections: ConflictSection[];
  severity: 'low' | 'medium' | 'high';
  autoResolvable: boolean;
}

export interface ConflictSection {
  startLine: number;
  endLine: number;
  ours: string;
  theirs: string;
  base?: string;
}

export interface CodeMetrics {
  linesOfCode: number;
  complexity: number;
  testCoverage: number;
  duplicatedLines: number;
  technicalDebt: number; // in hours
  maintainabilityIndex: number; // 0-100
  qualityGate: 'passed' | 'failed';
}

export interface GitAnalysis {
  commits: CommitInfo[];
  branches: BranchInfo[];
  conflicts: ConflictInfo[];
  metrics: CodeMetrics;
  recommendations: string[];
  agentActivity: AgentActivitySummary[];
}

export interface AgentActivitySummary {
  agentId: string;
  commits: number;
  linesAdded: number;
  linesRemoved: number;
  filesModified: number;
  averageCommitSize: number;
  frequency: number; // commits per day
}

export interface WorktreeInfo {
  id: string;
  path: string;
  branch: string;
  agentId: string;
  status: 'active' | 'inactive' | 'corrupted';
  lastActivity: Date;
}

export interface GitOperationResult {
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}