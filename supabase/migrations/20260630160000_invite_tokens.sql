CREATE TABLE IF NOT EXISTS public.invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('pilgrim', 'agent', 'admin')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invite_tokens_token_active_idx
  ON public.invite_tokens (token)
  WHERE used = false;

CREATE INDEX IF NOT EXISTS invite_tokens_email_idx
  ON public.invite_tokens (email);

ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;
