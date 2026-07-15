
DROP POLICY IF EXISTS pr_read_signed ON public.payment_requests;

CREATE POLICY pr_read_eligible ON public.payment_requests
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'faculty_rep'::app_role)
  OR public.has_role(auth.uid(), 'department_rep'::app_role)
  OR public.has_role(auth.uid(), 'bank_runner'::app_role)
  OR (
    active = true
    AND (target_faculty_id IS NULL OR target_faculty_id = (SELECT faculty_id FROM public.profiles WHERE id = auth.uid()))
    AND (target_department_id IS NULL OR target_department_id = (SELECT department_id FROM public.profiles WHERE id = auth.uid()))
    AND (target_level IS NULL OR target_level = (SELECT level FROM public.profiles WHERE id = auth.uid()))
  )
);
