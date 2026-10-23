create table chat_state (
  user_id uuid primary key references auth.users on delete cascade,
  heat int not null default 40 check (heat between 0 and 100),
  summary text not null default '',
  last_seen timestamptz not null default now()
);

create table messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index on messages (user_id, created_at desc);

create table daily_usage (
  user_id uuid references auth.users on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

alter table chat_state enable row level security;
alter table messages enable row level security;
alter table daily_usage enable row level security;

create policy "own state" on chat_state for select using (auth.uid() = user_id);
create policy "own messages" on messages for select using (auth.uid() = user_id);
-- writes happen only from the Edge Function via the service role
