-- Cópia dos próprios dados (LGPD, art. 18 e 19): o que é do Perfil, em JSON.
-- Pedido chega pelo contato publicado; a resposta sai por e-mail em até 15 dias.
-- Rode com:
--   docker exec -i supabase_db_meu-racha-app psql -U postgres -d postgres -tA \
--     -v email='pessoa@exemplo.com' -f - < supabase/snippets/export_profile_data.sql > copia.json
-- Em produção, a mesma consulta no SQL Editor do Supabase, trocando :'email' pelo endereço.
-- Não entra nada de outras pessoas: só o próprio Perfil e o que aponta para ele.
with me as (
  select p.*, u.email
  from public.profile p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(:'email')
)
select jsonb_pretty(jsonb_build_object(
  'perfil', (
    select jsonb_build_object(
      'nome', me.display_name,
      'email', me.email,
      'data_de_nascimento', me.birth_date,
      'onde_joga', me.plays_as,
      'posicao_principal', me.primary_position,
      'posicao_secundaria', me.secondary_position,
      'foto', me.avatar_path,
      'termos_aceitos_em', me.terms_accepted_at,
      'avisos_no_celular', me.push_enabled,
      'criado_em', me.created_at
    ) from me
  ),
  'rachas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'racha', r.name,
      'cargo', m.role,
      'ativo', m.is_active,
      'estrelas', m.stars,
      'entrou_em', m.joined_at
    ) order by m.joined_at)
    from me join public.member m on m.profile_id = me.id
    join public.racha r on r.id = m.racha_id
  ), '[]'::jsonb),
  'presencas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'racha', r.name,
      'data', e.starts_on,
      'situacao', a.status,
      'veio', a.did_attend
    ) order by e.starts_on)
    from me join public.event_attendance a on a.profile_id = me.id
    join public.event e on e.id = a.event_id
    join public.racha r on r.id = e.racha_id
  ), '[]'::jsonb),
  'gols', coalesce((
    select jsonb_agg(jsonb_build_object(
      'racha', r.name,
      'data', e.starts_on,
      'contra', g.is_own_goal
    ) order by g.created_at)
    from me join public.event_match_goal g on g.scorer_profile_id = me.id
    join public.event e on e.id = g.event_id
    join public.racha r on r.id = e.racha_id
  ), '[]'::jsonb),
  'assistencias', coalesce((
    select jsonb_agg(jsonb_build_object('racha', r.name, 'data', e.starts_on) order by g.created_at)
    from me join public.event_match_goal g on g.assist_profile_id = me.id
    join public.event e on e.id = g.event_id
    join public.racha r on r.id = e.racha_id
  ), '[]'::jsonb),
  'cartoes', coalesce((
    select jsonb_agg(jsonb_build_object('racha', r.name, 'data', e.starts_on, 'cor', c.color) order by c.created_at)
    from me join public.event_match_card c on c.profile_id = me.id
    join public.event e on e.id = c.event_id
    join public.racha r on r.id = e.racha_id
  ), '[]'::jsonb),
  'pagamentos', coalesce((
    select jsonb_agg(jsonb_build_object(
      'racha', r.name,
      'mes', f.event_year_month,
      'pago_em_dinheiro', f.cash_paid_amount,
      'credito_usado', f.credit_applied_amount,
      'marcado_em', f.paid_marked_at
    ) order by f.paid_marked_at)
    from me join public.event_payment_fact f on f.profile_id = me.id
    join public.racha r on r.id = f.racha_id
  ), '[]'::jsonb),
  'creditos', coalesce((
    select jsonb_agg(jsonb_build_object(
      'racha', r.name,
      'tipo', c.entry_kind,
      'valor', c.amount_delta,
      'validade', c.expires_at,
      'em', c.created_at
    ) order by c.created_at)
    from me join public.racha_credit_entry c on c.profile_id = me.id
    join public.racha r on r.id = c.racha_id
  ), '[]'::jsonb),
  'mensalidades', coalesce((
    select jsonb_agg(jsonb_build_object('racha', r.name, 'mes', p.year_month) order by p.year_month)
    from me join public.racha_monthly_pass p on p.profile_id = me.id
    join public.racha r on r.id = p.racha_id
  ), '[]'::jsonb),
  'pedidos_para_entrar', coalesce((
    select jsonb_agg(jsonb_build_object('racha', r.name, 'situacao', j.status, 'em', j.created_at) order by j.created_at)
    from me join public.join_request j on j.profile_id = me.id
    join public.racha r on r.id = j.racha_id
  ), '[]'::jsonb),
  'denuncias_feitas', coalesce((
    select jsonb_agg(jsonb_build_object('tipo', x.target_kind, 'motivo', x.reason, 'detalhes', x.details, 'em', x.created_at) order by x.created_at)
    from me join public.report x on x.reporter_id = me.id
  ), '[]'::jsonb),
  -- Só o número: o nome de quem foi bloqueado é dado de outra pessoa.
  'pessoas_bloqueadas', (
    select count(*) from me join public.profile_block b on b.blocker_id = me.id
  )
));
