-- DropForeignKey
ALTER TABLE "warehouse_field_definitions" DROP CONSTRAINT "warehouse_field_definitions_org_id_fkey";

-- DropForeignKey
ALTER TABLE "warehouse_field_options" DROP CONSTRAINT "warehouse_field_options_definition_id_fkey";

-- DropForeignKey
ALTER TABLE "warehouse_product_fields" DROP CONSTRAINT "warehouse_product_fields_definition_id_fkey";

-- DropForeignKey
ALTER TABLE "warehouse_product_fields" DROP CONSTRAINT "warehouse_product_fields_product_id_fkey";

-- AlterTable
ALTER TABLE "manual_invoice_items" DROP COLUMN "color",
DROP COLUMN "gender",
DROP COLUMN "length",
DROP COLUMN "size",
ADD COLUMN     "attributes_json" JSONB;

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "color",
DROP COLUMN "gender",
DROP COLUMN "length",
DROP COLUMN "size";

-- AlterTable
ALTER TABLE "order_templates" ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "template_snapshot" JSONB;

-- AlterTable
ALTER TABLE "production_tasks" DROP COLUMN "size";

-- AlterTable
ALTER TABLE "return_items" DROP COLUMN "color",
DROP COLUMN "gender",
DROP COLUMN "size";

-- AlterTable
ALTER TABLE "warehouse_product_catalog" ADD COLUMN     "default_retail_price" DECIMAL(14,2),
ADD COLUMN     "default_wholesale_price" DECIMAL(14,2),
ADD COLUMN     "template_id" TEXT;

-- AlterTable
ALTER TABLE "warehouse_variants" ADD COLUMN     "retail_price" DECIMAL(14,2),
ADD COLUMN     "wholesale_price" DECIMAL(14,2);

-- DropTable
DROP TABLE "warehouse_field_definitions";

-- DropTable
DROP TABLE "warehouse_field_options";

-- DropTable
DROP TABLE "warehouse_product_fields";

-- CreateIndex
CREATE INDEX "warehouse_product_catalog_org_id_template_id_idx" ON "warehouse_product_catalog"("org_id", "template_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_reservation_dedupe" ON "warehouse_stock_reservations"("org_id", "source_type", "source_id", "source_line_id");

-- AddForeignKey
ALTER TABLE "warehouse_product_catalog" ADD CONSTRAINT "warehouse_product_catalog_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "order_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

