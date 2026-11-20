-- ============================================================
-- 流程与插件：本站自己的点赞 / 浏览 / 评论（从零开始）
-- 外加：备注改为「上传者撰写」，游客只读
-- 已在 Supabase Dashboard 执行过，可重复运行。
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 表 ----------

create table if not exists public.plugin_stats (
  plugin_id  bigint primary key,
  likes      integer not null default 0 check (likes >= 0),
  views      integer not null default 0 check (views >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.plugin_likes (
  plugin_id  bigint not null,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (plugin_id, visitor_id)
);

create table if not exists public.plugin_views (
  plugin_id  bigint not null,
  visitor_id uuid not null,
  day        date not null default ((now() at time zone 'Asia/Shanghai')::date),
  primary key (plugin_id, visitor_id, day)
);

create table if not exists public.plugin_comments (
  id         bigserial primary key,
  plugin_id  bigint not null,
  visitor_id uuid not null,
  nick       text not null default '无名侠客',
  body       text not null,
  ip_hash    text,
  created_at timestamptz not null default now(),
  deleted    boolean not null default false
);

create index if not exists plugin_comments_idx
  on public.plugin_comments (plugin_id, created_at desc) where not deleted;
create index if not exists plugin_comments_visitor_idx
  on public.plugin_comments (visitor_id, created_at desc);

-- ---------- 行级安全 ----------

alter table public.plugin_stats    enable row level security;
alter table public.plugin_likes    enable row level security;
alter table public.plugin_views    enable row level security;
alter table public.plugin_comments enable row level security;

drop policy if exists "plugin stats readable" on public.plugin_stats;
create policy "plugin stats readable" on public.plugin_stats
  for select to anon, authenticated using (true);

drop policy if exists "plugin comments readable" on public.plugin_comments;
create policy "plugin comments readable" on public.plugin_comments
  for select to anon, authenticated using (not deleted);

-- plugin_likes / plugin_views 不建策略：匿名读不到访客标识。

revoke all on public.plugin_likes from anon, authenticated;
revoke all on public.plugin_views from anon, authenticated;

-- ---------- 点赞（切换） ----------

create or replace function public.plugin_toggle_like(p_plugin bigint, p_visitor uuid)
returns table (likes integer, liked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_likes  integer;
begin
  if p_plugin is null or p_plugin <= 0 then
    raise exception '插件编号不对';
  end if;
  if p_visitor is null then
    raise exception 'invalid visitor';
  end if;

  insert into public.plugin_stats (plugin_id) values (p_plugin)
  on conflict (plugin_id) do nothing;

  select exists (
    select 1 from public.plugin_likes where plugin_id = p_plugin and visitor_id = p_visitor
  ) into v_exists;

  if v_exists then
    delete from public.plugin_likes where plugin_id = p_plugin and visitor_id = p_visitor;
    update public.plugin_stats s set likes = greatest(s.likes - 1, 0), updated_at = now()
      where s.plugin_id = p_plugin returning s.likes into v_likes;
    return query select v_likes, false;
  else
    insert into public.plugin_likes (plugin_id, visitor_id) values (p_plugin, p_visitor);
    update public.plugin_stats s set likes = s.likes + 1, updated_at = now()
      where s.plugin_id = p_plugin returning s.likes into v_likes;
    return query select v_likes, true;
  end if;
end;
$$;

-- ---------- 浏览（同一天同访客只计一次） ----------

create or replace function public.plugin_hit(p_plugin bigint, p_visitor uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_views integer;
begin
  if p_plugin is null or p_plugin <= 0 then
    raise exception '插件编号不对';
  end if;
  if p_visitor is null then
    raise exception 'invalid visitor';
  end if;

  insert into public.plugin_stats (plugin_id) values (p_plugin)
  on conflict (plugin_id) do nothing;

  insert into public.plugin_views (plugin_id, visitor_id) values (p_plugin, p_visitor)
  on conflict do nothing;

  if found then
    update public.plugin_stats s set views = s.views + 1, updated_at = now()
      where s.plugin_id = p_plugin returning s.views into v_views;
  else
    select views into v_views from public.plugin_stats where plugin_id = p_plugin;
  end if;

  return v_views;
end;
$$;

-- ---------- 发表评论 ----------

create or replace function public.plugin_add_comment(
  p_plugin bigint, p_visitor uuid, p_nick text, p_body text
)
returns public.plugin_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nick   text := btrim(coalesce(nullif(btrim(coalesce(p_nick, '')), ''), '无名侠客'));
  v_body   text := btrim(coalesce(p_body, ''));
  v_ip     text;
  v_recent integer;
  v_ipcnt  integer;
  v_row    public.plugin_comments;
begin
  if p_plugin is null or p_plugin <= 0 then
    raise exception '插件编号不对';
  end if;
  if p_visitor is null then
    raise exception 'invalid visitor';
  end if;
  if char_length(v_body) < 2 then
    raise exception '内容太短';
  end if;
  if char_length(v_body) > 300 then
    raise exception '内容太长（最多 300 字）';
  end if;
  if char_length(v_nick) > 20 then
    v_nick := left(v_nick, 20);
  end if;

  select count(*) into v_recent from public.plugin_comments
   where visitor_id = p_visitor and created_at > now() - interval '60 seconds';
  if v_recent >= 3 then
    raise exception '发得太快了，歇一会儿';
  end if;

  v_ip := coalesce(
    (current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for'), ''
  );
  v_ip := btrim(split_part(v_ip, ',', 1));
  if v_ip <> '' then
    select count(*) into v_ipcnt from public.plugin_comments
     where ip_hash = md5(v_ip) and created_at > now() - interval '1 hour';
    if v_ipcnt >= 20 then
      raise exception '本机今日发言较多，请稍后再试';
    end if;
  end if;

  insert into public.plugin_comments (plugin_id, visitor_id, nick, body, ip_hash)
  values (p_plugin, p_visitor, v_nick, v_body, case when v_ip = '' then null else md5(v_ip) end)
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------- 删除自己的评论 ----------

create or replace function public.plugin_del_comment(p_id bigint, p_visitor uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor is null then
    raise exception 'invalid visitor';
  end if;

  update public.plugin_comments
     set deleted = true
   where id = p_id and visitor_id = p_visitor and not deleted;

  return found;
end;
$$;

-- ---------- 评论列表（不暴露访客标识） ----------

create or replace function public.plugin_list_comments(
  p_plugin bigint, p_visitor uuid, p_limit integer default 100
)
returns table (id bigint, nick text, body text, created_at timestamptz, mine boolean)
language sql
security definer
set search_path = public
as $$
  select c.id, c.nick, c.body, c.created_at,
         (c.visitor_id = p_visitor) as mine
    from public.plugin_comments c
   where c.plugin_id = p_plugin
     and not c.deleted
   order by c.created_at desc
   limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

-- ---------- 游客不能再改备注 ----------
-- 备注改由「上传者」撰写；旧的写入函数收回执行权。
revoke execute on function public.plugin_note_set(bigint, text, text, uuid) from anon, authenticated;

-- 上传者口令（不要在公开代码里出现）
create table if not exists public.app_secret (
  name       text primary key,
  secret     text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secret enable row level security;
revoke all on public.app_secret from anon, authenticated;

insert into public.app_secret (name, secret)
values ('plugin_note_owner', 'd6VgrVnzT7F8kFXB')
on conflict (name) do nothing;

-- 上传者写备注：校验口令后覆盖，并留历史
create or replace function public.plugin_note_owner_set(
  p_plugin bigint, p_body text, p_nick text, p_token text
)
returns table (body text, nick text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok   boolean;
  v_body text := btrim(coalesce(p_body, ''));
  v_nick text := btrim(coalesce(nullif(btrim(coalesce(p_nick, '')), ''), '上传者'));
begin
  select exists (
    select 1 from public.app_secret
     where name = 'plugin_note_owner' and secret = coalesce(p_token, '')
  ) into v_ok;
  if not v_ok then
    raise exception '口令不对';
  end if;
  if p_plugin is null or p_plugin <= 0 then
    raise exception '插件编号不对';
  end if;
  if char_length(v_body) > 2000 then
    raise exception '说明最多 2000 字';
  end if;
  if char_length(v_nick) > 20 then
    v_nick := left(v_nick, 20);
  end if;

  -- 清空 = 删除该条备注
  if v_body = '' then
    delete from public.plugin_notes where plugin_id = p_plugin;
    return;
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

-- ---------- 授权 ----------

grant execute on function public.plugin_toggle_like(bigint, uuid)                 to anon, authenticated;
grant execute on function public.plugin_hit(bigint, uuid)                         to anon, authenticated;
grant execute on function public.plugin_add_comment(bigint, uuid, text, text)     to anon, authenticated;
grant execute on function public.plugin_del_comment(bigint, uuid)                 to anon, authenticated;
grant execute on function public.plugin_list_comments(bigint, uuid, integer)      to anon, authenticated;
grant execute on function public.plugin_note_owner_set(bigint, text, text, text)  to anon, authenticated;

notify pgrst, 'reload schema';
