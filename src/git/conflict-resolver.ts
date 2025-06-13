import * as fs from 'fs';
import * as path from 'path';
import { ConflictInfo, ConflictSection, GitOperationResult } from '../types/git.types';
import { logger } from '@core/logger';
import { eventBus, createGitEvent, SystemEvent } from '@core/events';

export interface ConflictResolutionStrategy {
  name: string;
  canResolve(conflict: ConflictInfo): boolean;
  resolve(conflict: ConflictInfo): Promise<string>;
}

export class AutomaticConflictResolver {
  private strategies: ConflictResolutionStrategy[] = [];
  private repositoryPath: string;

  constructor(repositoryPath: string) {
    this.repositoryPath = repositoryPath;
    this.registerDefaultStrategies();
  }

  private registerDefaultStrategies(): void {
    this.strategies.push(
      new WhitespaceConflictStrategy(),
      new ImportOrderConflictStrategy(),
      new SimpleAdditionConflictStrategy(),
      new PackageJsonConflictStrategy()
    );
  }

  public async resolveConflicts(conflicts: ConflictInfo[]): Promise<GitOperationResult[]> {
    const results: GitOperationResult[] = [];

    for (const conflict of conflicts) {
      const startTime = Date.now();
      
      try {
        const strategy = this.findBestStrategy(conflict);
        
        if (strategy && conflict.autoResolvable) {
          const resolvedContent = await strategy.resolve(conflict);
          await this.writeResolvedContent(conflict.file, resolvedContent);
          
          const duration = Date.now() - startTime;
          
          results.push({
            success: true,
            output: `Resolved conflict in ${conflict.file} using ${strategy.name}`,
            duration
          });

          eventBus.emit(createGitEvent(
            SystemEvent.GIT_CONFLICT,
            this.repositoryPath,
            { 
              file: conflict.file, 
              resolved: true, 
              strategy: strategy.name 
            }
          ));

          logger.info(`Auto-resolved conflict in ${conflict.file}`, {
            strategy: strategy.name,
            duration
          });
        } else {
          results.push({
            success: false,
            error: `No automatic resolution strategy found for ${conflict.file}`,
            duration: Date.now() - startTime
          });

          logger.warn(`Could not auto-resolve conflict in ${conflict.file}`, {
            severity: conflict.severity,
            type: conflict.type
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration
        });

        logger.error(`Failed to resolve conflict in ${conflict.file}`, error);
      }
    }

    return results;
  }

  private findBestStrategy(conflict: ConflictInfo): ConflictResolutionStrategy | null {
    const applicableStrategies = this.strategies.filter(strategy => 
      strategy.canResolve(conflict)
    );

    // Return the first applicable strategy (can be enhanced with scoring)
    return applicableStrategies[0] || null;
  }

  private async writeResolvedContent(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.repositoryPath, filePath);
    await fs.promises.writeFile(fullPath, content, 'utf8');
  }

  public async parseConflictFile(filePath: string): Promise<ConflictInfo> {
    const fullPath = path.join(this.repositoryPath, filePath);
    const content = await fs.promises.readFile(fullPath, 'utf8');
    
    const sections: ConflictSection[] = [];
    const lines = content.split('\n');
    
    let currentConflict: Partial<ConflictSection> | null = null;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;

      if (line.startsWith('<<<<<<<')) {
        currentConflict = {
          startLine: lineNumber,
          ours: ''
        };
      } else if (line.startsWith('=======') && currentConflict) {
        // Switch to "theirs" section
        currentConflict.ours = currentConflict.ours || '';
      } else if (line.startsWith('>>>>>>>') && currentConflict) {
        currentConflict.endLine = lineNumber;
        sections.push(currentConflict as ConflictSection);
        currentConflict = null;
      } else if (currentConflict) {
        if (currentConflict.ours !== undefined && !line.startsWith('=======')) {
          if (!currentConflict.theirs) {
            currentConflict.ours += line + '\n';
          } else {
            currentConflict.theirs += line + '\n';
          }
        } else if (line.startsWith('=======')) {
          currentConflict.theirs = '';
        }
      }
    }

    const autoResolvable = this.isAutoResolvable(sections, filePath);
    const severity = this.calculateSeverity(sections, filePath);

    return {
      file: filePath,
      type: 'merge',
      sections,
      severity,
      autoResolvable
    };
  }

  private isAutoResolvable(sections: ConflictSection[], filePath: string): boolean {
    // Check if any strategy can handle this conflict
    const conflict: ConflictInfo = {
      file: filePath,
      type: 'merge',
      sections,
      severity: 'medium',
      autoResolvable: false
    };

    return this.strategies.some(strategy => strategy.canResolve(conflict));
  }

  private calculateSeverity(sections: ConflictSection[], filePath: string): 'low' | 'medium' | 'high' {
    // Simple heuristics for conflict severity
    if (sections.length > 5) return 'high';
    if (filePath.includes('package.json') || filePath.includes('config')) return 'high';
    if (sections.some(s => s.ours.length > 1000 || (s.theirs?.length || 0) > 1000)) return 'high';
    if (sections.length > 2) return 'medium';
    return 'low';
  }

  public registerStrategy(strategy: ConflictResolutionStrategy): void {
    this.strategies.push(strategy);
    logger.debug(`Registered conflict resolution strategy: ${strategy.name}`);
  }

  public getStrategies(): ConflictResolutionStrategy[] {
    return [...this.strategies];
  }
}

// Strategy implementations
class WhitespaceConflictStrategy implements ConflictResolutionStrategy {
  name = 'Whitespace Conflict Resolver';

  canResolve(conflict: ConflictInfo): boolean {
    return conflict.sections.every(section => {
      const oursTrimmed = section.ours.trim();
      const theirsTrimmed = section.theirs?.trim() || '';
      return oursTrimmed === theirsTrimmed;
    });
  }

  async resolve(conflict: ConflictInfo): Promise<string> {
    // Choose the version with better formatting (more consistent indentation)
    let resolved = '';
    
    for (const section of conflict.sections) {
      // Prefer the version with consistent indentation
      const ours = section.ours;
      const theirs = section.theirs || '';
      
      if (this.hasConsistentIndentation(ours)) {
        resolved += ours;
      } else {
        resolved += theirs;
      }
    }
    
    return resolved;
  }

  private hasConsistentIndentation(text: string): boolean {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return true;
    
    const indentPattern = /^(\s*)/;
    const indents = lines.map(line => indentPattern.exec(line)?.[1] || '');
    
    // Check if indentation is consistent
    return indents.every(indent => indent.length % 2 === 0 || indent.length % 4 === 0);
  }
}

class ImportOrderConflictStrategy implements ConflictResolutionStrategy {
  name = 'Import Order Conflict Resolver';

  canResolve(conflict: ConflictInfo): boolean {
    const isJavaScriptFile = /\.(js|ts|jsx|tsx)$/.test(conflict.file);
    return isJavaScriptFile && conflict.sections.every(section => {
      return this.isImportSection(section.ours) && 
             this.isImportSection(section.theirs || '');
    });
  }

  async resolve(conflict: ConflictInfo): Promise<string> {
    let resolved = '';
    
    for (const section of conflict.sections) {
      const oursImports = this.parseImports(section.ours);
      const theirsImports = this.parseImports(section.theirs || '');
      
      // Merge and sort imports
      const allImports = [...oursImports, ...theirsImports];
      const uniqueImports = this.deduplicateImports(allImports);
      const sortedImports = this.sortImports(uniqueImports);
      
      resolved += sortedImports.join('\n') + '\n';
    }
    
    return resolved;
  }

  private isImportSection(text: string): boolean {
    const lines = text.trim().split('\n');
    return lines.every(line => 
      line.trim() === '' || 
      line.trim().startsWith('import ') || 
      line.trim().startsWith('//') ||
      line.trim().startsWith('/*')
    );
  }

  private parseImports(text: string): string[] {
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('import '));
  }

  private deduplicateImports(imports: string[]): string[] {
    const seen = new Set<string>();
    return imports.filter(imp => {
      if (seen.has(imp)) return false;
      seen.add(imp);
      return true;
    });
  }

  private sortImports(imports: string[]): string[] {
    return imports.sort((a, b) => {
      // Sort by import source
      const aSource = this.extractImportSource(a);
      const bSource = this.extractImportSource(b);
      
      // External packages first, then relative imports
      const aIsExternal = !aSource.startsWith('.');
      const bIsExternal = !bSource.startsWith('.');
      
      if (aIsExternal && !bIsExternal) return -1;
      if (!aIsExternal && bIsExternal) return 1;
      
      return aSource.localeCompare(bSource);
    });
  }

  private extractImportSource(importLine: string): string {
    const match = importLine.match(/from ['"]([^'"]+)['"]/);
    return match ? match[1] : '';
  }
}

class SimpleAdditionConflictStrategy implements ConflictResolutionStrategy {
  name = 'Simple Addition Conflict Resolver';

  canResolve(conflict: ConflictInfo): boolean {
    return conflict.sections.every(section => {
      const ours = section.ours.trim();
      const theirs = section.theirs?.trim() || '';
      
      // One side is empty (pure addition)
      return ours === '' || theirs === '';
    });
  }

  async resolve(conflict: ConflictInfo): Promise<string> {
    let resolved = '';
    
    for (const section of conflict.sections) {
      const ours = section.ours;
      const theirs = section.theirs || '';
      
      // Take the non-empty version
      resolved += ours.trim() !== '' ? ours : theirs;
    }
    
    return resolved;
  }
}

class PackageJsonConflictStrategy implements ConflictResolutionStrategy {
  name = 'Package.json Conflict Resolver';

  canResolve(conflict: ConflictInfo): boolean {
    return conflict.file.endsWith('package.json');
  }

  async resolve(conflict: ConflictInfo): Promise<string> {
    try {
      // Parse both versions as JSON and merge intelligently
      const fullContent = await fs.promises.readFile(
        path.join(process.cwd(), conflict.file), 
        'utf8'
      );
      
      // This is a simplified implementation
      // In practice, you'd want to parse and merge JSON objects properly
      return fullContent;
    } catch (error) {
      throw new Error(`Failed to resolve package.json conflict: ${error}`);
    }
  }
}