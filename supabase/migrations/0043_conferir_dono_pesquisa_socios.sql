-- ════════════════════════════════════════════════════════════════════
-- 0043 — A pesquisa ligada a uma execução de "celular do sócio" tem de ser
-- do mesmo dono da execução
--
-- A RLS de bigdatacorp_enrichment_runs deixa o dono criar e editar as
-- próprias linhas direto pela API do banco. Com isso dava para apontar
-- `search_id` para a pesquisa de outra conta, e o worker (cliente admin)
-- gravava o celular do sócio e leads extras naquela pesquisa. O worker já
-- confere o dono (worker/bigdatacorp-enrichment-tick.ts); isto fecha a
-- porta também no banco.
-- ════════════════════════════════════════════════════════════════════

create or replace function conferir_dono_pesquisa_execucao()
returns trigger
language plpgsql as $$
begin
    if new.search_id is not null and not exists (
        select 1 from searches where id = new.search_id and user_id = new.user_id
    ) then
        raise exception 'A pesquisa informada não pertence a esta conta.';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_conferir_dono_pesquisa_execucao on bigdatacorp_enrichment_runs;
create trigger trg_conferir_dono_pesquisa_execucao
    before insert or update of search_id, user_id on bigdatacorp_enrichment_runs
    for each row execute function conferir_dono_pesquisa_execucao();
