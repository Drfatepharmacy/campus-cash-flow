CREATE OR REPLACE FUNCTION public.create_association_application(_details jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE u uuid := auth.uid(); a public.associations; s text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
 IF length(trim(coalesce(_details->>'name',''))) NOT BETWEEN 3 AND 160 OR length(trim(coalesce(_details->>'institution',''))) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Invalid association details'; END IF;
 s := left(trim(both '-' from regexp_replace(lower(coalesce(nullif(_details->>'short_name',''),_details->>'name')), '[^a-z0-9]+', '-', 'g')),60) || '-' || replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.associations(name,short_name,type,institution,campus_id,faculty_id,department_id,official_email,official_phone,description,session_year,logo_url,banner_url,slug,status,created_by,financials_enabled)
 VALUES(trim(_details->>'name'),_details->>'short_name',(_details->>'type')::public.association_type,trim(_details->>'institution'),(_details->>'campus_id')::uuid,(_details->>'faculty_id')::uuid,(_details->>'department_id')::uuid,_details->>'official_email',_details->>'official_phone',_details->>'description',_details->>'session_year',_details->>'logo_url',_details->>'banner_url',s,'draft',u,false) RETURNING * INTO a;
 INSERT INTO public.association_memberships(association_id,user_id,status) VALUES(a.id,u,'pending');
 INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,association_id,metadata) VALUES(u,'association.created','association',a.id::text,a.id,jsonb_build_object('name',a.name));
 RETURN jsonb_build_object('id',a.id,'slug',a.slug);
END $$;
REVOKE ALL ON FUNCTION public.create_association_application(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_association_application(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.nominate_association_executive(_association_id uuid,_role_key text,_name text,_email text,_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE u uuid := auth.uid(); a public.associations; n uuid; p uuid;
BEGIN
 SELECT * INTO a FROM public.associations WHERE id=_association_id FOR UPDATE;
 IF u IS NULL OR NOT FOUND OR NOT (a.created_by=u OR public.has_assoc_permission(u,a.id,'executives.nominate')) THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
 IF a.status IN ('suspended','archived') THEN RAISE EXCEPTION 'Association unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.association_roles WHERE key=_role_key) OR length(trim(coalesce(_name,''))) NOT BETWEEN 2 AND 120 OR length(coalesce(_email,''))>255 OR _email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(coalesce(_notes,''))>1000 THEN RAISE EXCEPTION 'Invalid nomination'; END IF;
 SELECT id INTO p FROM public.profiles WHERE lower(email)=lower(trim(_email)) LIMIT 1;
 INSERT INTO public.leadership_nominations(association_id,role_key,nominee_name,nominee_email,nominee_user_id,notes,status,submitted_by) VALUES(a.id,_role_key,trim(_name),lower(trim(_email)),p,_notes,'submitted',u) RETURNING id INTO n;
 INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,association_id,metadata) VALUES(u,'executive.nominated','leadership_nomination',n::text,a.id,jsonb_build_object('role',_role_key));
 RETURN jsonb_build_object('ok',true,'nominee_has_account',p IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.nominate_association_executive(uuid,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.nominate_association_executive(uuid,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_association_application(_association_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE u uuid := auth.uid(); a public.associations;
BEGIN
 SELECT * INTO a FROM public.associations WHERE id=_association_id FOR UPDATE;
 IF u IS NULL OR NOT FOUND OR NOT (a.created_by=u OR public.has_assoc_permission(u,a.id,'association.manage')) THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
 IF a.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'Application cannot be submitted in this state'; END IF;
 IF coalesce(a.official_email,'')='' THEN RAISE EXCEPTION 'An official email is required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.leadership_nominations WHERE association_id=a.id AND role_key='president' AND status IN ('submitted','under_review')) THEN RAISE EXCEPTION 'Nominate a proposed President first'; END IF;
 UPDATE public.associations SET status='submitted',status_reason=NULL,financials_enabled=false WHERE id=a.id;
 INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,association_id,metadata) VALUES(u,CASE WHEN a.status='rejected' THEN 'association.resubmitted' ELSE 'association.submitted' END,'association',a.id::text,a.id,jsonb_build_object('previous_status',a.status));
 RETURN jsonb_build_object('ok',true,'was_rejected',a.status='rejected');
END $$;
REVOKE ALL ON FUNCTION public.submit_association_application(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_association_application(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_association_application(_association_id uuid,_term_months integer DEFAULT 12)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE u uuid := auth.uid(); a public.associations; t uuid; n record; p uuid; assigned jsonb := '[]'; pending jsonb := '[]'; ending timestamptz;
BEGIN
 IF u IS NULL OR NOT public.is_super_admin(u) THEN RAISE EXCEPTION 'Super Admin only' USING ERRCODE='42501'; END IF;
 IF _term_months IS NULL OR _term_months NOT BETWEEN 1 AND 48 THEN RAISE EXCEPTION 'Invalid tenure'; END IF;
 SELECT * INTO a FROM public.associations WHERE id=_association_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Association not found'; END IF;
 IF a.status NOT IN ('submitted','under_review','verified','active') THEN RAISE EXCEPTION 'Application is not ready for approval'; END IF;
 IF a.status='active' THEN RETURN jsonb_build_object('association_id',a.id,'activated',false,'assigned',assigned,'pending_signup',pending); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.leadership_nominations WHERE association_id=a.id AND role_key='president' AND status IN ('submitted','under_review')) THEN RAISE EXCEPTION 'A proposed President is required'; END IF;
 ending := now()+make_interval(months=>_term_months);
 SELECT id INTO t FROM public.executive_terms WHERE association_id=a.id AND is_current=true FOR UPDATE;
 IF t IS NULL THEN INSERT INTO public.executive_terms(association_id,label,session_year,created_by,ends_at) VALUES(a.id,'Tenure '||extract(year from now())::text,coalesce(a.session_year,extract(year from now())::text),u,ending) RETURNING id INTO t; END IF;
 FOR n IN SELECT * FROM public.leadership_nominations WHERE association_id=a.id AND status IN ('submitted','under_review') ORDER BY created_at,id FOR UPDATE LOOP
  p := NULL;
  SELECT id INTO p FROM public.profiles WHERE lower(email)=lower(n.nominee_email) LIMIT 1;
  IF p IS NULL THEN pending:=pending||jsonb_build_array(jsonb_build_object('role_key',n.role_key,'email',n.nominee_email,'name',n.nominee_name)); CONTINUE; END IF;
  UPDATE public.association_role_assignments SET status='revoked',ends_at=now(),revocation_reason='Replaced by approved nomination' WHERE association_id=a.id AND role_key=n.role_key AND status='active';
  INSERT INTO public.association_role_assignments(association_id,user_id,role_key,term_id,status,approved_by,approved_at,starts_at,ends_at) VALUES(a.id,p,n.role_key,t,'active',u,now(),now(),ending);
  INSERT INTO public.association_memberships(association_id,user_id,status,joined_at) VALUES(a.id,p,'active',now()) ON CONFLICT(association_id,user_id) DO UPDATE SET status='active';
  UPDATE public.leadership_nominations SET status='approved',decided_by=u,decided_at=now(),nominee_user_id=p,term_id=t WHERE id=n.id;
  assigned:=assigned||jsonb_build_array(jsonb_build_object('role_key',n.role_key,'user_id',p));
  INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,association_id,metadata) VALUES(u,'executive.approved','leadership_nomination',n.id::text,a.id,jsonb_build_object('role',n.role_key,'user_id',p,'ends_at',ending));
 END LOOP;
 IF a.created_by IS NOT NULL THEN INSERT INTO public.association_memberships(association_id,user_id,status,joined_at) VALUES(a.id,a.created_by,'active',now()) ON CONFLICT(association_id,user_id) DO UPDATE SET status='active'; END IF;
 UPDATE public.associations SET status='active',status_reason=NULL,reviewed_by=u,reviewed_at=now(),financials_enabled=false WHERE id=a.id;
 INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,association_id,metadata) VALUES(u,'association.approved','association',a.id::text,a.id,jsonb_build_object('previous_status',a.status,'assigned',assigned,'pending_signup',pending));
 RETURN jsonb_build_object('association_id',a.id,'activated',true,'assigned',assigned,'pending_signup',pending);
END $$;
REVOKE ALL ON FUNCTION public.approve_association_application(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_association_application(uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_association_application(_association_id uuid,_status text,_reason text DEFAULT NULL,_financials_enabled boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE u uuid := auth.uid(); a public.associations;
BEGIN
 IF u IS NULL OR NOT public.is_super_admin(u) THEN RAISE EXCEPTION 'Super Admin only' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.associations WHERE id=_association_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Association not found'; END IF;
 IF NOT ((_status='under_review' AND a.status='submitted') OR (_status='verified' AND a.status='under_review') OR (_status='rejected' AND a.status IN ('submitted','under_review','verified')) OR (_status='suspended' AND a.status='active') OR (_status='active' AND a.status IN ('active','suspended')) OR (_status='archived' AND a.status IN ('active','suspended')) ) THEN RAISE EXCEPTION 'Invalid lifecycle transition'; END IF;
 IF _status IN ('rejected','suspended') AND length(trim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
 IF length(coalesce(_reason,''))>500 THEN RAISE EXCEPTION 'Reason too long'; END IF;
 IF _financials_enabled=true AND (_status<>'active' OR NOT EXISTS(SELECT 1 FROM public.association_role_assignments r JOIN public.association_roles k ON k.key=r.role_key WHERE r.association_id=a.id AND k.is_head AND r.status='active' AND r.starts_at<=now() AND r.ends_at>now())) THEN RAISE EXCEPTION 'An approved current Head is required for financial activation'; END IF;
 UPDATE public.associations SET status=_status::public.association_status,status_reason=_reason,reviewed_by=u,reviewed_at=now(),financials_enabled=CASE WHEN _status IN ('rejected','suspended','archived') THEN false ELSE coalesce(_financials_enabled,a.financials_enabled) END WHERE id=a.id;
 INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,association_id,metadata) VALUES(u,'association.'||_status,'association',a.id::text,a.id,jsonb_build_object('previous_status',a.status,'reason',_reason));
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.review_association_application(uuid,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_association_application(uuid,text,text,boolean) TO authenticated;

CREATE POLICY "super admin reads audit history" ON public.audit_logs FOR SELECT TO authenticated USING(public.is_super_admin(auth.uid()));
GRANT SELECT ON public.associations,public.association_memberships,public.association_role_assignments,public.executive_terms,public.leadership_nominations,public.association_financial_accounts,public.profiles,public.user_roles,public.audit_logs TO authenticated;