
ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_spam boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_trashed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS importance text;

CREATE INDEX IF NOT EXISTS emails_org_folder_idx ON public.emails (org_id, is_archived, is_spam, is_trashed, direction, created_at DESC);
