drop table if exists frota_agendamentos;
drop table if exists frota_sinistros;
drop table if exists frota_multas;
drop table if exists frota_manutencoes;
drop table if exists frota_abastecimentos;
drop table if exists frota_saidas;
drop table if exists frota_condutores;
drop table if exists frota_veiculos;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'equipe_modulos'
  ) then
    delete from equipe_modulos where modulo = 'frotas';
  end if;
end $$;
