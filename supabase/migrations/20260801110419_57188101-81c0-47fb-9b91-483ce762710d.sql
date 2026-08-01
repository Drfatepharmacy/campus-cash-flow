ALTER TABLE public.payment_ledger DISABLE TRIGGER payment_ledger_append_only;
ALTER TABLE public.audit_logs DISABLE TRIGGER audit_logs_append_only;

DELETE FROM public.audit_logs WHERE entity = 'transaction' AND entity_id IN (
  SELECT id::text FROM public.transactions WHERE reference LIKE 'TEST-HARDEN-%'
);
DELETE FROM public.payment_ledger WHERE reference LIKE 'TEST-HARDEN-%';
DELETE FROM public.receipts WHERE transaction_id IN (
  SELECT id FROM public.transactions WHERE reference LIKE 'TEST-HARDEN-%'
);
DELETE FROM public.transactions WHERE reference LIKE 'TEST-HARDEN-%';

ALTER TABLE public.payment_ledger ENABLE TRIGGER payment_ledger_append_only;
ALTER TABLE public.audit_logs ENABLE TRIGGER audit_logs_append_only;