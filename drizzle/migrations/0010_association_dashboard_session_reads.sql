GRANT SELECT ON public.transactions TO authenticated;
GRANT SELECT ON public.settlements TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.association_financial_accounts TO authenticated;
GRANT SELECT ON public.approval_requests TO authenticated;

CREATE POLICY "association officers read scoped transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  public.has_assoc_permission(auth.uid(), association_id, 'finance.view')
  OR public.has_assoc_permission(auth.uid(), association_id, 'transactions.view')
);

CREATE POLICY "association officers read scoped settlements"
ON public.settlements
FOR SELECT
TO authenticated
USING (
  public.has_assoc_permission(auth.uid(), association_id, 'settlement.view')
);

CREATE POLICY "association officers read member profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.association_memberships AS membership
    WHERE membership.user_id = profiles.id
      AND public.has_assoc_permission(auth.uid(), membership.association_id, 'members.view')
  )
);