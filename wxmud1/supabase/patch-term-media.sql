-- ============================================================
-- 词条正文：Markdown + 配图
-- ------------------------------------------------------------
-- 1) term_upsert / term_create 正文上限 2000 -> 8000
-- 2) 配图桶 term-media（公开读，匿名可传，单张 2MB，仅图片）
-- 函数体取自线上实际定义，可重复执行
-- ============================================================

CREATE OR REPLACE FUNCTION public.term_upsert(p_name text, p_body text, p_nick text DEFAULT '无名侠客'::text, p_visitor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name  text := btrim(coalesce(p_name, ''));
  v_body  text := btrim(coalesce(p_body, ''));
  v_nick  text := left(btrim(coalesce(nullif(btrim(coalesce(p_nick, '')), ''), '无名侠客')), 20);
  v_recent int;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 12 then
    return jsonb_build_object('ok', false, 'error', '词条名需 2–12 字');
  end if;
  if char_length(v_body) < 2 then
    return jsonb_build_object('ok', false, 'error', '再写详细一点');
  end if;
  if char_length(v_body) > 8000 then
    return jsonb_build_object('ok', false, 'error', '内容超过 8000 字');
  end if;

  if p_visitor is not null then
    select count(*) into v_recent from public.term_revisions
     where visitor_id = p_visitor and created_at > now() - interval '1 minute';
    if v_recent >= 5 then
      return jsonb_build_object('ok', false, 'error', '写得太快了，歇一分钟再来');
    end if;
  end if;

  insert into public.terms (name, body, filled, editor, updated_at)
  values (v_name, v_body, true, v_nick, now())
  on conflict (name) do update
    set body = excluded.body, filled = true, editor = excluded.editor, updated_at = now();

  insert into public.term_revisions (name, body, nick, visitor_id)
  values (v_name, v_body, v_nick, p_visitor);

  return jsonb_build_object('ok', true, 'name', v_name, 'body', v_body, 'filled', true, 'editor', v_nick);
end $function$;

CREATE OR REPLACE FUNCTION public.term_create(p_name text, p_cat text DEFAULT 'other'::text, p_nick text DEFAULT '无名侠客'::text, p_body text DEFAULT ''::text, p_visitor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_cat  text := coalesce(nullif(btrim(coalesce(p_cat, '')), ''), 'other');
  v_nick text := left(btrim(coalesce(nullif(btrim(coalesce(p_nick, '')), ''), '无名侠客')), 20);
  v_body text := btrim(coalesce(p_body, ''));
  v_recent int;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 12 then
    return jsonb_build_object('ok', false, 'error', '词条名需 2–12 字');
  end if;
  if v_name ~ '\s' then
    return jsonb_build_object('ok', false, 'error', '词条名里不要带空格');
  end if;
  if v_cat not in ('sect', 'skill', 'equip', 'place', 'stat', 'other') then
    v_cat := 'other';
  end if;
  if char_length(v_body) > 8000 then
    return jsonb_build_object('ok', false, 'error', '内容超过 8000 字');
  end if;

  if exists (select 1 from public.terms where name = v_name) then
    return jsonb_build_object('ok', false, 'error', '这个词条已经有了', 'exists', true);
  end if;

  if p_visitor is not null then
    select count(*) into v_recent
      from public.term_revisions
     where visitor_id = p_visitor and created_at > now() - interval '1 minute';
    if v_recent >= 5 then
      return jsonb_build_object('ok', false, 'error', '建得太快了，歇一分钟再来');
    end if;
    -- 同一访客一天最多新建 10 条，防止刷空白条目
    select count(*) into v_recent
      from public.terms
     where created_at > now() - interval '1 day'
       and name in (select r.name from public.term_revisions r where r.visitor_id = p_visitor);
    if v_recent >= 10 then
      return jsonb_build_object('ok', false, 'error', '今天新建的词条已经够多了');
    end if;
  end if;

  insert into public.terms (name, cat, body, filled, editor, updated_at)
  values (v_name, v_cat, v_body, char_length(v_body) >= 2, case when char_length(v_body) >= 2 then v_nick else '' end, now())
  on conflict (name) do nothing;

  if char_length(v_body) >= 2 then
    insert into public.term_revisions (name, body, nick, visitor_id)
    values (v_name, v_body, v_nick, p_visitor);
  end if;

  return jsonb_build_object('ok', true, 'name', v_name, 'cat', v_cat,
                            'filled', char_length(v_body) >= 2, 'editor', v_nick);
end;
$function$;


revoke all on function public.term_upsert(text, text, text, uuid) from public;
grant execute on function public.term_upsert(text, text, text, uuid) to anon, authenticated;

revoke all on function public.term_create(text, text, text, text, uuid) from public;
grant execute on function public.term_create(text, text, text, text, uuid) to anon, authenticated;

-- 配图桶
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('term-media', 'term-media', true, 2097152, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "term_media_read" on storage.objects;
drop policy if exists "term_media_insert" on storage.objects;
create policy "term_media_read" on storage.objects for select using (bucket_id = 'term-media');
create policy "term_media_insert" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'term-media');

notify pgrst, 'reload schema';
