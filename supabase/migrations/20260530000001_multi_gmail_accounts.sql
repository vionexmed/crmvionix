-- Multi-Gmail account support
-- Adds label/purpose to email_connections and synced_from to emails

-- 1. Add label and purpose to email_connections
ALTER TABLE public.email_connections
  ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'Principal',
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'sales'
    CHECK (purpose IN ('sales', 'marketing', 'support', 'general'));

-- 2. Drop the old unique constraint (user_id, provider) and add (user_id, provider, email_address)
--    This allows multiple Gmail accounts per user
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_connections_user_id_provider_key'
  ) THEN
    ALTER TABLE public.email_connections
      DROP CONSTRAINT email_connections_user_id_provider_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_connections_user_provider_email_key'
  ) THEN
    ALTER TABLE public.email_connections
      ADD CONSTRAINT email_connections_user_provider_email_key
      UNIQUE (user_id, provider, email_address);
  END IF;
END $$;

-- 3. Add synced_from to emails table for filtering by source account
ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS synced_from text;

-- Index for fast filtering by source account
CREATE INDEX IF NOT EXISTS idx_emails_synced_from ON public.emails(org_id, synced_from);
