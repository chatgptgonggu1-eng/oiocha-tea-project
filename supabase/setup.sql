-- Run this entire file in the project's SQL Editor. Safe to run again.
begin;
create table if not exists public.oiocha_boards (
 id uuid primary key default gen_random_uuid(),
 recipient text not null check(char_length(trim(recipient)) between 1 and 30),
 title text not null check(char_length(trim(title)) between 1 and 60),
 created_at timestamptz not null default now()
);
create table if not exists public.oiocha_messages (
 id uuid primary key default gen_random_uuid(),
 board_id uuid not null references public.oiocha_boards(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 20),
 body text not null check(char_length(trim(body)) between 1 and 200),
 shape text not null check(shape in ('leaf','heart','star','clover','rabbit')),
 x double precision not null default 0.5 check(x between 0.06 and 0.94),
 y double precision not null default 0.5 check(y between 0.04 and 0.96),
 created_at timestamptz not null default now()
);
create index if not exists oiocha_messages_board_idx on public.oiocha_messages(board_id,created_at);
create index if not exists oiocha_boards_created_idx on public.oiocha_boards(created_at);
alter table public.oiocha_boards enable row level security;
alter table public.oiocha_messages enable row level security;
revoke all on public.oiocha_boards, public.oiocha_messages from public,anon,authenticated;
grant usage on schema public to anon,authenticated;

-- A random, unlisted board UUID is the share-link capability. There is no list RPC.
create or replace function public.oiocha_create_board(p_title text,p_recipient text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.oiocha_boards;
begin
 if p_title is null or p_recipient is null
    or char_length(trim(p_title)) not between 1 and 60
    or char_length(trim(p_recipient)) not between 1 and 30 then
  raise exception '받는 분과 제목을 확인해 주세요.' using errcode='22023';
 end if;
 -- Serialize the quota check with insertion, including concurrent requests.
 perform pg_catalog.pg_advisory_xact_lock(4815162342::bigint);
 if (select count(*) from public.oiocha_boards where created_at>now()-interval '1 minute')>=60 then
  raise exception '찻잔 생성 요청이 많아요. 1분 뒤 다시 시도해 주세요.' using errcode='P0001';
 end if;
 if (select count(*) from public.oiocha_boards)>=10000 then
  raise exception '찻잔 보관 한도에 도달했어요. 운영자에게 문의해 주세요.' using errcode='P0001';
 end if;
 insert into public.oiocha_boards(title,recipient) values(trim(p_title),trim(p_recipient)) returning * into b;
 return to_jsonb(b)||jsonb_build_object('messages','[]'::jsonb);
end $$;

create or replace function public.oiocha_get_board(p_board_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 select to_jsonb(b)||jsonb_build_object('messages',
  coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at,m.id)
   from public.oiocha_messages m where m.board_id=b.id),'[]'::jsonb))
 into result from public.oiocha_boards b where b.id=p_board_id;
 if result is null then
  raise exception '찻잔을 찾을 수 없어요. 공유 링크를 확인해 주세요.' using errcode='P0002';
 end if;
 return result;
end $$;

create or replace function public.oiocha_add_message(
 p_board_id uuid,p_name text,p_body text,p_shape text,p_x double precision,p_y double precision)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.oiocha_messages;
begin
 if p_name is null or p_body is null or p_shape is null or p_x is null or p_y is null
  or char_length(trim(p_name)) not between 1 and 20
  or char_length(trim(p_body)) not between 1 and 200
  or p_shape not in ('leaf','heart','star','clover','rabbit')
  or not(p_x between 0.06 and 0.94) or not(p_y between 0.04 and 0.96) then
  raise exception '이름, 메시지, 잎사귀와 위치를 확인해 주세요.' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_board_id::text,0));
 if not exists(select 1 from public.oiocha_boards where id=p_board_id) then
  raise exception '찻잔을 찾을 수 없어요.' using errcode='P0002';
 end if;
 if (select count(*) from public.oiocha_messages where board_id=p_board_id)>=500 then
  raise exception '이 찻잔은 메시지 500개로 가득 찼어요.' using errcode='P0001';
 end if;
 if (select count(*) from public.oiocha_messages where board_id=p_board_id and created_at>now()-interval '1 minute')>=20 then
  raise exception '메시지가 빠르게 도착하고 있어요. 1분 뒤 다시 시도해 주세요.' using errcode='P0001';
 end if;
 insert into public.oiocha_messages(board_id,name,body,shape,x,y)
 values(p_board_id,trim(p_name),trim(p_body),p_shape,p_x,p_y) returning * into m;
 return to_jsonb(m);
end $$;

create or replace function public.oiocha_move_message(
 p_board_id uuid,p_message_id uuid,p_x double precision,p_y double precision)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_x is null or p_y is null or not(p_x between 0.06 and 0.94) or not(p_y between 0.04 and 0.96) then
  raise exception '위치가 올바르지 않습니다.' using errcode='22023';
 end if;
 update public.oiocha_messages set x=p_x,y=p_y where id=p_message_id and board_id=p_board_id;
 if not found then
  raise exception '이 찻잔의 메시지를 찾을 수 없어요.' using errcode='P0002';
 end if;
 return jsonb_build_object('ok',true);
end $$;

revoke all on function public.oiocha_create_board(text,text) from public;
revoke all on function public.oiocha_get_board(uuid) from public;
revoke all on function public.oiocha_add_message(uuid,text,text,text,double precision,double precision) from public;
revoke all on function public.oiocha_move_message(uuid,uuid,double precision,double precision) from public;
grant execute on function public.oiocha_create_board(text,text) to anon,authenticated;
grant execute on function public.oiocha_get_board(uuid) to anon,authenticated;
grant execute on function public.oiocha_add_message(uuid,text,text,text,double precision,double precision) to anon,authenticated;
grant execute on function public.oiocha_move_message(uuid,uuid,double precision,double precision) to anon,authenticated;
notify pgrst,'reload schema';
commit;
