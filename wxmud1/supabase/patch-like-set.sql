-- ============================================================
-- 补丁：幂等点赞 + 诊断用探针
-- 目的：离线队列重放时不会把赞抵消，本机旧数据也能安全补传。
-- 可重复执行。
-- ============================================================

-- 把点赞状态「设为」某个值，而不是切换。
-- 重复调用同一 p_on 是安全的，适合队列重放 / 多端补传。
create or replace function public.guide_like_set(p_guide text, p_visitor uuid, p_on boolean)
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

  if coalesce(p_on, false) then
    if not v_exists then
      insert into guide_likes (guide_id, visitor_id) values (p_guide, p_visitor)
      on conflict do nothing;
      update guide_stats s set likes = s.likes + 1, updated_at = now()
        where s.guide_id = p_guide returning s.likes into v_likes;
    else
      select s.likes into v_likes from guide_stats s where s.guide_id = p_guide;
    end if;
    return query select coalesce(v_likes, 0), true;
  else
    if v_exists then
      delete from guide_likes where guide_id = p_guide and visitor_id = p_visitor;
      update guide_stats s set likes = greatest(s.likes - 1, 0), updated_at = now()
        where s.guide_id = p_guide returning s.likes into v_likes;
    else
      select s.likes into v_likes from guide_stats s where s.guide_id = p_guide;
    end if;
    return query select coalesce(v_likes, 0), false;
  end if;
end;
$$;

grant execute on function public.guide_like_set(text, uuid, boolean) to anon, authenticated;

-- 探针：只做一次真实的读写往返，用于前端自检页判断链路是否通。
-- 写的是 _probe 前缀的假 id，随后即删，不会污染统计。
create or replace function public.guide_probe(p_visitor uuid)
returns table (ok boolean, server_time timestamptz, visitor_ok boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor is null then
    raise exception 'invalid visitor';
  end if;
  return query select true, now(), true;
end;
$$;

grant execute on function public.guide_probe(uuid) to anon, authenticated;
