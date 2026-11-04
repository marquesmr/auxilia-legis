create table if not exists convite_link (
  token_hash text primary key,
  equipe_id text not null,
  email text not null,
  nome text not null,
  expira_em timestamptz not null
);
