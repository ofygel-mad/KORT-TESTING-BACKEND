// P3 — Idempotent seed of OrderTemplate (Blank + Clothing) per org, plus
// backfill of Order.templateId for orders missing one.
//
// Run: pnpm --filter server tsx scripts/seed-order-templates.ts

import { prisma } from '../src/lib/prisma.js';
import {
  ensureSystemTemplatesForOrg,
  backfillOrdersWithDefaultTemplate,
} from '../src/modules/orders/templates.js';

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  if (orgs.length === 0) {
    console.log('No organizations — nothing to seed.');
    return;
  }

  console.log(`Seeding OrderTemplate for ${orgs.length} org(s)...`);
  let totalBackfilled = 0;
  for (const org of orgs) {
    const backfilled = await backfillOrdersWithDefaultTemplate(org.id);
    totalBackfilled += backfilled;
    console.log(`  ${org.name} [${org.id}]: backfilled ${backfilled} order(s)`);
  }
  console.log(`Done. ${totalBackfilled} order(s) backfilled across ${orgs.length} org(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
