-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "attributes" JSONB;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "extra_attributes" JSONB,
ADD COLUMN     "template_id" TEXT;

-- CreateTable
CREATE TABLE "order_templates" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "item_noun" TEXT NOT NULL DEFAULT 'позицию',
    "primary_unit" TEXT NOT NULL DEFAULT 'шт',
    "primary_precision" INTEGER NOT NULL DEFAULT 0,
    "sections" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_templates_org_id_idx" ON "order_templates"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_templates_org_id_name_key" ON "order_templates"("org_id", "name");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "order_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_templates" ADD CONSTRAINT "order_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
