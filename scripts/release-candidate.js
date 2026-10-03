#!/usr/bin/env node

const { spawn } = require('child_process');

const localGates = [
  npmGate('run check'),
  npmGate('test')
];

const deploymentGates = [
  'npm run ops:preflight',
  'npm run db:verify',
  'npm run ops:startup-check with STARTUP_BASE_URL=https://your-domain.co.za',
  'npm run ops:vendor-check with VENDOR_CHECKS=smtp,meta,payfast and strict vendor flags',
  'npm run ops:google-oauth with production OAuth credentials and approval statuses',
  'npm run smoke:beta with SMOKE_BASE_URL, SMOKE_EMAIL, and SMOKE_PASSWORD'
];

async function main() {
  console.log('ChatClan release-candidate local gates\n');

  for (const [command, args, label] of localGates) {
    await run(command, args, label);
  }

  console.log('\nLocal release-candidate gates passed.');
  console.log('\nDeployment-only gates still required with production environment and credentials:');
  for (const gate of deploymentGates) {
    console.log(`- ${gate}`);
  }
}

function npmGate(script) {
  if (process.platform === 'win32') {
    return ['cmd.exe', ['/d', '/s', '/c', `npm ${script}`], `npm ${script}`];
  }
  const [command, ...args] = script.split(' ');
  return ['npm', [command, ...args], `npm ${script}`];
}

function run(command, args, label = [command, ...args].join(' ')) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${label}`);
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} exited with code ${code}`));
      }
    });
  });
}

main().catch((error) => {
  console.error(`\n[fail] ${error.message}`);
  process.exitCode = 1;
});
