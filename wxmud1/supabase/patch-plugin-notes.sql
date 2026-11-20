-- ============================================================
-- 「流程与插件」备注：每一条插件都能写一段用途 / 背景说明
-- 在 Supabase → SQL Editor 里整段粘贴执行，可重复运行。
-- 不执行也能用：前端会退到浏览器本地保存（只有自己看得到）。
-- ============================================================

-- ---------- 表 ----------

create table if not exists public.plugin_notes (
  plugin_id  bigint primary key,
  body       text not null default '',
  nick       text not null default '无名侠客',
  updated_at timestamptz not null default now()
);

create table if not exists public.plugin_note_hist (
  id         bigserial primary key,
  plugin_id  bigint not null,
  body       text not null,
  nick       text not null default '无名侠客',
  created_at timestamptz not null default now()
);

create index if not exists plugin_note_hist_idx
  on public.plugin_note_hist (plugin_id, created_at desc);

-- ---------- 行级安全 ----------
-- 两张表都不建 select 策略：匿名拿不到原始行（历史里有署名，但不暴露 visitor）。

alter table public.plugin_notes     enable row level security;
alter table public.plugin_note_hist enable row level security;

revoke all on public.plugin_notes     from anon, authenticated;
revoke all on public.plugin_note_hist from anon, authenticated;

-- ---------- 读备注 ----------

create or replace function public.plugin_note_get(p_plugin bigint)
returns table (body text, nick text, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select n.body, n.nick, n.updated_at
    from public.plugin_notes n
   where n.plugin_id = p_plugin;
$$;

-- ---------- 写备注（覆盖式，保留历史） ----------

create or replace function public.plugin_note_set(
  p_plugin bigint, p_body text, p_nick text, p_visitor uuid default null
)
returns table (body text, nick text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_nick text := btrim(coalesce(nullif(btrim(coalesce(p_nick, '')), ''), '无名侠客'));
  v_cnt  integer;
begin
  if p_plugin is null or p_plugin <= 0 then
    raise exception '插件编号不对';
  end if;
  if char_length(v_body) < 2 then
    raise exception '备注至少写两个字';
  end if;
  if char_length(v_body) > 600 then
    raise exception '备注最多 600 字';
  end if;
  if char_length(v_nick) > 20 then
    v_nick := left(v_nick, 20);
  end if;

  -- 同一个访客 60 秒内最多改 5 次，防止乱刷
  if p_visitor is not null then
    select count(*) into v_cnt
      from public.plugin_note_hist h
     where h.plugin_id = p_plugin
       and h.created_at > now() - interval '60 seconds';
    if v_cnt >= 5 then
      raise exception '改得太快了，歇一会儿';
    end if;
  end if;

  insert into public.plugin_notes (plugin_id, body, nick, updated_at)
  values (p_plugin, v_body, v_nick, now())
  on conflict (plugin_id) do update
    set body = excluded.body, nick = excluded.nick, updated_at = now();

  insert into public.plugin_note_hist (plugin_id, body, nick)
  values (p_plugin, v_body, v_nick);

  return query
    select n.body, n.nick, n.updated_at from public.plugin_notes n where n.plugin_id = p_plugin;
end;
$$;

-- ---------- 历史 ----------

create or replace function public.plugin_note_hist(p_plugin bigint, p_limit integer default 20)
returns table (body text, nick text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select h.body, h.nick, h.created_at
    from public.plugin_note_hist h
   where h.plugin_id = p_plugin
   order by h.created_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- ---------- 授权 ----------

grant execute on function public.plugin_note_get(bigint)                            to anon, authenticated;
grant execute on function public.plugin_note_set(bigint, text, text, uuid)          to anon, authenticated;
grant execute on function public.plugin_note_hist(bigint, integer)                  to anon, authenticated;

notify pgrst, 'reload schema';
