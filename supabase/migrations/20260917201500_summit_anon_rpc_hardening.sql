-- Ordering placeholder.
-- The executable coordinator-RPC hardening is intentionally applied by the later
-- 20260917220000_summit_anon_rpc_hardening migration, after the production
-- hardening migration creates the functions it protects.
begin;
commit;
