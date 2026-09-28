-- ============================================================
-- Verificação de domínio por usuário (Resend Domains API) — corrige um
-- gap real do disparo por e-mail (0008_email_dispatch.sql): até aqui,
-- `email_senders.from_email` aceitava qualquer endereço digitado, assumindo
-- implicitamente um único domínio verificado manualmente no dashboard da
-- Resend pelo admin da plataforma. Isso não escala pra multiusuário — cada
-- cliente quer mandar do PRÓPRIO domínio, e não tem (nem deve ter) acesso
-- à conta da Resend da plataforma.
--
-- `email_domains` guarda, por usuário, um domínio registrado via
-- `POST /domains` da API da Resend (sob a ÚNICA RESEND_API_KEY da
-- plataforma — a Resend suporta múltiplos domínios numa mesma conta,
-- é o padrão dela pra esse exato cenário) — junto com os registros DNS
-- que a Resend devolveu (`records`, replicados na nossa UI pro usuário
-- copiar pro provedor de DNS dele) e o status de verificação.
--
-- A partir desta migration, um remetente (`email_senders.from_email`) só
-- pode ser criado com um endereço cujo domínio bata com uma linha aqui
-- com `status = 'verified'` — checado em `email-dispatch-db.ts`, não a
-- nível de banco (não dá pra validar isso com um `check` simples de SQL).
-- ============================================================

create table if not exists email_domains (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade,
    dominio           text not null,
    resend_domain_id  text,
    status            text not null default 'not_started' check (status in ('not_started', 'pending', 'verified', 'failed')),
    records           jsonb not null default '[]',
    criado_em         timestamptz not null default now(),
    atualizado_em     timestamptz not null default now(),
    unique (user_id, dominio)
);

alter table email_domains enable row level security;

drop policy if exists "own_or_admin_email_domains" on email_domains;
create policy "own_or_admin_email_domains" on email_domains
    for all using (user_id = auth.uid() or is_admin(auth.uid()));
