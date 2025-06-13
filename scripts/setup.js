#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * MADO Setup Script
 * Initializes the project with proper configuration and dependencies
 */

console.log('🚀 Setting up MADO Orchestrator...\n');

// Check Node.js version
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 18) {
    console.error('❌ Node.js 18 or higher is required. Current version:', nodeVersion);
    process.exit(1);
  }
  
  console.log('✅ Node.js version check passed:', nodeVersion);
}

// Check Git installation
function checkGit() {
  try {
    execSync('git --version', { stdio: 'ignore' });
    console.log('✅ Git is installed');
  } catch (error) {
    console.error('❌ Git is not installed or not in PATH');
    process.exit(1);
  }
}

// Create necessary directories
function createDirectories() {
  const dirs = [
    'logs',
    'config',
    'data',
    'worktrees',
    'temp'
  ];
  
  dirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
}

// Create local configuration if it doesn't exist
function createLocalConfig() {
  const configDir = path.join(process.cwd(), 'config');
  const defaultConfigPath = path.join(configDir, 'default.json');
  const localConfigPath = path.join(configDir, 'local.json');
  
  if (!fs.existsSync(localConfigPath)) {
    if (fs.existsSync(defaultConfigPath)) {
      const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
      
      // Customize for local environment
      defaultConfig.project.workingDirectory = process.cwd();
      defaultConfig.project.name = path.basename(process.cwd()) + ' - MADO Project';
      
      fs.writeFileSync(localConfigPath, JSON.stringify(defaultConfig, null, 2));
      console.log('📄 Created local configuration file');
    } else {
      console.warn('⚠️  Default configuration file not found');
    }
  } else {
    console.log('📄 Local configuration already exists');
  }
}

// Initialize Git repository if needed
function initializeGit() {
  const gitDir = path.join(process.cwd(), '.git');
  
  if (!fs.existsSync(gitDir)) {
    try {
      execSync('git init', { stdio: 'ignore' });
      console.log('📦 Initialized Git repository');
      
      // Create initial commit
      const gitignore = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/
*.tsbuildinfo

# Logs
logs/
*.log

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# MADO specific
worktrees/
temp/
data/
config/local.json
`;
      
      fs.writeFileSync('.gitignore', gitignore);
      
      try {
        execSync('git add .gitignore', { stdio: 'ignore' });
        execSync('git commit -m "Initial commit: Add .gitignore"', { stdio: 'ignore' });
        console.log('📝 Created initial Git commit');
      } catch (error) {
        console.log('📝 Git repository initialized (manual commit required)');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Git repository:', error.message);
    }
  } else {
    console.log('📦 Git repository already exists');
  }
}

// Create environment file template
function createEnvTemplate() {
  const envPath = path.join(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath)) {
    const envTemplate = `# MADO Orchestrator Environment Variables

# Project Configuration
MADO_PROJECT_NAME="My MADO Project"
MADO_WORKING_DIR="."

# Git Configuration
MADO_GIT_TOKEN=""
MADO_GIT_REMOTE=""

# Claude Code Integration
ANTHROPIC_API_KEY=""
ANTHROPIC_BASE_URL=""

# GitHub Integration
GITHUB_TOKEN=""

# Logging
LOG_LEVEL="info"
NODE_ENV="development"

# Monitoring
MADO_DASHBOARD_PORT="3000"
MADO_METRICS_ENABLED="true"

# Security
MADO_AUTH_ENABLED="false"
MADO_SANDBOX_ENABLED="true"
`;

    fs.writeFileSync(envPath, envTemplate);
    console.log('🔐 Created environment template (.env.example)');
  }
}

// Install dependencies and build
function buildProject() {
  try {
    console.log('📦 Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
    
    console.log('🔨 Building project...');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('✅ Build completed successfully');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run tests to verify setup
function runTests() {
  try {
    console.log('🧪 Running tests to verify setup...');
    execSync('npm test', { stdio: 'inherit' });
    console.log('✅ All tests passed');
  } catch (error) {
    console.warn('⚠️  Some tests failed, but setup can continue');
  }
}

// Print next steps
function printNextSteps() {
  console.log('\n🎉 MADO Orchestrator setup completed successfully!\n');
  
  console.log('Next steps:');
  console.log('1. Configure your environment:');
  console.log('   cp .env.example .env');
  console.log('   # Edit .env with your API keys and settings');
  console.log('');
  console.log('2. Customize your configuration:');
  console.log('   # Edit config/local.json for project-specific settings');
  console.log('');
  console.log('3. Start the orchestrator:');
  console.log('   npm start');
  console.log('');
  console.log('4. Or run in development mode:');
  console.log('   npm run dev');
  console.log('');
  console.log('5. Start individual agents:');
  console.log('   npm run agent:frontend');
  console.log('   npm run agent:backend');
  console.log('   npm run agent:qa');
  console.log('');
  console.log('📚 Documentation: https://github.com/your-org/mado-orchestrator');
  console.log('🐛 Issues: https://github.com/your-org/mado-orchestrator/issues');
  console.log('');
  console.log('Happy orchestrating! 🤖✨');
}

// Main setup function
async function main() {
  try {
    checkNodeVersion();
    checkGit();
    createDirectories();
    createLocalConfig();
    initializeGit();
    createEnvTemplate();
    buildProject();
    runTests();
    printNextSteps();
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  checkNodeVersion,
  checkGit,
  createDirectories,
  createLocalConfig,
  initializeGit,
  createEnvTemplate,
  buildProject,
  runTests,
  printNextSteps
};