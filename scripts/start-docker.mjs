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

/**
 * Runs prisma migrate deploy.
 * If it fails with P3009 (failed migration blocking deploy), extracts the
 * failed migration name(s) from the error output, marks each as --applied
 * (they ran but were interrupted, so the schema is already there), then retries.
 */
function runMigrations() {
  console.log('\n▶️  📦 Deploying database migrations');

  const firstRun = spawnSync(
    'pnpm', ['exec', 'prisma', 'migrate', 'deploy'],
    { stdio: 'pipe', shell: process.platform === 'win32', env: process.env },
  );

  const output = (firstRun.stdout?.toString() ?? '') + (firstRun.stderr?.toString() ?? '');

  if (firstRun.status === 0) {
    process.stdout.write(output);
    console.log('✅ 📦 Deploying database migrations completed successfully');
    return;
  }

  // P3009: one or more migrations are marked failed and block new ones
  if (output.includes('P3009')) {
    process.stdout.write(output);
    console.log('\n🔧 Detected P3009 — resolving failed migrations as applied…');

    // Error format: "The `20260320175532_init` migration started at … failed"
    const nameRegex = /The `([^`]+)` migration/g;
    let match;
    while ((match = nameRegex.exec(output)) !== null) {
      const name = match[1];
      console.log(`   → prisma migrate resolve --applied "${name}"`);
      spawnSync(
        'pnpm', ['exec', 'prisma', 'migrate', 'resolve', '--applied', name],
        { stdio: 'inherit', shell: process.platform === 'win32', env: process.env },
      );
    }

    // Retry deploy
    console.log('\n▶️  🔄 Retrying prisma migrate deploy…');
    const retry = spawnSync(
      'pnpm', ['exec', 'prisma', 'migrate', 'deploy'],
      { stdio: 'inherit', shell: process.platform === 'win32', env: process.env },
    );
    if (retry.status !== 0) {
      console.error('❌ 📦 Deploying database migrations failed after resolve');
      process.exit(retry.status ?? 1);
    }
    console.log('✅ 📦 Deploying database migrations completed successfully');
    return;
  }

  // Any other failure — print output and exit
  process.stdout.write(output);
  console.error(`❌ 📦 Deploying database migrations failed with status ${firstRun.status}`);
  process.exit(firstRun.status ?? 1);
}

async function main() {
  console.log('\n═══════════════════════════════════════');
  console.log('   🚀 Starting KORT Backend Server');
  console.log('═══════════════════════════════════════\n');

  runMigrations();
  run('pnpm', ['run', 'db:seed'], '🌱 Seeding database with demo data');
  run('node', ['dist/index.js'], '🚀 Starting application server');
}

main().catch((error) => {
  console.error('\n❌ Fatal startup error:', error);
  process.exit(1);
});
