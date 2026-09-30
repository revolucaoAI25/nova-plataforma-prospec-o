-- ============================================================
-- Correção de uma falha real na lógica de pagamento: em
-- marcarCompraPaga (avulso) e processarPagamentoAssinatura (plano), o
-- "marcar como processado" (UPDATE status='pago' / INSERT em
-- subscription_payments — o que garante idempotência contra reentrega do
-- webhook) e o "creditar o saldo" (increment_creditos) eram duas
-- chamadas SEPARADAS ao banco. Se a 2ª falhasse depois da 1ª ter tido
-- sucesso (rede, timeout, qualquer hiccup transitório), o pagamento
-- ficava marcado como processado pra sempre, mas o crédito nunca chegava
-- — e nenhum reenvio futuro do mesmo evento (o Asaas reentrega "at least
-- once") conseguiria consertar, porque a guarda de idempotência
-- (status != 'pendente' / conflito de unique) já bloqueia reprocessar.
-- Créditos perdidos silenciosamente, sem qualquer log.
--
-- Fix: as duas escritas agora acontecem dentro de uma função
-- plpgsql (uma única transação implícita) — se o crédito falhar, o
-- marcar-como-processado é desfeito junto, e o próximo reenvio do
-- webhook reprocessa do zero corretamente. `processarPagamentoAddon`
-- não precisou do mesmo tratamento porque não credita nada (só concede
-- um feature_flag, uma operação idempotente por natureza — reaplicar
-- não duplica efeito).
-- ============================================================

create or replace function marcar_compra_paga_e_creditar(p_payment_id text)
returns boolean
language plpgsql security definer as $$
declare
    v_user_id     uuid;
    v_quantidade  integer;
begin
    update credit_purchases
       set status = 'pago', pago_em = now()
     where asaas_payment_id = p_payment_id
       and status = 'pendente'
    returning user_id, quantidade_creditos into v_user_id, v_quantidade;

    if not found then
        return false; -- não existe ou já foi processada (reentrega do webhook) — não é erro.
    end if;

    update profiles set creditos = creditos + v_quantidade where id = v_user_id;
    return true;
end;
$$;

create or replace function registrar_pagamento_assinatura_e_creditar(
    p_user_id                uuid,
    p_plan_id                uuid,
    p_asaas_subscription_id  text,
    p_asaas_payment_id       text,
    p_preco_centavos         integer,
    p_creditos               integer
) returns boolean
language plpgsql security definer as $$
begin
    insert into subscription_payments (user_id, plan_id, asaas_subscription_id, asaas_payment_id, preco_centavos, status)
    values (p_user_id, p_plan_id, p_asaas_subscription_id, p_asaas_payment_id, p_preco_centavos, 'pago');

    if p_creditos > 0 then
        update profiles set creditos = creditos + p_creditos where id = p_user_id;
    end if;

    return true;
exception
    when unique_violation then
        return false; -- reentrega do mesmo evento (asaas_payment_id já existe) — não é erro.
end;
$$;
