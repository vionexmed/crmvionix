
-- Add attachments metadata to emails
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Public storage bucket for email signature logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-logos', 'email-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "email_logos_public_read" ON storage.objects;
CREATE POLICY "email_logos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'email-logos');

DROP POLICY IF EXISTS "email_logos_authed_write" ON storage.objects;
CREATE POLICY "email_logos_authed_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'email-logos');

DROP POLICY IF EXISTS "email_logos_authed_update" ON storage.objects;
CREATE POLICY "email_logos_authed_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'email-logos');

DROP POLICY IF EXISTS "email_logos_authed_delete" ON storage.objects;
CREATE POLICY "email_logos_authed_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'email-logos');
