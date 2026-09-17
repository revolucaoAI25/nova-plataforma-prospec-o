-- ============================================================
-- Corrige recursão infinita nas políticas de RLS "admin vê tudo".
--
-- Todas as políticas "*_admin_*" criadas em 0001/0002 checavam se o
-- usuário é admin com:
--     exists (select 1 from profiles where id = auth.uid() and role = 'admin')
-- Isso é uma consulta à PRÓPRIA tabela `profiles` dentro de uma política
-- de RLS de `profiles` — o Postgres precisa reavaliar as políticas de
-- `profiles` pra resolver essa subconsulta, o que aciona a MESMA política
-- de novo, infinitamente. O Postgres detecta e derruba com erro 500
-- ("infinite recursion detected in policy for relation \"profiles\"") —
-- e como praticamente toda política admin de qualquer tabela consulta
-- `profiles` pra checar o role, isso quebrava a leitura de `profiles`
-- (e, por tabela, qualquer política admin) pra todo mundo.
--
-- Corrigido com uma função SECURITY DEFINER: ela roda com o privilégio
-- de quem criou a função (não do usuário logado), então a consulta
-- interna a `profiles` não reaplica a política de quem chamou — quebra
-- o ciclo. É o padrão recomendado pelo próprio Supabase pra esse caso.
--
-- Execute depois de 0001_init.sql e 0002_full_platform.sql.
-- ============================================================

create or replace function is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from profiles where id = uid and role = 'admin'
    );
$$;

-- ── profiles / searches / leads (0001) ────────────────────────
drop policy if exists "admin_all_profiles" on profiles;
create policy "admin_all_profiles" on profiles
    for all using (is_admin(auth.uid()));

drop policy if exists "admin_all_searches" on searches;
create policy "admin_all_searches" on searches
    for all using (is_admin(auth.uid()));

drop policy if exists "admin_all_leads" on leads;
create policy "admin_all_leads" on leads
    for all using (is_admin(auth.uid()));

-- ── automações (0002) ──────────────────────────────────────────
drop policy if exists "admin_all_automations" on automations;
create policy "admin_all_automations" on automations
    for all using (is_admin(auth.uid()));

drop policy if exists "admin_all_automation_runs" on automation_runs;
create policy "admin_all_automation_runs" on automation_runs
    for all using (is_admin(auth.uid()));

-- ── disparo WhatsApp (0002) ────────────────────────────────────
drop policy if exists "own_or_admin_whatsapp_instances" on whatsapp_instances;
create policy "own_or_admin_whatsapp_instances" on whatsapp_instances
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "own_or_admin_dispatch_campaigns" on dispatch_campaigns;
create policy "own_or_admin_dispatch_campaigns" on dispatch_campaigns
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "own_or_admin_dispatch_cadence_steps" on dispatch_cadence_steps;
create policy "own_or_admin_dispatch_cadence_steps" on dispatch_cadence_steps
    for all using (
        exists (select 1 from dispatch_campaigns dc where dc.id = campaign_id and dc.user_id = auth.uid())
        or is_admin(auth.uid())
    );

drop policy if exists "own_or_admin_dispatch_targets" on dispatch_targets;
create policy "own_or_admin_dispatch_targets" on dispatch_targets
    for all using (
        exists (select 1 from dispatch_campaigns dc where dc.id = campaign_id and dc.user_id = auth.uid())
        or is_admin(auth.uid())
    );

drop policy if exists "own_or_admin_dispatch_messages_log" on dispatch_messages_log;
create policy "own_or_admin_dispatch_messages_log" on dispatch_messages_log
    for all using (
        exists (select 1 from dispatch_campaigns dc where dc.id = campaign_id and dc.user_id = auth.uid())
        or is_admin(auth.uid())
    );

drop policy if exists "own_or_admin_dispatch_sheet_watchers" on dispatch_sheet_watchers;
create policy "own_or_admin_dispatch_sheet_watchers" on dispatch_sheet_watchers
    for all using (
        exists (select 1 from dispatch_campaigns dc where dc.id = campaign_id and dc.user_id = auth.uid())
        or is_admin(auth.uid())
    );

drop policy if exists "own_or_admin_dispatch_opt_outs" on dispatch_opt_outs;
create policy "own_or_admin_dispatch_opt_outs" on dispatch_opt_outs
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "own_or_admin_message_templates" on message_templates;
create policy "own_or_admin_message_templates" on message_templates
    for all using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "own_or_admin_oficial_connection_requests" on oficial_connection_requests;
create policy "own_or_admin_oficial_connection_requests" on oficial_connection_requests
    for all using (user_id = auth.uid() or is_admin(auth.uid()));
