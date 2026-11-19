-- ============================================================
-- 武仙传说 · 攻略总集  ——  名词词条
-- 可重复执行。写入一律走 RPC，匿名角色无法直读直写表。
-- ============================================================

create table if not exists public.terms (
  name       text primary key,
  cat        text not null default 'other',
  body       text not null default '',
  freq       integer not null default 0,
  filled     boolean not null default false,
  editor     text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.term_revisions (
  id         bigserial primary key,
  name       text not null,
  body       text not null,
  nick       text not null default '无名侠客',
  visitor_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists terms_filled_idx on public.terms (filled, freq desc);
create index if not exists term_revisions_name_idx on public.term_revisions (name, created_at desc);
create index if not exists term_revisions_visitor_idx on public.term_revisions (visitor_id, created_at desc);

alter table public.terms          enable row level security;
alter table public.term_revisions enable row level security;

revoke all on public.terms          from anon, authenticated;
revoke all on public.term_revisions from anon, authenticated;

-- ---------- 读：一次拉全量（约 300 条，几十 KB） ----------
create or replace function public.term_list()
returns table (name text, cat text, body text, filled boolean, editor text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select t.name, t.cat, t.body, t.filled, t.editor, t.updated_at
  from public.terms t
  order by t.freq desc, t.name;
$$;

-- ---------- 写：贡献释义 ----------
create or replace function public.term_upsert(
  p_name text,
  p_body text,
  p_nick text default '无名侠客',
  p_visitor uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
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
  if char_length(v_body) > 2000 then
    return jsonb_build_object('ok', false, 'error', '内容超过 2000 字');
  end if;

  if p_visitor is not null then
    select count(*) into v_recent
      from public.term_revisions
     where visitor_id = p_visitor and created_at > now() - interval '1 minute';
    if v_recent >= 5 then
      return jsonb_build_object('ok', false, 'error', '写得太快了，歇一分钟再来');
    end if;
  end if;

  insert into public.terms (name, body, filled, editor, updated_at)
  values (v_name, v_body, true, v_nick, now())
  on conflict (name) do update
    set body = excluded.body,
        filled = true,
        editor = excluded.editor,
        updated_at = now();

  insert into public.term_revisions (name, body, nick, visitor_id)
  values (v_name, v_body, v_nick, p_visitor);

  return jsonb_build_object('ok', true, 'name', v_name, 'body', v_body, 'filled', true, 'editor', v_nick);
end;
$$;

grant execute on function public.term_list() to anon, authenticated;
grant execute on function public.term_upsert(text, text, text, uuid) to anon, authenticated;
