

# Plan: Setup Database Schema on New Supabase Project

## The Problem
You connected a new Supabase project (`modex`) but it has no tables. The original project had base tables created before migration tracking started, so the migration files only contain incremental changes. We need to create all tables from scratch.

## What I Will Do

Create a single comprehensive database migration that builds the entire schema in the correct order:

### Step 1: Run one migration with ALL tables and functions

The migration will create (in order):

1. **Enum & helper functions**: `app_role` enum, `has_role()`, `is_owner_or_admin()` functions
2. **Base tables**:
   - `profiles` (id, full_name, phone, login_code, address, notes, salary, coverage_areas, office_id)
   - `offices` (id, name, specialty, owner_name, owner_phone, address, notes, can_add_orders)
   - `companies` (id, name, agreement_price)
   - `order_statuses` (id, name, color, sort_order, is_fixed)
   - `products` (id, name, quantity)
   - `user_roles` (id, user_id, role)
   - `activity_logs` (id, user_id, action, details)
   - `orders` (all columns including barcode, tracking_id, customer fields, price fields, status_id, office_id, courier_id, company_id, product_id, is_closed, is_settled, priority, etc.)
3. **Secondary tables**: order_notes, advances, courier_bonuses, delivery_prices, office_payments, user_permissions, diaries, diary_orders, expenses, cash_flow_entries, app_settings, courier_locations, messages, courier_collections, office_daily_closings
4. **Sequences**: barcode_numeric_seq
5. **Triggers**: generate_barcode, generate_diary_number, auto_create_diary_for_order
6. **Functions**: log_activity, cleanup_old_activity_logs, cleanup_old_diaries, nextval_barcode
7. **RLS policies** for all tables
8. **Default data**: 11 fixed order statuses

### Step 2: Deploy edge function
Re-deploy the `auth-login` edge function (already in code, will deploy automatically).

### Step 3: Fix TypeScript errors
After the migration runs and types regenerate, the build errors will resolve automatically since the types.ts file gets regenerated from the actual database schema.

## Technical Notes
- All tables use UUID primary keys with `gen_random_uuid()`
- RLS is enabled on all tables
- The `profiles` table uses `auth.users.id` as its primary key (created via trigger on auth.users)
- The edge function handles login, user creation, password changes, and deletion using the service role key

