import { ConfigManager } from '../../../src/core/config';
import { AgentRole } from '../../../src/types/agent.types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let tempConfigPath: string;

  beforeEach(() => {
    tempConfigPath = path.join(__dirname, 'test-config.json');
    configManager = new ConfigManager(tempConfigPath);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('createDefaultConfig', () => {
    it('should create a valid default configuration', () => {
      const defaultConfig = configManager.createDefaultConfig();

      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.project.name).toBe('MADO Project');
      expect(defaultConfig.agents.defaultRoles).toContain(AgentRole.FRONTEND);
      expect(defaultConfig.agents.defaultRoles).toContain(AgentRole.BACKEND);
      expect(defaultConfig.agents.defaultRoles).toContain(AgentRole.QA);
      expect(defaultConfig.git.provider).toBe('local');
      expect(defaultConfig.messaging.broker).toBe('memory');
    });

    it('should create configuration that passes validation', async () => {
      const defaultConfig = configManager.createDefaultConfig();

      // This should not throw
      expect(() => {
        // Validate config structure
        expect(defaultConfig.project).toBeDefined();
        expect(defaultConfig.git).toBeDefined();
        expect(defaultConfig.agents).toBeDefined();
        expect(defaultConfig.messaging).toBeDefined();
        expect(defaultConfig.monitoring).toBeDefined();
        expect(defaultConfig.integrations).toBeDefined();
        expect(defaultConfig.security).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('load', () => {
    it('should load and validate configuration successfully', async () => {
      const mockConfig = {
        project: {
          name: 'Test Project',
          description: 'Test Description',
          version: '1.0.0',
          repository: '/test/repo',
          workingDirectory: '/test/work'
        },
        git: {
          provider: 'local'
        },
        agents: {
          defaultRoles: [AgentRole.FRONTEND, AgentRole.BACKEND]
        },
        messaging: {
          broker: 'memory'
        },
        monitoring: {
          enabled: true
        },
        integrations: {
          claudeCode: {
            enabled: true
          },
          github: {
            enabled: false
          },
          cicd: {
            provider: 'none'
          }
        },
        security: {
          authentication: false
        }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const config = await configManager.load();

      expect(config).toBeDefined();
      expect(config.project.name).toBe('Test Project');
      expect(config.agents.defaultRoles).toContain(AgentRole.FRONTEND);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(tempConfigPath, 'utf8');
    });

    it('should throw error for invalid configuration', async () => {
      const invalidConfig = {
        project: {
          // Missing required fields like name, description, version, repository, workingDirectory
        }
      };

      // Mock file system to return the invalid config
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      // Create a new config manager to avoid test environment fallbacks
      const testConfigManager = new ConfigManager('/test/invalid/config.json');
      
      await expect(testConfigManager.load()).rejects.toThrow('Configuration validation failed');
    });

    it('should throw error when config file is not found', async () => {
      // Mock fs to simulate file not found
      mockFs.existsSync.mockReturnValue(false);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });
      
      // Create a custom config manager with a non-existent path
      const customConfigManager = new ConfigManager('/non/existent/path.json');
      
      await expect(customConfigManager.load()).rejects.toThrow();
    });
  });

  describe('get', () => {
    it('should return loaded configuration', async () => {
      const mockConfig = configManager.createDefaultConfig();
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      await configManager.load();
      const config = configManager.get();

      expect(config).toEqual(mockConfig);
    });

    it('should throw error if configuration not loaded', () => {
      expect(() => configManager.get()).toThrow('Configuration not loaded');
    });
  });

  describe('save', () => {
    it('should save configuration to file', async () => {
      const config = configManager.createDefaultConfig();
      
      await configManager.save(config);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        tempConfigPath,
        JSON.stringify(config, null, 2)
      );
    });

    it('should validate configuration before saving', async () => {
      const invalidConfig = {
        // Missing required project field entirely
      } as any;

      await expect(configManager.save(invalidConfig)).rejects.toThrow('Configuration validation failed');
    });
  });

  describe('getSection', () => {
    it('should return specific configuration section', async () => {
      const mockConfig = configManager.createDefaultConfig();
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      await configManager.load();
      const agentsConfig = configManager.getSection('agents');

      expect(agentsConfig).toEqual(mockConfig.agents);
    });
  });

  describe('environment variable merging', () => {
    it('should merge environment variables with configuration', async () => {
      // Set test environment variables
      process.env.MADO_PROJECT_NAME = 'Test Project from Env';
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.GITHUB_TOKEN = 'test-github-token';

      const mockConfig = configManager.createDefaultConfig();
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const config = await configManager.load();

      expect(config.project.name).toBe('Test Project from Env');
      expect(config.integrations.claudeCode.apiKey).toBe('test-api-key');
      expect(config.integrations.github.token).toBe('test-github-token');

      // Cleanup
      delete process.env.MADO_PROJECT_NAME;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GITHUB_TOKEN;
    });
  });
});