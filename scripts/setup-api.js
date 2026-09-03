#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'apps', 'api');
const venvDir = path.join(apiDir, '.venv');
const isWin = process.platform === 'win32';

console.log('🚀 Starting cross-platform API setup...');

function findPythonCommand() {
  const candidates = isWin
    ? ['py -3.11', 'py -3', 'python', 'python3']
    : ['python3.11', 'python3', 'python'];

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch (err) {
      // try next candidate
    }
  }
  throw new Error('Python 3.10+ not found in PATH. Please install Python 3.10 or higher.');
}

try {
  const pythonCmd = findPythonCommand();
  console.log(`✓ Found Python interpreter: ${pythonCmd}`);

  if (!fs.existsSync(venvDir)) {
    console.log(`📦 Creating virtual environment at ${venvDir}...`);
    execSync(`${pythonCmd} -m venv "${venvDir}"`, { stdio: 'inherit', cwd: rootDir });
  } else {
    console.log(`✓ Virtual environment already exists at ${venvDir}`);
  }

  const pipCmd = isWin
    ? path.join(venvDir, 'Scripts', 'pip.exe')
    : path.join(venvDir, 'bin', 'pip');

  const reqFile = path.join(apiDir, 'requirements.txt');

  console.log(`⚡ Installing requirements from ${reqFile}...`);
  execSync(`"${pipCmd}" install -r "${reqFile}"`, { stdio: 'inherit', cwd: rootDir });

  console.log('✅ API environment setup completed successfully!');
} catch (error) {
  console.error('❌ Failed to setup API environment:', error.message);
  process.exit(1);
}
