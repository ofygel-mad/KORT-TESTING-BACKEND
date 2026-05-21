-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_login_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "org_id" TEXT,
    "user_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "shipped_at" TIMESTAMP(3),
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_org_id_occurred_at_idx" ON "audit_events"("org_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_user_id_occurred_at_idx" ON "audit_events"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_type_occurred_at_idx" ON "audit_events"("type", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_shipped_at_idx" ON "audit_events"("shipped_at");
