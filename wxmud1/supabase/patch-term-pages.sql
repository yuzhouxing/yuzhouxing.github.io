-- ============================================================
-- 词条页：单条读取 / 编辑历史 / 新建空白词条
-- 可重复执行。写入仍然只走 RPC，匿名角色读不到基表。
-- ============================================================

-- 列表多带一个 freq，总览页用来排序和显示「出现 N 次」
drop function if exists public.term_list();
create or replace function public.term_list()
returns table (name text, cat text, body text, freq integer, filled boolean, editor text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select t.name, t.cat, t.body, t.freq, t.filled, t.editor, t.updated_at
  from public.terms t
  order by t.freq desc, t.name;
$$;
grant execute on function public.term_list() to anon, authenticated;

-- 单条
create or replace function public.term_get(p_name text)
returns table (name text, cat text, body text, freq integer, filled boolean, editor text, created_at timestamptz, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select t.name, t.cat, t.body, t.freq, t.filled, t.editor, t.created_at, t.updated_at
  from public.terms t
  where t.name = btrim(coalesce(p_name, ''));
$$;
grant execute on function public.term_get(text) to anon, authenticated;

-- 编辑历史（谁、什么时候、写了什么）
create or replace function public.term_history(p_name text, p_limit integer default 20)
returns table (id bigint, nick text, body text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select r.id, r.nick, r.body, r.created_at
  from public.term_revisions r
  where r.name = btrim(coalesce(p_name, ''))
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
grant execute on function public.term_history(text, integer) to anon, authenticated;

-- 新建词条（可以只建空白条目，也可以顺手写上第一版释义）
create or replace function public.term_create(
  p_name text,
  p_cat text default 'other',
  p_nick text default '无名侠客',
  p_body text default '',
  p_visitor uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
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
  if char_length(v_body) > 2000 then
    return jsonb_build_object('ok', false, 'error', '内容超过 2000 字');
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
$$;
grant execute on function public.term_create(text, text, text, text, uuid) to anon, authenticated;
