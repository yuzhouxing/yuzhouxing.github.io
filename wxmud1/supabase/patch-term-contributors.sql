-- ============================================================
-- 词条贡献榜
-- 口径：按「署名」归并，同一个人在同一条词目下编辑多次只算 1 条；
--       排序先比写过的词条数，条数相同再比编辑次数。
-- 只统计真正写了内容的修订（正文 ≥ 2 字），占位空条目不算。
-- 可重复执行。
-- ============================================================

create or replace function public.term_contributors(p_limit integer default 30)
returns table (nick text, terms integer, edits integer, first_at timestamptz, last_at timestamptz)
language sql
security definer
set search_path = public
as $$
  with valid as (
    select btrim(r.nick) as who, r.name, r.created_at
    from public.term_revisions r
    where char_length(btrim(coalesce(r.body, ''))) >= 2
      and btrim(coalesce(r.nick, '')) <> ''
  ),
  agg as (
    select lower(who) as k,
           count(distinct name)::int as terms,
           count(*)::int            as edits,
           min(created_at)         as first_at,
           max(created_at)         as last_at
    from valid
    group by 1
  ),
  latest as (
    select distinct on (lower(who)) lower(who) as k, who as nick
    from valid
    order by lower(who), created_at desc
  )
  select l.nick, a.terms, a.edits, a.first_at, a.last_at
  from agg a
  join latest l using (k)
  order by a.terms desc, a.edits desc, a.last_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- 函数默认对 PUBLIC 放开，先收回再按需授权
revoke all on function public.term_contributors(integer) from public;
grant execute on function public.term_contributors(integer) to anon, authenticated;

notify pgrst, 'reload schema';
