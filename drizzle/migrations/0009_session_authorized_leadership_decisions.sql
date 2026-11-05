CREATE OR REPLACE FUNCTION public.decide_association_nomination(_id uuid,_decision text,_reason text DEFAULT NULL,_term_months integer DEFAULT 12)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=auth.uid(); n public.leadership_nominations; t uuid; p uuid; ending timestamptz;
BEGIN
 IF u IS NULL OR NOT public.is_super_admin(u) THEN RAISE EXCEPTION 'Super Admin only' USING ERRCODE='42501'; END IF;
 IF _decision IS NULL OR _decision NOT IN ('approved','rejected') OR _term_months IS NULL OR _term_months NOT BETWEEN 1 AND 48 OR length(coalesce(_reason,''))>500 THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 SELECT association_id INTO p FROM public.leadership_nominations WHERE id=_id;
 PERFORM 1 FROM public.associations WHERE id=p FOR UPDATE;
 SELECT * INTO n FROM public.leadership_nominations WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR n.status NOT IN ('submitted','under_review') THEN RAISE EXCEPTION 'Nomination already decided or unavailable'; END IF;
 IF _decision='approved' THEN
  IF EXISTS(SELECT 1 FROM public.associations WHERE id=n.association_id AND status IN ('suspended','archived','rejected')) THEN RAISE EXCEPTION 'Association unavailable'; END IF;
  p:=NULL;
  SELECT id INTO p FROM public.profiles WHERE lower(email)=lower(n.nominee_email) LIMIT 1;
  IF p IS NULL THEN RAISE EXCEPTION 'The nominee must sign up with the nominated email first'; END IF;
  ending:=now()+make_interval(months=>_term_months);
  SELECT id INTO t FROM public.executive_terms WHERE association_id=n.association_id AND is_current FOR UPDATE;
  IF t IS NULL THEN INSERT INTO public.executive_terms(association_id,label,created_by,ends_at) VALUES(n.association_id,'Tenure '||extract(year from now())::text,u,ending) RETURNING id INTO t; END IF;
  UPDATE public.association_role_assignments SET status='revoked',ends_at=now(),revocation_reason='Replaced by approved nomination' WHERE association_id=n.association_id AND role_key=n.role_key AND status='active';
  INSERT INTO public.association_role_assignments(association_id,user_id,role_key,term_id,status,approved_by,approved_at,starts_at,ends_at) VALUES(n.association_id,p,n.role_key,t,'active',u,now(),now(),ending);
  INSERT INTO public.association_memberships(association_id,user_id,status,joined_at) VALUES(n.association_id,p,'active',now()) ON CONFLICT(association_id,user_id) DO UPDATE SET status='active';
 END IF;
 UPDATE public.leadership_nominations SET status=_decision::public.nomination_status,decided_by=u,decided_at=now(),decision_reason=_reason,nominee_user_id=CASE WHEN _decision='approved' THEN p ELSE nominee_user_id END,term_id=CASE WHEN _decision='approved' THEN t ELSE term_id END WHERE id=n.id;
 INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,association_id,metadata) VALUES(u,CASE WHEN _decision='approved' THEN 'executive.approved' ELSE 'executive.nomination_rejected' END,'leadership_nomination',n.id::text,n.association_id,jsonb_build_object('role',n.role_key,'reason',_reason));
 RETURN jsonb_build_object('ok',true,'activated',_decision='approved');
END $$;
REVOKE ALL ON FUNCTION public.decide_association_nomination(uuid,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decide_association_nomination(uuid,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_role_assignments()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer;
BEGIN
 IF auth.role()<>'service_role' AND (auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid())) THEN RAISE EXCEPTION 'Super Admin only' USING ERRCODE='42501'; END IF;
 UPDATE public.association_role_assignments SET status='expired',updated_at=now() WHERE status='active' AND ends_at IS NOT NULL AND ends_at<=now();
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.expire_role_assignments() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.expire_role_assignments() TO authenticated,service_role;