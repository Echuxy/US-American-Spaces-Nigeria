begin;

select plan(12);

select has_table('public', 'summit_live_state', 'authoritative Summit live-state table exists');
select has_index('public', 'participants_device_id_uidx', 'participant device identity remains unique');
select has_index('public', 'poll_responses_poll_device_uidx', 'one poll response per participant device is enforced');
select has_index('public', 'notes_participant_idx', 'notes participant foreign key is indexed');
select has_index('public', 'notes_session_idx', 'notes session foreign key is indexed');
select has_index('public', 'polls_day_idx', 'poll day foreign key is indexed');
select has_index('public', 'polls_session_idx', 'poll session foreign key is indexed');
select has_index('public', 'session_resources_session_idx', 'resource session foreign key is indexed');
select has_function('public', 'register_summit_participant', array['text','boolean','text'], 'participant registration RPC exists');
select has_function('public', 'summit_coordinator_set_live_state', array['text','integer','integer'], 'coordinator live-state RPC exists');
select ok(not has_function_privilege('anon', 'public.summit_coordinator_set_live_state(text,integer,integer)', 'execute'), 'anonymous clients cannot execute coordinator live-state RPC');
select ok(has_function_privilege('anon', 'public.register_summit_participant(text,boolean,text)', 'execute'), 'anonymous participants can execute registration RPC');

select * from finish();
rollback;
