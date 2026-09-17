begin;

create or replace function public.summit_coordinator_close_poll(p_poll_id uuid default null)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  if not private.is_summit_coordinator() then raise exception 'Coordinator authorization required'; end if;
  if p_poll_id is null then
    update public.polls set status='closed',closed_at=now() where status='open';
  else
    update public.polls set status='closed',closed_at=now() where id=p_poll_id;
  end if;
end;
$$;

revoke execute on function public.summit_coordinator_set_live_state(text,integer,integer) from anon;
revoke execute on function public.summit_coordinator_publish_announcement(text) from anon;
revoke execute on function public.summit_coordinator_publish_poll(text,uuid,text,jsonb) from anon;
revoke execute on function public.summit_coordinator_close_poll(uuid) from anon;
revoke execute on function public.summit_coordinator_moderate_parking(uuid,boolean,boolean) from anon;

grant execute on function public.summit_coordinator_set_live_state(text,integer,integer) to authenticated;
grant execute on function public.summit_coordinator_publish_announcement(text) to authenticated;
grant execute on function public.summit_coordinator_publish_poll(text,uuid,text,jsonb) to authenticated;
grant execute on function public.summit_coordinator_close_poll(uuid) to authenticated;
grant execute on function public.summit_coordinator_moderate_parking(uuid,boolean,boolean) to authenticated;

commit;
