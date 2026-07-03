-- =============================================================
-- RASTREIO DE ABERTURA/CLIQUE DE E-MAIL
-- Os contadores emails.open_count/click_count sempre existiram na UI,
-- mas nada os alimentava. A função email-track (pública) chama esta RPC.
-- =============================================================

CREATE OR REPLACE FUNCTION public.track_email_event(p_email_id uuid, p_event text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event = 'open' THEN
    UPDATE public.emails
    SET open_count = COALESCE(open_count, 0) + 1,
        last_opened_at = now()
    WHERE id = p_email_id;
  ELSIF p_event = 'click' THEN
    UPDATE public.emails
    SET click_count = COALESCE(click_count, 0) + 1,
        last_clicked_at = now()
    WHERE id = p_email_id;
  END IF;
END;
$$;

-- Só as edge functions (service role) chamam — remove acesso público direto
REVOKE EXECUTE ON FUNCTION public.track_email_event(uuid, text) FROM anon, authenticated;
