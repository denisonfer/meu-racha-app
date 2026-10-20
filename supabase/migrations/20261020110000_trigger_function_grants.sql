-- Função de gatilho em public aparece em /rest/v1/rpc. O gatilho dispara sem EXECUTE
-- de quem fez a escrita, então ninguém de fora precisa dela.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.notify_racha_deleted() from public, anon, authenticated;
revoke execute on function public.guard_racha_motor_while_event_active()
  from public, anon, authenticated;
