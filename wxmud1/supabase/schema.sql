-- ============================================================
-- 武仙传说 · 攻略总集  ——  Supabase 互动数据（点赞 / 浏览量 / 评论）
-- 在 Supabase Dashboard → SQL Editor 里整段粘贴执行，可重复运行。
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 表 ----------

-- 每篇攻略的聚合计数
create table if not exists public.guide_stats (
  guide_id   text primary key,
  likes      integer not null default 0 check (likes >= 0),
  views      integer not null default 0 check (views >= 0),
  updated_at timestamptz not null default now()
);

-- 点赞关系，主键天然防重复点赞
create table if not exists public.guide_likes (
  guide_id   text not null,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (guide_id, visitor_id)
);

-- 浏览去重：同一访客同一篇每天只计一次
create table if not exists public.guide_views (
  guide_id   text not null,
  visitor_id uuid not null,
  day        date not null default ((now() at time zone 'Asia/Shanghai')::date),
  primary key (guide_id, visitor_id, day)
);

-- 评论
create table if not exists public.guide_comments (
  id         bigserial primary key,
  guide_id   text not null,
  visitor_id uuid not null,
  nick       text not null default '无名侠客',
  body       text not null,
  ip_hash    text,
  created_at timestamptz not null default now(),
  deleted    boolean not null default false
);

create index if not exists guide_comments_guide_idx
  on public.guide_comments (guide_id, created_at desc) where not deleted;
create index if not exists guide_comments_visitor_idx
  on public.guide_comments (visitor_id, created_at desc);
create index if not exists guide_comments_ip_idx
  on public.guide_comments (ip_hash, created_at desc);

-- ---------- 行级安全 ----------
-- 只允许匿名读聚合计数和未删除的评论；
-- 写入一律走下面的 security definer 函数，浏览器无法直接改表。

alter table public.guide_stats    enable row level security;
alter table public.guide_likes    enable row level security;
alter table public.guide_views    enable row level security;
alter table public.guide_comments enable row level security;

drop policy if exists "stats readable" on public.guide_stats;
create policy "stats readable" on public.guide_stats
  for select to anon, authenticated using (true);

drop policy if exists "comments readable" on public.guide_comments;
create policy "comments readable" on public.guide_comments
  for select to anon, authenticated using (not deleted);

-- guide_likes / guide_views 不建任何策略：匿名角色完全读不到，保护访客标识。

-- ---------- 点赞（切换：再点一次取消） ----------

create or replace function public.guide_toggle_like(p_guide text, p_visitor uuid)
returns table (likes integer, liked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_likes  integer;
begin
  if p_guide is null or length(p_guide) > 64 then
    raise exception 'invalid guide id';
  end if;
  if p_visitor is null then
    raise exception 'invalid visitor';
  end if;

  insert into guide_stats (guide_id) values (p_guide)
  on conflict (guide_id) do nothing;

  select exists (
    select 1 from guide_likes where guide_id = p_guide and visitor_id = p_visitor
  ) into v_exists;

  if v_exists then
    delete from guide_likes where guide_id = p_guide and visitor_id = p_visitor;
    update guide_stats s set likes = greatest(s.likes - 1, 0), updated_at = now()
      where s.guide_id = p_guide
      returning s.likes into v_likes;
    return query select v_likes, false;
  else
    insert into guide_likes (guide_id, visitor_id) values (p_guide, p_visitor);
    update guide_stats s set likes = s.likes + 1, updated_at = now()
      where s.guide_id = p_guide
      returning s.likes into v_likes;
    return query select v_likes, true;
  end if;
end;
$$;

-- ---------- 浏览（同一天同访客只计一次） ----------

create or replace function public.guide_hit(p_guide text, p_visitor uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_views integer;
begin
  if p_guide is null or length(p_guide) > 64 then
    raise exception 'invalid guide id';
  end if;
  if p_visitor is null then
    raise exception 'invalid visitor';
  end if;

  insert into guide_stats (guide_id) values (p_guide)
  on conflict (guide_id) do nothing;

  insert into guide_views (guide_id, visitor_id) values (p_guide, p_visitor)
  on conflict do nothing;

  if found then
    update guide_stats s set views = s.views + 1, updated_at = now()
      where s.guide_id = p_guide
      returning s.views into v_views;
  else
    select views into v_views from guide_stats where guide_id = p_guide;
  end if;

  return v_views;
end;
$$;

-- ---------- 发表评论 ----------

create or replace function public.guide_add_comment(
  p_guide text, p_visitor uuid, p_nick text, p_body text
)
returns public.guide_comments
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
  v_row    public.guide_comments;
begin
  if p_guide is null or length(p_guide) > 64 then
    raise exception 'invalid guide id';
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

  -- 同一访客 60 秒内最多 3 条
  select count(*) into v_recent from guide_comments
   where visitor_id = p_visitor and created_at > now() - interval '60 seconds';
  if v_recent >= 3 then
    raise exception '发得太快了，歇一会儿';
  end if;

  -- 同一 IP 每小时最多 20 条
  v_ip := coalesce(
    (current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for'), ''
  );
  v_ip := btrim(split_part(v_ip, ',', 1));
  if v_ip <> '' then
    select count(*) into v_ipcnt from guide_comments
     where ip_hash = md5(v_ip) and created_at > now() - interval '1 hour';
    if v_ipcnt >= 20 then
      raise exception '本机今日发言较多，请稍后再试';
    end if;
  end if;

  insert into guide_comments (guide_id, visitor_id, nick, body, ip_hash)
  values (p_guide, p_visitor, v_nick, v_body, case when v_ip = '' then null else md5(v_ip) end)
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------- 删除自己的评论 ----------

create or replace function public.guide_del_comment(p_id bigint, p_visitor uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor is null then
    raise exception 'invalid visitor';
  end if;

  update guide_comments
     set deleted = true
   where id = p_id and visitor_id = p_visitor and not deleted;

  return found;
end;
$$;

-- ---------- 评论列表（不暴露访客标识） ----------
-- 直接把 guide_comments 开放给匿名读会泄露 visitor_id / ip_hash：
-- 拿到别人的 visitor_id 就能冒充其身份删评论、刷赞。所以走函数返回。

create or replace function public.guide_list_comments(
  p_guide text, p_visitor uuid, p_limit integer default 100
)
returns table (id bigint, nick text, body text, created_at timestamptz, mine boolean)
language sql
security definer
set search_path = public
as $$
  select c.id, c.nick, c.body, c.created_at,
         (c.visitor_id = p_visitor) as mine
    from guide_comments c
   where c.guide_id = p_guide
     and not c.deleted
   order by c.created_at desc
   limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

-- ---------- 授权 ----------
-- Supabase 给 anon 的默认权限是整表 all：必须显式收回，
-- 否则 RLS 只挡写入，读仍能拿到敏感列。

grant usage on schema public to anon, authenticated;

revoke all on public.guide_likes    from anon, authenticated;
revoke all on public.guide_views    from anon, authenticated;
revoke all on public.guide_comments from anon, authenticated;
revoke all on public.guide_stats    from anon, authenticated;

grant select on public.guide_stats to anon, authenticated;

-- 评论表只放开非敏感列
grant select (id, guide_id, nick, body, created_at, deleted)
  on public.guide_comments to anon, authenticated;

grant execute on function public.guide_toggle_like(text, uuid)       to anon, authenticated;
grant execute on function public.guide_hit(text, uuid)               to anon, authenticated;
grant execute on function public.guide_add_comment(text, uuid, text, text) to anon, authenticated;
grant execute on function public.guide_del_comment(bigint, uuid)     to anon, authenticated;
grant execute on function public.guide_list_comments(text, uuid, integer)  to anon, authenticated;
