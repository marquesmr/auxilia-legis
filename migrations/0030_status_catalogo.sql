create table if not exists status_catalogo (
  id text primary key,
  area text not null,
  codigo text not null,
  nome text not null,
  ordem int not null default 100,
  encerra boolean not null default false,
  fixo boolean not null default false,
  tramite_dias integer,
  tramite_codigo text,
  unique (area, codigo)
);

alter table processos_admin add column if not exists status_em date;

insert into status_catalogo (id, area, codigo, nome, ordem, encerra, fixo) values
  ('leg-andamento', 'legislativo', 'andamento', 'Em andamento', 1, false, true),
  ('leg-concluido', 'legislativo', 'concluido', 'Arquivado', 2, true, true),
  ('adm-proposta', 'administrativo', 'proposta', 'Recebendo proposta', 1, false, true),
  ('adm-pareceres', 'administrativo', 'pareceres', 'Pareceres', 2, false, true),
  ('adm-assinatura', 'administrativo', 'assinatura', 'Assinatura de contrato', 3, false, true),
  ('adm-execucao', 'administrativo', 'execucao', 'Execução', 4, false, true),
  ('adm-encerrado', 'administrativo', 'encerrado', 'Encerrado', 5, true, true),
  ('adm-cancelado', 'administrativo', 'cancelado', 'Cancelado', 6, true, true)
on conflict (area, codigo) do nothing;
