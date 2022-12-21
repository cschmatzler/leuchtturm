create schema if not exists "authentication";

create table authentication.user
(
    user_id       uuid primary key                                default uuid_generate_v1mc(),
    email         text collate "case_insensitive" unique not null,
    password_hash text                                   not null,
    created_at    timestamptz                            not null default now(),
    updated_at    timestamptz
);

SELECT trigger_updated_at('authentication.user');
