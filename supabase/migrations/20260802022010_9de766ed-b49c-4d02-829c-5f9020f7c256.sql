ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_student_id_profiles_fkey
  FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;