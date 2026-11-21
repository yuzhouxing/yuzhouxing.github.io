-- ============================================================
-- 玩家投稿：攻略提交入口
-- ------------------------------------------------------------
-- 1) guide_posts 表：标题 / 分类 / Markdown 正文，正文允许配图
-- 2) 只走 security definer 函数，匿名角色读不到 visitor_id、ip_hash
-- 3) 投稿直接发布；作者凭本机访客标识可以删掉自己那篇
-- 可重复执行。
-- ============================================================

create table if not exists public.guide_posts (
  id         text primary key,
  title      text not null,
  cat        text not null default 'dungeon',
  body       text not null,
  visitor_id uuid,
  ip_hash    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted    boolean not null default false
);

create index if not exists guide_posts_created_idx
  on public.guide_posts (created_at desc) where not deleted;
create index if not exists guide_posts_visitor_idx
  on public.guide_posts (visitor_id, created_at desc);
create index if not exists guide_posts_ip_idx
  on public.guide_posts (ip_hash, created_at desc);

alter table public.guide_posts enable row level security;
-- 不建任何策略：读取和写入一律走下面的函数。

-- ---------- 发布 ----------
create or replace function public.guide_post_create(
  p_title text,
  p_body  text,
  p_cat   text default 'dungeon',
  p_visitor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title  text := btrim(coalesce(p_title, ''));
  v_body   text := btrim(coalesce(p_body, ''));
  v_cat    text := coalesce(nullif(btrim(coalesce(p_cat, '')), ''), 'dungeon');
  v_id     text;
  v_ip     text;
  v_recent integer;
  v_day    integer;
  v_try    integer := 0;
begin
  if char_length(v_title) < 2 then
    return jsonb_build_object('ok', false, 'error', '标题至少两个字');
  end if;
  if char_length(v_title) > 60 then
    return jsonb_build_object('ok', false, 'error', '标题最多 60 字');
  end if;
  if char_length(v_body) < 20 then
    return jsonb_build_object('ok', false, 'error', '正文太短，至少写 20 个字');
  end if;
  if char_length(v_body) > 20000 then
    return jsonb_build_object('ok', false, 'error', '正文最多 2 万字，再长请拆成几篇');
  end if;
  -- 插件类不在这里收：插件教程归「流程与插件」页
  if v_cat not in ('start', 'dungeon', 'sect', 'mech', 'craft', 'alchemy') then
    v_cat := 'dungeon';
  end if;

  -- 同一 IP 一天最多 8 篇，挡住脚本刷稿
  v_ip := btrim(split_part(coalesce(
    (current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for'), ''), ',', 1));
  if v_ip <> '' then
    select count(*) into v_day from public.guide_posts
     where ip_hash = md5(v_ip) and created_at > now() - interval '1 day';
    if v_day >= 8 then
      return jsonb_build_object('ok', false, 'error', '今天提交得有点多，明天再来');
    end if;
  end if;

  if p_visitor is not null then
    select count(*) into v_recent from public.guide_posts
     where visitor_id = p_visitor and created_at > now() - interval '60 seconds';
    if v_recent >= 1 then
      return jsonb_build_object('ok', false, 'error', '刚发过一篇，歇一分钟再发');
    end if;
    select count(*) into v_day from public.guide_posts
     where visitor_id = p_visitor and created_at > now() - interval '1 day';
    if v_day >= 5 then
      return jsonb_build_object('ok', false, 'error', '今天已经发了 5 篇，明天继续');
    end if;
  end if;

  -- 12 位十六进制 id：既能进 #/g/:id 路由，也不会和静态攻略的 8 位撞
  loop
    v_try := v_try + 1;
    v_id := left(replace(gen_random_uuid()::text, '-', ''), 12);
    begin
      insert into public.guide_posts (id, title, cat, body, visitor_id, ip_hash)
      values (v_id, v_title, v_cat, v_body, p_visitor,
              case when v_ip = '' then null else md5(v_ip) end);
      exit;
    exception when unique_violation then
      if v_try >= 3 then
        return jsonb_build_object('ok', false, 'error', '发布失败，请再试一次');
      end if;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'id', v_id, 'title', v_title,
                            'cat', v_cat, 'body', v_body);
end;
$$;

-- ---------- 列表 ----------
create or replace function public.guide_post_list(
  p_visitor uuid default null,
  p_limit   integer default 200
)
returns table (id text, title text, cat text, body text, created_at timestamptz, mine boolean)
language sql
security definer
set search_path = public
as $$
  select p.id, p.title, p.cat, p.body, p.created_at,
         (p.visitor_id is not null and p.visitor_id = p_visitor) as mine
    from public.guide_posts p
   where not p.deleted
   order by p.created_at desc
   limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;

-- ---------- 单篇 ----------
create or replace function public.guide_post_get(p_id text, p_visitor uuid default null)
returns table (id text, title text, cat text, body text, created_at timestamptz, mine boolean)
language sql
security definer
set search_path = public
as $$
  select p.id, p.title, p.cat, p.body, p.created_at,
         (p.visitor_id is not null and p.visitor_id = p_visitor) as mine
    from public.guide_posts p
   where p.id = btrim(coalesce(p_id, '')) and not p.deleted;
$$;

-- ---------- 撤回（只有作者本人） ----------
create or replace function public.guide_post_del(p_id text, p_visitor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if p_visitor is null then
    return jsonb_build_object('ok', false, 'error', '找不到这篇投稿的主人');
  end if;
  update public.guide_posts
     set deleted = true, updated_at = now()
   where id = btrim(coalesce(p_id, '')) and visitor_id = p_visitor and not deleted;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'error', '没找到你名下的这篇投稿');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.guide_post_create(text, text, text, uuid) from public;
revoke all on function public.guide_post_list(uuid, integer) from public;
revoke all on function public.guide_post_get(text, uuid) from public;
revoke all on function public.guide_post_del(text, uuid) from public;
grant execute on function public.guide_post_create(text, text, text, uuid) to anon, authenticated;
grant execute on function public.guide_post_list(uuid, integer) to anon, authenticated;
grant execute on function public.guide_post_get(text, uuid) to anon, authenticated;
grant execute on function public.guide_post_del(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
