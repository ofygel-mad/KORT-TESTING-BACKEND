-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'ORDER_REF');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "full_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "password" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_entries" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "category" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "counterparty" TEXT,
    "source_module" TEXT,
    "source_id" TEXT,
    "source_label" TEXT,
    "period" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "prev_hash" TEXT,
    "hash" TEXT NOT NULL,
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciled_at" TIMESTAMP(3),
    "reconciled_by" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_gaps" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "description" TEXT NOT NULL,
    "source_module" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_templates" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "header_row_index" INTEGER NOT NULL DEFAULT 0,
    "data_start_row" INTEGER NOT NULL DEFAULT 1,
    "sheet_name" TEXT,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'basic',
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "industry" TEXT,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "legal_name" TEXT,
    "bin" TEXT,
    "iin" TEXT,
    "legal_form" TEXT,
    "director" TEXT,
    "accountant" TEXT,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "bank_name" TEXT,
    "bank_bik" TEXT,
    "bank_account" TEXT,
    "shipment_responsible_name" TEXT,
    "shipment_responsible_position" TEXT,
    "transport_organization" TEXT,
    "attorney_number" TEXT,
    "attorney_date" TEXT,
    "attorney_issued_by" TEXT,
    "order_counter" INTEGER NOT NULL DEFAULT 0,
    "invoice_counter" INTEGER NOT NULL DEFAULT 0,
    "request_counter" INTEGER NOT NULL DEFAULT 0,
    "kazpost_delivery_fee" INTEGER NOT NULL DEFAULT 2000,
    "rail_delivery_fee" INTEGER NOT NULL DEFAULT 3000,
    "air_delivery_fee" INTEGER NOT NULL DEFAULT 5000,
    "bank_commission_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_definitions" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "max_users" INTEGER,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_definitions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "plan_code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_end" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kaspi_connections" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "seller_name" TEXT,
    "api_token" TEXT NOT NULL,
    "token_last4" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kaspi_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kaspi_order_links" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "external_order_id" TEXT NOT NULL,
    "external_order_code" TEXT,
    "external_state" TEXT,
    "external_status" TEXT,
    "external_delivery_mode" TEXT,
    "internal_order_id" TEXT,
    "internal_order_type" TEXT,
    "raw_payload" JSONB,
    "last_external_update_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kaspi_order_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'NBK',
    "rate_date" TIMESTAMP(3) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'target',
    "status" TEXT NOT NULL DEFAULT 'active',
    "manager_name" TEXT,
    "creative_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_daily_metrics" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "spend_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "exchange_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spend_kzt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "joined_at" TIMESTAMP(3),
    "is_owner" BOOLEAN NOT NULL DEFAULT false,
    "role_id" TEXT,
    "department" TEXT NOT NULL DEFAULT '',
    "added_by_id" TEXT,
    "added_by_name" TEXT,
    "employee_account_status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "org_id" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "data_scope" TEXT NOT NULL DEFAULT 'all',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_permission_overrides" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "effect" TEXT NOT NULL,

    CONSTRAINT "member_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'manager',
    "auto_approve" BOOLEAN NOT NULL DEFAULT true,
    "kind" TEXT NOT NULL DEFAULT 'referral',
    "created_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "used_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "requested_role" TEXT NOT NULL DEFAULT 'viewer',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "company_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "source" TEXT DEFAULT 'manual',
    "customer_type" TEXT NOT NULL DEFAULT 'retail',
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "company_name" TEXT,
    "source" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "pipeline" TEXT NOT NULL DEFAULT 'qualifier',
    "assigned_to" TEXT,
    "assigned_name" TEXT,
    "callback_at" TIMESTAMP(3),
    "meeting_at" TIMESTAMP(3),
    "budget" DOUBLE PRECISION,
    "comment" TEXT,
    "checklist_done" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_history" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "lead_id" TEXT,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "company_name" TEXT,
    "source" TEXT,
    "title" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'awaiting_meeting',
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "probability" INTEGER NOT NULL DEFAULT 20,
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "assigned_to" TEXT,
    "assigned_name" TEXT,
    "qualifier_name" TEXT,
    "expected_close_at" TIMESTAMP(3),
    "meeting_at" TIMESTAMP(3),
    "stage_entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "won_at" TIMESTAMP(3),
    "lost_at" TIMESTAMP(3),
    "lost_reason" TEXT,
    "lost_comment" TEXT,
    "notes" TEXT,
    "checklist_done" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_activities" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "deal_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assigned_to" TEXT,
    "assigned_name" TEXT,
    "created_by" TEXT,
    "task_type" TEXT NOT NULL DEFAULT 'manual',
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "linked_entity_type" TEXT,
    "linked_entity_id" TEXT,
    "linked_entity_title" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_subtasks" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_activities" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_sizes" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_requests" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "request_number" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "messengers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "city" TEXT,
    "delivery_method" TEXT,
    "lead_source" TEXT,
    "preferred_contact" TEXT NOT NULL DEFAULT 'phone',
    "desired_date" TIMESTAMP(3),
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'public_form',
    "status" TEXT NOT NULL DEFAULT 'new',
    "created_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_request_items" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "size" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,

    CONSTRAINT "material_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "client_phone" TEXT NOT NULL,
    "client_phone_foreign" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "payment_status" TEXT NOT NULL DEFAULT 'not_paid',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "is_demanding_client" BOOLEAN NOT NULL DEFAULT false,
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "street_address" TEXT,
    "city" TEXT,
    "delivery_type" TEXT,
    "source" TEXT,
    "expected_payment_method" TEXT,
    "shipping_note" TEXT,
    "internal_note" TEXT,
    "postal_code" TEXT,
    "order_date" TIMESTAMP(3),
    "order_discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "delivery_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bank_commission_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bank_commission_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payment_breakdown" JSONB,
    "requires_invoice" BOOLEAN NOT NULL DEFAULT true,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "has_returns" BOOLEAN NOT NULL DEFAULT false,
    "manager_id" TEXT,
    "manager_name" TEXT,
    "customer_type" TEXT NOT NULL DEFAULT 'retail',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "item_position" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "fulfillment_mode" TEXT NOT NULL DEFAULT 'unassigned',
    "gender" TEXT,
    "length" TEXT,
    "notes" TEXT,
    "workshop_notes" TEXT,
    "color" TEXT,
    "variant_key" TEXT,
    "attributes_json" JSONB,
    "attributes_summary" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_tasks" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assigned_to" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "defects" TEXT,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "block_reason" TEXT,

    CONSTRAINT "production_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_by" TEXT NOT NULL,
    "proposed_items" JSONB NOT NULL,
    "manager_note" TEXT,
    "reject_reason" TEXT,
    "resolved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_attachments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "notes" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_transfers" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "confirmed_by_manager" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by_client" BOOLEAN NOT NULL DEFAULT false,
    "transferred_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "order_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_activities" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unpaid_alerts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,

    CONSTRAINT "unpaid_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_confirmation',
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "seamstress_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "seamstress_confirmed_at" TIMESTAMP(3),
    "seamstress_confirmed_by" TEXT,
    "warehouse_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "warehouse_confirmed_at" TIMESTAMP(3),
    "warehouse_confirmed_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejection_reason" TEXT,
    "document_payload" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_orders" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,

    CONSTRAINT "invoice_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "returns" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "return_number" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reason" TEXT NOT NULL,
    "reason_notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by" TEXT,
    "total_refund_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refund_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "order_item_id" TEXT,
    "product_name" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "color" TEXT,
    "gender" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "refund_amount" DOUBLE PRECISION NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'good',
    "warehouse_item_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_categories" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#888888',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_locations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "warehouse_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_items" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "category_id" TEXT,
    "location_id" TEXT,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'шт',
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_beginning" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_reserved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verification_required" BOOLEAN NOT NULL DEFAULT false,
    "qty_min" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_max" DOUBLE PRECISION,
    "cost_price" DOUBLE PRECISION,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "qr_code" TEXT,
    "product_catalog_id" TEXT,
    "variant_key" TEXT,
    "attributes_json" JSONB,
    "attributes_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_movements" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "qty_before" DOUBLE PRECISION NOT NULL,
    "qty_after" DOUBLE PRECISION NOT NULL,
    "source_id" TEXT,
    "source_type" TEXT,
    "lot_id" TEXT,
    "reason" TEXT,
    "author" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_reservations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_transit_zones" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Транзит',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_transit_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_transit_entries" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "order_id" TEXT,
    "qty" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_transit',
    "source_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_transit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_bom_lines" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "product_key" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "qty_per_unit" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "warehouse_bom_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_alerts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source_id" TEXT,
    "qty_need" DOUBLE PRECISION,
    "qty_have" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "warehouse_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_lots" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "lot_number" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "supplier" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "warehouse_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_field_definitions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "entity_scope" TEXT NOT NULL DEFAULT 'both',
    "input_type" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_variant_axis" BOOLEAN NOT NULL DEFAULT false,
    "show_in_warehouse_form" BOOLEAN NOT NULL DEFAULT true,
    "show_in_order_form" BOOLEAN NOT NULL DEFAULT true,
    "show_in_documents" BOOLEAN NOT NULL DEFAULT true,
    "affects_availability" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_field_options" (
    "id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "color_hex" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "warehouse_field_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_product_catalog" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_product_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_product_photos" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_product_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_product_fields" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "warehouse_product_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_sites" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "published_layout_version_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_zones" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "parent_zone_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone_type" TEXT NOT NULL DEFAULT 'storage',
    "status" TEXT NOT NULL DEFAULT 'active',
    "capacity_policy_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_aisles" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "direction_policy" TEXT DEFAULT 'bidirectional',
    "min_width_mm" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_aisles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_racks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "aisle_id" TEXT,
    "code" TEXT NOT NULL,
    "rack_type" TEXT NOT NULL DEFAULT 'standard',
    "status" TEXT NOT NULL DEFAULT 'active',
    "max_weight" DOUBLE PRECISION,
    "max_volume" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_racks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_shelves" (
    "id" TEXT NOT NULL,
    "rack_id" TEXT NOT NULL,
    "level_index" INTEGER NOT NULL,
    "max_weight" DOUBLE PRECISION,
    "max_volume" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_shelves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_bins" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "aisle_id" TEXT,
    "rack_id" TEXT,
    "shelf_id" TEXT,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "bin_type" TEXT NOT NULL DEFAULT 'standard',
    "capacity_units" DOUBLE PRECISION,
    "capacity_weight" DOUBLE PRECISION,
    "capacity_volume" DOUBLE PRECISION,
    "pick_face_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_variants" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "product_catalog_id" TEXT NOT NULL,
    "variant_key" TEXT NOT NULL,
    "attributes_json" JSONB,
    "attributes_summary" TEXT,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_stock_ledger_events" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "from_bin_id" TEXT,
    "to_bin_id" TEXT,
    "event_type" TEXT NOT NULL,
    "qty_delta" DOUBLE PRECISION NOT NULL,
    "stock_status_from" TEXT,
    "stock_status_to" TEXT,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "source_line_id" TEXT,
    "correlation_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_stock_ledger_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_stock_balances" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "bin_id" TEXT NOT NULL,
    "stock_status" TEXT NOT NULL,
    "qty_on_hand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_reserved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_available" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_stock_reservations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_line_id" TEXT,
    "qty_reserved" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "idempotency_key" TEXT NOT NULL,
    "compatibility_reservation_id" TEXT,
    "released_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_stock_reservation_allocations" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "stock_balance_id" TEXT NOT NULL,
    "bin_id" TEXT NOT NULL,
    "qty_reserved" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_stock_reservation_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_layout_versions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "based_on_version_id" TEXT,
    "validation_status" TEXT NOT NULL DEFAULT 'not_validated',
    "validation_summary_json" JSONB,
    "validated_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_layout_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_tasks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "zone_id" TEXT,
    "bin_id" TEXT,
    "source_bin_id" TEXT,
    "target_bin_id" TEXT,
    "variant_id" TEXT,
    "reservation_id" TEXT,
    "assignee_pool_id" TEXT,
    "source_type" TEXT,
    "source_id" TEXT,
    "source_line_id" TEXT,
    "task_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assignee_name" TEXT,
    "assignee_role" TEXT,
    "assigned_at" TIMESTAMP(3),
    "sla_status" TEXT NOT NULL DEFAULT 'on_track',
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "escalated_at" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source_strategy" TEXT,
    "external_key" TEXT NOT NULL,
    "route_key" TEXT,
    "metadata_json" JSONB,
    "due_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_exceptions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "zone_id" TEXT,
    "bin_id" TEXT,
    "task_id" TEXT,
    "variant_id" TEXT,
    "owner_pool_id" TEXT,
    "source_type" TEXT,
    "source_id" TEXT,
    "exception_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "status" TEXT NOT NULL DEFAULT 'open',
    "owner_name" TEXT,
    "owner_role" TEXT,
    "assigned_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "resolution_code" TEXT,
    "sla_status" TEXT NOT NULL DEFAULT 'on_track',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source_strategy" TEXT,
    "external_key" TEXT NOT NULL,
    "metadata_json" JSONB,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_assignee_pools" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pool_type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "capacity_limit" INTEGER,
    "assignment_policy" TEXT NOT NULL DEFAULT 'fifo',
    "sla_timeout_min" INTEGER NOT NULL DEFAULT 60,
    "escalation_pool_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_assignee_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_task_events" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_name" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_task_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_exception_events" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "exception_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_name" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_exception_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_layout_nodes" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "layout_version_id" TEXT NOT NULL,
    "zone_id" TEXT,
    "bin_id" TEXT,
    "parent_node_id" TEXT,
    "node_type" TEXT NOT NULL,
    "domain_type" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,
    "label" TEXT,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "z_index" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_layout_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_operation_documents" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT,
    "order_id" TEXT,
    "document_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "idempotency_key" TEXT NOT NULL,
    "reference_no" TEXT,
    "payload" JSONB,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_operation_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_site_read_models" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'fresh',
    "last_event_id" TEXT,
    "last_event_type" TEXT,
    "refreshed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_site_read_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_order_read_models" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT,
    "snapshot_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'fresh',
    "last_event_id" TEXT,
    "last_event_type" TEXT,
    "refreshed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_order_read_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_outbox" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_projection_inbox" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT,
    "consumer" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "payload_hash" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_projection_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_layout_publish_audit" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_site_id" TEXT NOT NULL,
    "layout_version_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "force_reason" TEXT,
    "previous_version_id" TEXT,
    "blocker_summary_json" JSONB,
    "impacted_task_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_layout_publish_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_read_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "reply_to_id" TEXT,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_invoices" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "invoice_num" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "manual_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "gender" TEXT,
    "length" TEXT,
    "color" TEXT,
    "size" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_entries_hash_key" ON "accounting_entries"("hash");

-- CreateIndex
CREATE INDEX "accounting_entries_org_id_period_idx" ON "accounting_entries"("org_id", "period");

-- CreateIndex
CREATE INDEX "accounting_entries_org_id_type_idx" ON "accounting_entries"("org_id", "type");

-- CreateIndex
CREATE INDEX "accounting_entries_org_id_source_module_source_id_idx" ON "accounting_entries"("org_id", "source_module", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_entries_org_id_seq_key" ON "accounting_entries"("org_id", "seq");

-- CreateIndex
CREATE INDEX "accounting_gaps_org_id_status_idx" ON "accounting_gaps"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_gaps_org_id_source_module_source_id_type_key" ON "accounting_gaps"("org_id", "source_module", "source_id", "type");

-- CreateIndex
CREATE INDEX "import_templates_org_id_idx" ON "import_templates"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "import_templates_org_id_name_key" ON "import_templates"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_org_id_key" ON "subscriptions"("org_id");

-- CreateIndex
CREATE INDEX "kaspi_connections_org_id_is_active_idx" ON "kaspi_connections"("org_id", "is_active");

-- CreateIndex
CREATE INDEX "kaspi_connections_org_id_archived_at_idx" ON "kaspi_connections"("org_id", "archived_at");

-- CreateIndex
CREATE INDEX "kaspi_order_links_org_id_external_status_idx" ON "kaspi_order_links"("org_id", "external_status");

-- CreateIndex
CREATE INDEX "kaspi_order_links_org_id_external_state_idx" ON "kaspi_order_links"("org_id", "external_state");

-- CreateIndex
CREATE INDEX "kaspi_order_links_org_id_connection_id_idx" ON "kaspi_order_links"("org_id", "connection_id");

-- CreateIndex
CREATE INDEX "kaspi_order_links_org_id_internal_order_id_idx" ON "kaspi_order_links"("org_id", "internal_order_id");

-- CreateIndex
CREATE INDEX "kaspi_order_links_connection_id_last_synced_at_idx" ON "kaspi_order_links"("connection_id", "last_synced_at");

-- CreateIndex
CREATE UNIQUE INDEX "kaspi_order_links_connection_id_external_order_id_key" ON "kaspi_order_links"("connection_id", "external_order_id");

-- CreateIndex
CREATE INDEX "exchange_rates_base_quote_rate_date_idx" ON "exchange_rates"("base", "quote", "rate_date");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_base_quote_rate_date_source_key" ON "exchange_rates"("base", "quote", "rate_date", "source");

-- CreateIndex
CREATE INDEX "ad_campaigns_org_id_channel_status_idx" ON "ad_campaigns"("org_id", "channel", "status");

-- CreateIndex
CREATE INDEX "ad_campaigns_org_id_name_idx" ON "ad_campaigns"("org_id", "name");

-- CreateIndex
CREATE INDEX "ad_daily_metrics_org_id_date_idx" ON "ad_daily_metrics"("org_id", "date");

-- CreateIndex
CREATE INDEX "ad_daily_metrics_org_id_campaign_id_idx" ON "ad_daily_metrics"("org_id", "campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_daily_metrics_campaign_id_date_key" ON "ad_daily_metrics"("campaign_id", "date");

-- CreateIndex
CREATE INDEX "memberships_org_id_idx" ON "memberships"("org_id");

-- CreateIndex
CREATE INDEX "memberships_role_id_idx" ON "memberships"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_org_id_key" ON "memberships"("user_id", "org_id");

-- CreateIndex
CREATE INDEX "roles_org_id_idx" ON "roles"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_org_id_key_key" ON "roles"("org_id", "key");

-- CreateIndex
CREATE INDEX "member_permission_overrides_membership_id_idx" ON "member_permission_overrides"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_permission_overrides_membership_id_permission_key" ON "member_permission_overrides"("membership_id", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");

-- CreateIndex
CREATE INDEX "invites_org_id_idx" ON "invites"("org_id");

-- CreateIndex
CREATE INDEX "membership_requests_org_id_status_idx" ON "membership_requests"("org_id", "status");

-- CreateIndex
CREATE INDEX "customers_org_id_idx" ON "customers"("org_id");

-- CreateIndex
CREATE INDEX "customers_org_id_phone_idx" ON "customers"("org_id", "phone");

-- CreateIndex
CREATE INDEX "leads_org_id_pipeline_stage_idx" ON "leads"("org_id", "pipeline", "stage");

-- CreateIndex
CREATE INDEX "lead_history_lead_id_idx" ON "lead_history"("lead_id");

-- CreateIndex
CREATE INDEX "deals_org_id_stage_idx" ON "deals"("org_id", "stage");

-- CreateIndex
CREATE INDEX "deal_activities_deal_id_idx" ON "deal_activities"("deal_id");

-- CreateIndex
CREATE INDEX "tasks_org_id_status_idx" ON "tasks"("org_id", "status");

-- CreateIndex
CREATE INDEX "task_subtasks_task_id_idx" ON "task_subtasks"("task_id");

-- CreateIndex
CREATE INDEX "task_activities_task_id_idx" ON "task_activities"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "workers_org_id_name_key" ON "workers"("org_id", "name");

-- CreateIndex
CREATE INDEX "product_sizes_org_id_sort_order_idx" ON "product_sizes"("org_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "product_sizes_org_id_name_key" ON "product_sizes"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_org_id_name_key" ON "payment_methods"("org_id", "name");

-- CreateIndex
CREATE INDEX "material_requests_org_id_status_idx" ON "material_requests"("org_id", "status");

-- CreateIndex
CREATE INDEX "orders_org_id_status_idx" ON "orders"("org_id", "status");

-- CreateIndex
CREATE INDEX "orders_org_id_created_at_idx" ON "orders"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_org_id_payment_status_idx" ON "orders"("org_id", "payment_status");

-- CreateIndex
CREATE INDEX "orders_org_id_is_archived_idx" ON "orders"("org_id", "is_archived");

-- CreateIndex
CREATE INDEX "orders_client_id_idx" ON "orders"("client_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_item_position_idx" ON "order_items"("order_id", "item_position");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_item_position_key" ON "order_items"("order_id", "item_position");

-- CreateIndex
CREATE UNIQUE INDEX "production_tasks_order_item_id_key" ON "production_tasks"("order_item_id");

-- CreateIndex
CREATE INDEX "production_tasks_order_id_idx" ON "production_tasks"("order_id");

-- CreateIndex
CREATE INDEX "production_tasks_status_idx" ON "production_tasks"("status");

-- CreateIndex
CREATE INDEX "production_tasks_order_id_status_idx" ON "production_tasks"("order_id", "status");

-- CreateIndex
CREATE INDEX "change_requests_order_id_idx" ON "change_requests"("order_id");

-- CreateIndex
CREATE INDEX "change_requests_org_id_status_idx" ON "change_requests"("org_id", "status");

-- CreateIndex
CREATE INDEX "order_attachments_order_id_idx" ON "order_attachments"("order_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_transfers_order_id_key" ON "order_transfers"("order_id");

-- CreateIndex
CREATE INDEX "order_activities_order_id_idx" ON "order_activities"("order_id");

-- CreateIndex
CREATE INDEX "order_activities_order_id_created_at_idx" ON "order_activities"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "unpaid_alerts_org_id_idx" ON "unpaid_alerts"("org_id");

-- CreateIndex
CREATE INDEX "unpaid_alerts_order_id_idx" ON "unpaid_alerts"("order_id");

-- CreateIndex
CREATE INDEX "unpaid_alerts_resolved_at_idx" ON "unpaid_alerts"("resolved_at");

-- CreateIndex
CREATE INDEX "invoices_org_id_status_idx" ON "invoices"("org_id", "status");

-- CreateIndex
CREATE INDEX "invoices_org_id_created_at_idx" ON "invoices"("org_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_org_id_invoice_number_key" ON "invoices"("org_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_orders_order_id_idx" ON "invoice_orders"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_orders_invoice_id_order_id_key" ON "invoice_orders"("invoice_id", "order_id");

-- CreateIndex
CREATE INDEX "returns_org_id_status_idx" ON "returns"("org_id", "status");

-- CreateIndex
CREATE INDEX "returns_org_id_order_id_idx" ON "returns"("org_id", "order_id");

-- CreateIndex
CREATE INDEX "returns_org_id_created_at_idx" ON "returns"("org_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "returns_org_id_return_number_key" ON "returns"("org_id", "return_number");

-- CreateIndex
CREATE INDEX "return_items_return_id_idx" ON "return_items"("return_id");

-- CreateIndex
CREATE INDEX "warehouse_categories_org_id_idx" ON "warehouse_categories"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_categories_org_id_name_key" ON "warehouse_categories"("org_id", "name");

-- CreateIndex
CREATE INDEX "warehouse_locations_org_id_idx" ON "warehouse_locations"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_locations_org_id_name_key" ON "warehouse_locations"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_items_qr_code_key" ON "warehouse_items"("qr_code");

-- CreateIndex
CREATE INDEX "warehouse_items_org_id_idx" ON "warehouse_items"("org_id");

-- CreateIndex
CREATE INDEX "warehouse_items_org_id_category_id_idx" ON "warehouse_items"("org_id", "category_id");

-- CreateIndex
CREATE INDEX "warehouse_items_org_id_variant_key_idx" ON "warehouse_items"("org_id", "variant_key");

-- CreateIndex
CREATE INDEX "warehouse_items_org_id_verification_required_idx" ON "warehouse_items"("org_id", "verification_required");

-- CreateIndex
CREATE INDEX "warehouse_movements_org_id_created_at_idx" ON "warehouse_movements"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "warehouse_movements_item_id_idx" ON "warehouse_movements"("item_id");

-- CreateIndex
CREATE INDEX "warehouse_reservations_org_id_status_idx" ON "warehouse_reservations"("org_id", "status");

-- CreateIndex
CREATE INDEX "warehouse_reservations_source_id_idx" ON "warehouse_reservations"("source_id");

-- CreateIndex
CREATE INDEX "warehouse_transit_zones_org_id_idx" ON "warehouse_transit_zones"("org_id");

-- CreateIndex
CREATE INDEX "warehouse_transit_entries_org_id_status_idx" ON "warehouse_transit_entries"("org_id", "status");

-- CreateIndex
CREATE INDEX "warehouse_transit_entries_order_id_idx" ON "warehouse_transit_entries"("order_id");

-- CreateIndex
CREATE INDEX "warehouse_bom_lines_org_id_product_key_idx" ON "warehouse_bom_lines"("org_id", "product_key");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_bom_lines_org_id_product_key_item_id_key" ON "warehouse_bom_lines"("org_id", "product_key", "item_id");

-- CreateIndex
CREATE INDEX "warehouse_alerts_org_id_status_idx" ON "warehouse_alerts"("org_id", "status");

-- CreateIndex
CREATE INDEX "warehouse_alerts_item_id_idx" ON "warehouse_alerts"("item_id");

-- CreateIndex
CREATE INDEX "warehouse_lots_org_id_item_id_idx" ON "warehouse_lots"("org_id", "item_id");

-- CreateIndex
CREATE INDEX "warehouse_field_definitions_org_id_sort_order_idx" ON "warehouse_field_definitions"("org_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_field_definitions_org_id_code_key" ON "warehouse_field_definitions"("org_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_field_options_definition_id_sort_order_idx" ON "warehouse_field_options"("definition_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_field_options_definition_id_value_key" ON "warehouse_field_options"("definition_id", "value");

-- CreateIndex
CREATE INDEX "warehouse_product_catalog_org_id_idx" ON "warehouse_product_catalog"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_product_catalog_org_id_normalized_name_key" ON "warehouse_product_catalog"("org_id", "normalized_name");

-- CreateIndex
CREATE INDEX "warehouse_product_photos_product_id_idx" ON "warehouse_product_photos"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_product_fields_product_id_definition_id_key" ON "warehouse_product_fields"("product_id", "definition_id");

-- CreateIndex
CREATE INDEX "warehouse_sites_org_id_status_idx" ON "warehouse_sites"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_sites_org_id_code_key" ON "warehouse_sites"("org_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_zones_org_id_warehouse_site_id_status_idx" ON "warehouse_zones"("org_id", "warehouse_site_id", "status");

-- CreateIndex
CREATE INDEX "warehouse_zones_parent_zone_id_idx" ON "warehouse_zones"("parent_zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_zones_warehouse_site_id_code_key" ON "warehouse_zones"("warehouse_site_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_aisles_org_id_warehouse_site_id_zone_id_status_idx" ON "warehouse_aisles"("org_id", "warehouse_site_id", "zone_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_aisles_warehouse_site_id_code_key" ON "warehouse_aisles"("warehouse_site_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_racks_org_id_warehouse_site_id_zone_id_status_idx" ON "warehouse_racks"("org_id", "warehouse_site_id", "zone_id", "status");

-- CreateIndex
CREATE INDEX "warehouse_racks_aisle_id_idx" ON "warehouse_racks"("aisle_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_racks_warehouse_site_id_code_key" ON "warehouse_racks"("warehouse_site_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_shelves_rack_id_level_index_key" ON "warehouse_shelves"("rack_id", "level_index");

-- CreateIndex
CREATE INDEX "warehouse_bins_org_id_warehouse_site_id_zone_id_status_idx" ON "warehouse_bins"("org_id", "warehouse_site_id", "zone_id", "status");

-- CreateIndex
CREATE INDEX "warehouse_bins_aisle_id_idx" ON "warehouse_bins"("aisle_id");

-- CreateIndex
CREATE INDEX "warehouse_bins_rack_id_idx" ON "warehouse_bins"("rack_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_bins_warehouse_site_id_code_key" ON "warehouse_bins"("warehouse_site_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_variants_org_id_is_active_idx" ON "warehouse_variants"("org_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_variants_org_id_product_catalog_id_variant_key_key" ON "warehouse_variants"("org_id", "product_catalog_id", "variant_key");

-- CreateIndex
CREATE INDEX "warehouse_stock_ledger_events_org_id_warehouse_site_id_crea_idx" ON "warehouse_stock_ledger_events"("org_id", "warehouse_site_id", "created_at");

-- CreateIndex
CREATE INDEX "warehouse_stock_ledger_events_org_id_variant_id_created_at_idx" ON "warehouse_stock_ledger_events"("org_id", "variant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_stock_ledger_events_org_id_idempotency_key_key" ON "warehouse_stock_ledger_events"("org_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "warehouse_stock_balances_org_id_warehouse_site_id_bin_id_idx" ON "warehouse_stock_balances"("org_id", "warehouse_site_id", "bin_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_stock_balances_org_id_warehouse_site_id_variant_i_key" ON "warehouse_stock_balances"("org_id", "warehouse_site_id", "variant_id", "bin_id", "stock_status");

-- CreateIndex
CREATE INDEX "warehouse_stock_reservations_org_id_warehouse_site_id_statu_idx" ON "warehouse_stock_reservations"("org_id", "warehouse_site_id", "status");

-- CreateIndex
CREATE INDEX "warehouse_stock_reservations_org_id_source_type_source_id_idx" ON "warehouse_stock_reservations"("org_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_stock_reservations_org_id_idempotency_key_key" ON "warehouse_stock_reservations"("org_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "warehouse_stock_reservation_allocations_reservation_id_idx" ON "warehouse_stock_reservation_allocations"("reservation_id");

-- CreateIndex
CREATE INDEX "warehouse_stock_reservation_allocations_stock_balance_id_idx" ON "warehouse_stock_reservation_allocations"("stock_balance_id");

-- CreateIndex
CREATE INDEX "warehouse_layout_versions_org_id_warehouse_site_id_state_idx" ON "warehouse_layout_versions"("org_id", "warehouse_site_id", "state");

-- CreateIndex
CREATE INDEX "warehouse_layout_versions_based_on_version_id_idx" ON "warehouse_layout_versions"("based_on_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_layout_versions_warehouse_site_id_version_no_key" ON "warehouse_layout_versions"("warehouse_site_id", "version_no");

-- CreateIndex
CREATE INDEX "warehouse_tasks_org_id_warehouse_site_id_status_task_type_idx" ON "warehouse_tasks"("org_id", "warehouse_site_id", "status", "task_type");

-- CreateIndex
CREATE INDEX "warehouse_tasks_zone_id_idx" ON "warehouse_tasks"("zone_id");

-- CreateIndex
CREATE INDEX "warehouse_tasks_bin_id_idx" ON "warehouse_tasks"("bin_id");

-- CreateIndex
CREATE INDEX "warehouse_tasks_source_bin_id_idx" ON "warehouse_tasks"("source_bin_id");

-- CreateIndex
CREATE INDEX "warehouse_tasks_target_bin_id_idx" ON "warehouse_tasks"("target_bin_id");

-- CreateIndex
CREATE INDEX "warehouse_tasks_assignee_pool_id_idx" ON "warehouse_tasks"("assignee_pool_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_tasks_org_id_warehouse_site_id_external_key_key" ON "warehouse_tasks"("org_id", "warehouse_site_id", "external_key");

-- CreateIndex
CREATE INDEX "warehouse_exceptions_org_id_warehouse_site_id_status_severi_idx" ON "warehouse_exceptions"("org_id", "warehouse_site_id", "status", "severity");

-- CreateIndex
CREATE INDEX "warehouse_exceptions_zone_id_idx" ON "warehouse_exceptions"("zone_id");

-- CreateIndex
CREATE INDEX "warehouse_exceptions_bin_id_idx" ON "warehouse_exceptions"("bin_id");

-- CreateIndex
CREATE INDEX "warehouse_exceptions_task_id_idx" ON "warehouse_exceptions"("task_id");

-- CreateIndex
CREATE INDEX "warehouse_exceptions_owner_pool_id_idx" ON "warehouse_exceptions"("owner_pool_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_exceptions_org_id_warehouse_site_id_external_key_key" ON "warehouse_exceptions"("org_id", "warehouse_site_id", "external_key");

-- CreateIndex
CREATE INDEX "warehouse_assignee_pools_org_id_warehouse_site_id_pool_type_idx" ON "warehouse_assignee_pools"("org_id", "warehouse_site_id", "pool_type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_assignee_pools_warehouse_site_id_code_key" ON "warehouse_assignee_pools"("warehouse_site_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_task_events_org_id_warehouse_site_id_created_at_idx" ON "warehouse_task_events"("org_id", "warehouse_site_id", "created_at");

-- CreateIndex
CREATE INDEX "warehouse_task_events_task_id_created_at_idx" ON "warehouse_task_events"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "warehouse_exception_events_org_id_warehouse_site_id_created_idx" ON "warehouse_exception_events"("org_id", "warehouse_site_id", "created_at");

-- CreateIndex
CREATE INDEX "warehouse_exception_events_exception_id_created_at_idx" ON "warehouse_exception_events"("exception_id", "created_at");

-- CreateIndex
CREATE INDEX "warehouse_layout_nodes_org_id_warehouse_site_id_layout_vers_idx" ON "warehouse_layout_nodes"("org_id", "warehouse_site_id", "layout_version_id");

-- CreateIndex
CREATE INDEX "warehouse_layout_nodes_zone_id_idx" ON "warehouse_layout_nodes"("zone_id");

-- CreateIndex
CREATE INDEX "warehouse_layout_nodes_bin_id_idx" ON "warehouse_layout_nodes"("bin_id");

-- CreateIndex
CREATE INDEX "warehouse_layout_nodes_parent_node_id_idx" ON "warehouse_layout_nodes"("parent_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_layout_nodes_layout_version_id_domain_type_domain_key" ON "warehouse_layout_nodes"("layout_version_id", "domain_type", "domain_id");

-- CreateIndex
CREATE INDEX "warehouse_operation_documents_org_id_order_id_document_type_idx" ON "warehouse_operation_documents"("org_id", "order_id", "document_type");

-- CreateIndex
CREATE INDEX "warehouse_operation_documents_org_id_warehouse_site_id_post_idx" ON "warehouse_operation_documents"("org_id", "warehouse_site_id", "posted_at");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_operation_documents_org_id_idempotency_key_key" ON "warehouse_operation_documents"("org_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "warehouse_site_read_models_org_id_refreshed_at_idx" ON "warehouse_site_read_models"("org_id", "refreshed_at");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_site_read_models_org_id_warehouse_site_id_key" ON "warehouse_site_read_models"("org_id", "warehouse_site_id");

-- CreateIndex
CREATE INDEX "warehouse_order_read_models_org_id_warehouse_site_id_refres_idx" ON "warehouse_order_read_models"("org_id", "warehouse_site_id", "refreshed_at");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_order_read_models_org_id_order_id_key" ON "warehouse_order_read_models"("org_id", "order_id");

-- CreateIndex
CREATE INDEX "warehouse_outbox_org_id_status_available_at_idx" ON "warehouse_outbox"("org_id", "status", "available_at");

-- CreateIndex
CREATE INDEX "warehouse_outbox_org_id_aggregate_type_aggregate_id_idx" ON "warehouse_outbox"("org_id", "aggregate_type", "aggregate_id");

-- CreateIndex
CREATE INDEX "warehouse_projection_inbox_org_id_consumer_processed_at_idx" ON "warehouse_projection_inbox"("org_id", "consumer", "processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_projection_inbox_org_id_consumer_event_id_key" ON "warehouse_projection_inbox"("org_id", "consumer", "event_id");

-- CreateIndex
CREATE INDEX "warehouse_layout_publish_audit_org_id_warehouse_site_id_cre_idx" ON "warehouse_layout_publish_audit"("org_id", "warehouse_site_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "warehouse_layout_publish_audit_layout_version_id_idx" ON "warehouse_layout_publish_audit"("layout_version_id");

-- CreateIndex
CREATE INDEX "conversations_org_id_idx" ON "conversations"("org_id");

-- CreateIndex
CREATE INDEX "conversation_participants_user_id_idx" ON "conversation_participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key" ON "conversation_participants"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_attachments_message_id_idx" ON "chat_attachments"("message_id");

-- CreateIndex
CREATE INDEX "manual_invoices_org_id_type_idx" ON "manual_invoices"("org_id", "type");

-- CreateIndex
CREATE INDEX "manual_invoices_org_id_created_at_idx" ON "manual_invoices"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "manual_invoices_org_id_archived_at_idx" ON "manual_invoices"("org_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "manual_invoices_org_id_invoice_num_key" ON "manual_invoices"("org_id", "invoice_num");

-- CreateIndex
CREATE INDEX "manual_invoice_items_invoice_id_idx" ON "manual_invoice_items"("invoice_id");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_gaps" ADD CONSTRAINT "accounting_gaps_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_templates" ADD CONSTRAINT "import_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kaspi_connections" ADD CONSTRAINT "kaspi_connections_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kaspi_order_links" ADD CONSTRAINT "kaspi_order_links_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kaspi_order_links" ADD CONSTRAINT "kaspi_order_links_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "kaspi_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_daily_metrics" ADD CONSTRAINT "ad_daily_metrics_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_daily_metrics" ADD CONSTRAINT "ad_daily_metrics_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_permission_overrides" ADD CONSTRAINT "member_permission_overrides_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_requests" ADD CONSTRAINT "membership_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_history" ADD CONSTRAINT "lead_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_activities" ADD CONSTRAINT "deal_activities_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_subtasks" ADD CONSTRAINT "task_subtasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "material_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_tasks" ADD CONSTRAINT "production_tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_tasks" ADD CONSTRAINT "production_tasks_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_attachments" ADD CONSTRAINT "order_attachments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_transfers" ADD CONSTRAINT "order_transfers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_activities" ADD CONSTRAINT "order_activities_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unpaid_alerts" ADD CONSTRAINT "unpaid_alerts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_orders" ADD CONSTRAINT "invoice_orders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_orders" ADD CONSTRAINT "invoice_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_categories" ADD CONSTRAINT "warehouse_categories_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_items" ADD CONSTRAINT "warehouse_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_items" ADD CONSTRAINT "warehouse_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "warehouse_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_items" ADD CONSTRAINT "warehouse_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_items" ADD CONSTRAINT "warehouse_items_product_catalog_id_fkey" FOREIGN KEY ("product_catalog_id") REFERENCES "warehouse_product_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_movements" ADD CONSTRAINT "warehouse_movements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_movements" ADD CONSTRAINT "warehouse_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "warehouse_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_reservations" ADD CONSTRAINT "warehouse_reservations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_reservations" ADD CONSTRAINT "warehouse_reservations_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "warehouse_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transit_zones" ADD CONSTRAINT "warehouse_transit_zones_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transit_entries" ADD CONSTRAINT "warehouse_transit_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transit_entries" ADD CONSTRAINT "warehouse_transit_entries_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_transit_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transit_entries" ADD CONSTRAINT "warehouse_transit_entries_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "warehouse_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bom_lines" ADD CONSTRAINT "warehouse_bom_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bom_lines" ADD CONSTRAINT "warehouse_bom_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "warehouse_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_alerts" ADD CONSTRAINT "warehouse_alerts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_alerts" ADD CONSTRAINT "warehouse_alerts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "warehouse_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_lots" ADD CONSTRAINT "warehouse_lots_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_lots" ADD CONSTRAINT "warehouse_lots_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "warehouse_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_field_definitions" ADD CONSTRAINT "warehouse_field_definitions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_field_options" ADD CONSTRAINT "warehouse_field_options_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "warehouse_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_product_catalog" ADD CONSTRAINT "warehouse_product_catalog_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_product_photos" ADD CONSTRAINT "warehouse_product_photos_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "warehouse_product_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_product_fields" ADD CONSTRAINT "warehouse_product_fields_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "warehouse_product_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_product_fields" ADD CONSTRAINT "warehouse_product_fields_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "warehouse_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_sites" ADD CONSTRAINT "warehouse_sites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_sites" ADD CONSTRAINT "warehouse_sites_published_layout_version_id_fkey" FOREIGN KEY ("published_layout_version_id") REFERENCES "warehouse_layout_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_parent_zone_id_fkey" FOREIGN KEY ("parent_zone_id") REFERENCES "warehouse_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_aisles" ADD CONSTRAINT "warehouse_aisles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_aisles" ADD CONSTRAINT "warehouse_aisles_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_aisles" ADD CONSTRAINT "warehouse_aisles_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_racks" ADD CONSTRAINT "warehouse_racks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_racks" ADD CONSTRAINT "warehouse_racks_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_racks" ADD CONSTRAINT "warehouse_racks_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_racks" ADD CONSTRAINT "warehouse_racks_aisle_id_fkey" FOREIGN KEY ("aisle_id") REFERENCES "warehouse_aisles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_shelves" ADD CONSTRAINT "warehouse_shelves_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "warehouse_racks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_aisle_id_fkey" FOREIGN KEY ("aisle_id") REFERENCES "warehouse_aisles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "warehouse_racks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_shelf_id_fkey" FOREIGN KEY ("shelf_id") REFERENCES "warehouse_shelves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_variants" ADD CONSTRAINT "warehouse_variants_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_variants" ADD CONSTRAINT "warehouse_variants_product_catalog_id_fkey" FOREIGN KEY ("product_catalog_id") REFERENCES "warehouse_product_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_ledger_events" ADD CONSTRAINT "warehouse_stock_ledger_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_ledger_events" ADD CONSTRAINT "warehouse_stock_ledger_events_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_ledger_events" ADD CONSTRAINT "warehouse_stock_ledger_events_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "warehouse_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_ledger_events" ADD CONSTRAINT "warehouse_stock_ledger_events_from_bin_id_fkey" FOREIGN KEY ("from_bin_id") REFERENCES "warehouse_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_ledger_events" ADD CONSTRAINT "warehouse_stock_ledger_events_to_bin_id_fkey" FOREIGN KEY ("to_bin_id") REFERENCES "warehouse_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_balances" ADD CONSTRAINT "warehouse_stock_balances_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_balances" ADD CONSTRAINT "warehouse_stock_balances_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_balances" ADD CONSTRAINT "warehouse_stock_balances_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "warehouse_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_balances" ADD CONSTRAINT "warehouse_stock_balances_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_reservations" ADD CONSTRAINT "warehouse_stock_reservations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_reservations" ADD CONSTRAINT "warehouse_stock_reservations_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_reservations" ADD CONSTRAINT "warehouse_stock_reservations_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "warehouse_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_reservation_allocations" ADD CONSTRAINT "warehouse_stock_reservation_allocations_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "warehouse_stock_reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_reservation_allocations" ADD CONSTRAINT "warehouse_stock_reservation_allocations_stock_balance_id_fkey" FOREIGN KEY ("stock_balance_id") REFERENCES "warehouse_stock_balances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_reservation_allocations" ADD CONSTRAINT "warehouse_stock_reservation_allocations_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_layout_versions" ADD CONSTRAINT "warehouse_layout_versions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_layout_versions" ADD CONSTRAINT "warehouse_layout_versions_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_layout_versions" ADD CONSTRAINT "warehouse_layout_versions_based_on_version_id_fkey" FOREIGN KEY ("based_on_version_id") REFERENCES "warehouse_layout_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_tasks" ADD CONSTRAINT "warehouse_tasks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_tasks" ADD CONSTRAINT "warehouse_tasks_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_tasks" ADD CONSTRAINT "warehouse_tasks_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_tasks" ADD CONSTRAINT "warehouse_tasks_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_tasks" ADD CONSTRAINT "warehouse_tasks_source_bin_id_fkey" FOREIGN KEY ("source_bin_id") REFERENCES "warehouse_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_tasks" ADD CONSTRAINT "warehouse_tasks_target_bin_id_fkey" FOREIGN KEY ("target_bin_id") REFERENCES "warehouse_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_tasks" ADD CONSTRAINT "warehouse_tasks_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "warehouse_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_tasks" ADD CONSTRAINT "warehouse_tasks_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "warehouse_stock_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_tasks" ADD CONSTRAINT "warehouse_tasks_assignee_pool_id_fkey" FOREIGN KEY ("assignee_pool_id") REFERENCES "warehouse_assignee_pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_exceptions" ADD CONSTRAINT "warehouse_exceptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_exceptions" ADD CONSTRAINT "warehouse_exceptions_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_exceptions" ADD CONSTRAINT "warehouse_exceptions_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_exceptions" ADD CONSTRAINT "warehouse_exceptions_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_exceptions" ADD CONSTRAINT "warehouse_exceptions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "warehouse_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_exceptions" ADD CONSTRAINT "warehouse_exceptions_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "warehouse_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_exceptions" ADD CONSTRAINT "warehouse_exceptions_owner_pool_id_fkey" FOREIGN KEY ("owner_pool_id") REFERENCES "warehouse_assignee_pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_assignee_pools" ADD CONSTRAINT "warehouse_assignee_pools_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_assignee_pools" ADD CONSTRAINT "warehouse_assignee_pools_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_assignee_pools" ADD CONSTRAINT "warehouse_assignee_pools_escalation_pool_id_fkey" FOREIGN KEY ("escalation_pool_id") REFERENCES "warehouse_assignee_pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_task_events" ADD CONSTRAINT "warehouse_task_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_task_events" ADD CONSTRAINT "warehouse_task_events_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_task_events" ADD CONSTRAINT "warehouse_task_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "warehouse_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_exception_events" ADD CONSTRAINT "warehouse_exception_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_exception_events" ADD CONSTRAINT "warehouse_exception_events_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_exception_events" ADD CONSTRAINT "warehouse_exception_events_exception_id_fkey" FOREIGN KEY ("exception_id") REFERENCES "warehouse_exceptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_layout_nodes" ADD CONSTRAINT "warehouse_layout_nodes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_layout_nodes" ADD CONSTRAINT "warehouse_layout_nodes_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_layout_nodes" ADD CONSTRAINT "warehouse_layout_nodes_layout_version_id_fkey" FOREIGN KEY ("layout_version_id") REFERENCES "warehouse_layout_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_layout_nodes" ADD CONSTRAINT "warehouse_layout_nodes_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_layout_nodes" ADD CONSTRAINT "warehouse_layout_nodes_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_layout_nodes" ADD CONSTRAINT "warehouse_layout_nodes_parent_node_id_fkey" FOREIGN KEY ("parent_node_id") REFERENCES "warehouse_layout_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_operation_documents" ADD CONSTRAINT "warehouse_operation_documents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_operation_documents" ADD CONSTRAINT "warehouse_operation_documents_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_site_read_models" ADD CONSTRAINT "warehouse_site_read_models_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_site_read_models" ADD CONSTRAINT "warehouse_site_read_models_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_order_read_models" ADD CONSTRAINT "warehouse_order_read_models_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_order_read_models" ADD CONSTRAINT "warehouse_order_read_models_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_outbox" ADD CONSTRAINT "warehouse_outbox_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_outbox" ADD CONSTRAINT "warehouse_outbox_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_projection_inbox" ADD CONSTRAINT "warehouse_projection_inbox_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_projection_inbox" ADD CONSTRAINT "warehouse_projection_inbox_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_layout_publish_audit" ADD CONSTRAINT "warehouse_layout_publish_audit_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_layout_publish_audit" ADD CONSTRAINT "warehouse_layout_publish_audit_warehouse_site_id_fkey" FOREIGN KEY ("warehouse_site_id") REFERENCES "warehouse_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_invoices" ADD CONSTRAINT "manual_invoices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_invoice_items" ADD CONSTRAINT "manual_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "manual_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
