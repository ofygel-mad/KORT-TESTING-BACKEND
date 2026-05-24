-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "fulfillment_substatus" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "lifecycle_stage" TEXT,
ADD COLUMN     "manager_snapshot" JSONB;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "verification_source" TEXT,
ADD COLUMN     "verified_at" TIMESTAMP(3);
