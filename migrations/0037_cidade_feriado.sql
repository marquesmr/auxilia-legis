alter table feriados add column if not exists municipio text not null default '';

create table if not exists usuario_local (
  user_id text primary key,
  cidade text not null,
  uf text not null default ''
);
