alter table feriados add column if not exists status text not null default 'ativo';
alter table feriados add column if not exists ambito text not null default '';
