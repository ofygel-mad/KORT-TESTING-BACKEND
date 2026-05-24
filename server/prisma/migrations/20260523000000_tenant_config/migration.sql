-- CreateTable
CREATE TABLE "tenant_configs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "manifest_version" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'default',
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_config_revisions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "manifest_version" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "actor" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_config_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_config_previews" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "manifest_version" TEXT NOT NULL,
    "staged_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_config_previews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_configs_org_id_key" ON "tenant_configs"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_config_revisions_org_id_revision_key" ON "tenant_config_revisions"("org_id", "revision");

-- CreateIndex
CREATE INDEX "tenant_config_revisions_org_id_applied_at_idx" ON "tenant_config_revisions"("org_id", "applied_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_config_previews_org_id_key" ON "tenant_config_previews"("org_id");

-- AddForeignKey
ALTER TABLE "tenant_configs" ADD CONSTRAINT "tenant_configs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_config_revisions" ADD CONSTRAINT "tenant_config_revisions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_config_previews" ADD CONSTRAINT "tenant_config_previews_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
