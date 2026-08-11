-- Create table for storing active SOS locations
create table if not exists public.sos_locations (
  user_id uuid references auth.users on delete cascade primary key,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  is_active boolean default true not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.sos_locations enable row level security;

-- Create policies
create policy "Allow select of active locations by user_id"
  on public.sos_locations for select
  using (is_active = true);

create policy "Allow users to manage their own location updates"
  on public.sos_locations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
