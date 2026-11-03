create table if not exists pedido_exclusao (
  user_id text primary key,
  email text not null,
  motivo text not null,
  detalhe text not null default '',
  pedido_em timestamptz not null default now(),
  expira_em timestamptz not null
);
