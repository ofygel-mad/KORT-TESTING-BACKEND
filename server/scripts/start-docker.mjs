import { spawnSync } from 'node:child_process';

function run(command, args, description = '') {
  console.log(`\n▶️  ${description || `${command} ${args.join(' ')}`}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`❌ ${description} failed with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
  console.log(`✅ ${description} completed successfully`);
}

async function main() {
  console.log('\n═══════════════════════════════════════');
  console.log('   🚀 Starting KORT Backend Server');
  console.log('═══════════════════════════════════════\n');

  run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], '📦 Deploying database migrations');
  run('pnpm', ['run', 'db:seed'], '🌱 Seeding database with demo data');
  run('node', ['dist/index.js'], '🚀 Starting application server');
}

main().catch((error) => {
  console.error('\n❌ Fatal startup error:', error);
  process.exit(1);
});
