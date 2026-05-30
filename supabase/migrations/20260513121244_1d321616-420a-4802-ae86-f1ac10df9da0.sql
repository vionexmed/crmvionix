
CREATE TABLE IF NOT EXISTS public.gmail_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid NOT NULL,
  email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

ALTER TABLE public.gmail_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own gmail tokens" ON public.gmail_oauth_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users delete own gmail tokens" ON public.gmail_oauth_tokens
  FOR DELETE USING (auth.uid() = user_id);
