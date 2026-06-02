-- Keep billing and rate-limit internals server-side only.

ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.billing_accounts FROM anon, authenticated;
REVOKE ALL ON TABLE public.billing_invoices FROM anon, authenticated;
REVOKE ALL ON TABLE public.billing_plans FROM anon, authenticated;
REVOKE ALL ON TABLE public.billing_subscriptions FROM anon, authenticated;
REVOKE ALL ON TABLE public.billing_webhook_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.request_rate_limits FROM anon, authenticated;

GRANT ALL ON TABLE public.billing_accounts TO service_role;
GRANT ALL ON TABLE public.billing_invoices TO service_role;
GRANT ALL ON TABLE public.billing_plans TO service_role;
GRANT ALL ON TABLE public.billing_subscriptions TO service_role;
GRANT ALL ON TABLE public.billing_webhook_events TO service_role;
GRANT ALL ON TABLE public.request_rate_limits TO service_role;

REVOKE ALL ON FUNCTION public.consume_request_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_request_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  TO service_role;
