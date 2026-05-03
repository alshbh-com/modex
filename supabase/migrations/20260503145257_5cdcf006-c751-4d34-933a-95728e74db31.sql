ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS office_account_closed boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS office_account_closed_at timestamp with time zone;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS office_account_closed_by uuid;