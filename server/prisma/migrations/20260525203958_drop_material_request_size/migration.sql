-- AlterTable
ALTER TABLE "material_request_items" DROP COLUMN "size",
ADD COLUMN     "attributes_json" JSONB;

