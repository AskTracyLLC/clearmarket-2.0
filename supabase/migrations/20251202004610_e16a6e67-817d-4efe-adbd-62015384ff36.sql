-- Create rep_contact_unlocks table to track which vendors have unlocked which reps
create table if not exists public.rep_contact_unlocks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  vendor_user_id uuid not null references public.profiles(id) on delete cascade,
  rep_user_id uuid not null references public.profiles(id) on delete cascade,
  constraint rep_contact_unlocks_unique_pair unique (vendor_user_id, rep_user_id)
);

comment on table public.rep_contact_unlocks is
  'Tracks which vendors have paid credits to unlock specific field reps'' contact details.';
comment on column public.rep_contact_unlocks.vendor_user_id is
  'Vendor user_id who paid to unlock this rep''s contact info.';
comment on column public.rep_contact_unlocks.rep_user_id is
  'Field rep user_id whose contact info is unlocked for this vendor.';

-- Enable RLS
alter table public.rep_contact_unlocks enable row level security;

-- RLS policies
create policy "Vendors can view their own unlocks"
on public.rep_contact_unlocks
for select
to authenticated
using (auth.uid() = vendor_user_id);

create policy "Vendors can create unlocks for themselves"
on public.rep_contact_unlocks
for insert
to authenticated
with check (auth.uid() = vendor_user_id);

-- Create index for faster lookups
create index idx_rep_contact_unlocks_vendor on public.rep_contact_unlocks(vendor_user_id);
create index idx_rep_contact_unlocks_rep on public.rep_contact_unlocks(rep_user_id);

-- Create function to unlock rep contact atomically
create or replace function public.unlock_rep_contact(p_vendor_user_id uuid, p_rep_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_already_unlocked boolean;
begin
  -- Check if already unlocked (no extra charge)
  select exists(
    select 1
    from public.rep_contact_unlocks
    where vendor_user_id = p_vendor_user_id
      and rep_user_id = p_rep_user_id
  ) into v_already_unlocked;

  if v_already_unlocked then
    return jsonb_build_object('success', true, 'already_unlocked', true);
  end if;

  -- Get current balance
  select credits
  into v_balance
  from public.user_wallet
  where user_id = p_vendor_user_id
  for update;

  if v_balance is null then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  if v_balance < 1 then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  -- Deduct 1 credit
  update public.user_wallet
  set credits = credits - 1,
      updated_at = now()
  where user_id = p_vendor_user_id;

  -- Insert unlock record
  insert into public.rep_contact_unlocks (vendor_user_id, rep_user_id)
  values (p_vendor_user_id, p_rep_user_id)
  on conflict (vendor_user_id, rep_user_id) do nothing;

  -- Log transaction
  insert into public.vendor_credit_transactions (user_id, amount, action, metadata)
  values (
    p_vendor_user_id,
    -1,
    'unlock_contact',
    jsonb_build_object('rep_user_id', p_rep_user_id)
  );

  return jsonb_build_object('success', true, 'already_unlocked', false);
end;
$$;

comment on function public.unlock_rep_contact is
  'Deducts 1 credit from vendor wallet and creates rep_contact_unlocks row, if not already unlocked.';

-- Grant execute permission
grant execute on function public.unlock_rep_contact(uuid, uuid) to authenticated;