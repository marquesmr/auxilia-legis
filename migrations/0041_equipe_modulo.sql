create table if not exists equipe_modulos (
  equipe_id text not null references equipes (id) on delete cascade,
  modulo text not null,
  primary key (equipe_id, modulo)
);

create index if not exists equipe_modulos_modulo_idx on equipe_modulos (modulo);
