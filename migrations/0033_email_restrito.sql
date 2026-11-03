create table if not exists email_restrito (
  email text primary key,
  nascimento date,
  restrito_ate timestamptz not null,
  criado_em timestamptz not null default now()
);
