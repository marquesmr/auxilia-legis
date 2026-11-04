create table if not exists frota_veiculos (
  id text primary key,
  user_id text not null references "user" (id) on delete cascade,
  team_id text,
  placa text not null,
  descricao text not null,
  ano integer,
  tipo text not null,
  combustivel text not null,
  km integer not null default 0,
  situacao text not null,
  setor text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists frota_veiculos_user_idx on frota_veiculos (user_id);
create index if not exists frota_veiculos_team_idx on frota_veiculos (team_id);

create table if not exists frota_saidas (
  id text primary key,
  veiculo_id text not null references frota_veiculos (id) on delete cascade,
  user_id text not null,
  motorista text not null,
  destino text not null,
  motivo text not null default '',
  saida_em date not null,
  km_saida integer not null,
  retorno_em date,
  km_retorno integer,
  created_at timestamptz not null default now()
);

create index if not exists frota_saidas_veiculo_idx on frota_saidas (veiculo_id);
