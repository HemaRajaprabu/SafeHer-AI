-- 1. Create emergency_contacts table
create table if not exists public.emergency_contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null, -- The victim
  contact_name text not null,
  contact_phone text not null,
  contact_email text not null, -- The contact's email to authorize them
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, contact_email)
);

-- Enable RLS on emergency_contacts
alter table public.emergency_contacts enable row level security;

-- Policies for emergency_contacts
create policy "Allow users to manage their own emergency contacts"
  on public.emergency_contacts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Modify sos_locations RLS policies
-- Drop the previous open SELECT policy
drop policy if exists "Allow select of active locations by user_id" on public.sos_locations;

-- Create secure policy for emergency contacts and row owner
create policy "Allow emergency contacts to read active location"
  on public.sos_locations for select
  using (
    (auth.uid() = user_id) or (
      is_active = true and
      exists (
        select 1 from public.emergency_contacts ec
        where ec.user_id = sos_locations.user_id
        and ec.contact_email = (
          select email from public.profiles
          where id = auth.uid()
        )
      )
    )
  );
