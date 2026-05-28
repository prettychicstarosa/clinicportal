-- =========================================================
-- PRETTY CHIC PORTAL FULL UPDATED PATCH
-- =========================================================

-- OWNER / ROLES
alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (role in ('owner','admin','staff','receptionist'));

alter table public.profiles
add column if not exists username text;

alter table public.profiles
add column if not exists phone text;

create unique index if not exists profiles_username_unique
on public.profiles (lower(username))
where username is not null;

create or replace function public.is_owner() returns boolean as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'owner'
    and p.is_active = true
  );
$$ language sql stable security definer;

create or replace function public.is_admin() returns boolean as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('owner','admin')
    and p.is_active = true
  );
$$ language sql stable security definer;

-- SETTINGS / LOGO
alter table public.settings
add column if not exists clinic_phone text;

alter table public.settings
add column if not exists clinic_address text;

alter table public.settings
add column if not exists logo_url text;

alter table public.settings
add column if not exists loading_logo_url text;

-- CLIENTS
alter table public.clients
add column if not exists last_visit date;

alter table public.clients
add column if not exists emergency_contact text;

alter table public.clients
add column if not exists consent_notes text;

-- PACKAGES
alter table public.packages
add column if not exists amount_paid numeric(12,2) default 0;

alter table public.packages
add column if not exists balance numeric(12,2) default 0;

alter table public.packages
add column if not exists payment_status text default 'Unpaid';

alter table public.packages
add column if not exists remaining_sessions integer default 0;

alter table public.packages
add column if not exists interval_type text default 'Weekly';

alter table public.packages
add column if not exists interval_days integer default 7;

alter table public.packages
add column if not exists interval_label text default 'Weekly';

alter table public.packages
add column if not exists start_date date;

alter table public.packages
add column if not exists valid_until date;

alter table public.packages
add column if not exists status text default 'Active';

alter table public.packages
add column if not exists notes text;

alter table public.packages
add column if not exists first_appointment_date date;

alter table public.packages
add column if not exists first_appointment_time time;

-- APPOINTMENTS
alter table public.appointments
add column if not exists package_id uuid references public.packages(id) on delete set null;

alter table public.appointments
add column if not exists package_name text;

alter table public.appointments
add column if not exists generated_from_package boolean default false;

-- PAYMENTS
alter table public.payments
add column if not exists package_id uuid references public.packages(id) on delete cascade;

alter table public.payments
add column if not exists payment_status text default 'Paid';

alter table public.payments
add column if not exists payment_date date default current_date;

-- INVENTORY
alter table public.inventory
add column if not exists containers numeric(12,2) default 0;

alter table public.inventory
add column if not exists container_type text default 'vial';

alter table public.inventory
add column if not exists container_size numeric(12,2) default 1;

alter table public.inventory
add column if not exists measurement_unit text default 'ml';

alter table public.inventory
add column if not exists total_usable_quantity numeric(12,2) default 0;

-- INVENTORY LOGS
alter table public.inventory_logs
add column if not exists client_id uuid references public.clients(id) on delete set null;

alter table public.inventory_logs
add column if not exists appointment_id uuid references public.appointments(id) on delete set null;

alter table public.inventory_logs
add column if not exists unit text;

alter table public.inventory_logs
add column if not exists note text;

-- AUTO PACKAGE PAYMENT UPDATE
create or replace function public.update_package_payment()
returns trigger as $$
begin
  if NEW.package_id is not null then
    update public.packages
    set
      amount_paid = (
        select coalesce(sum(amount),0)
        from public.payments
        where package_id = NEW.package_id
      ),
      balance = greatest(
        price - (
          select coalesce(sum(amount),0)
          from public.payments
          where package_id = NEW.package_id
        ),
        0
      ),
      payment_status =
        case
          when price - (
            select coalesce(sum(amount),0)
            from public.payments
            where package_id = NEW.package_id
          ) <= 0 then 'Paid'
          when (
            select coalesce(sum(amount),0)
            from public.payments
            where package_id = NEW.package_id
          ) > 0 then 'Partial'
          else 'Unpaid'
        end
    where id = NEW.package_id;
  end if;

  update public.clients
  set
    balance = (
      select coalesce(sum(balance),0)
      from public.packages
      where client_id = NEW.client_id
    ),
    payment_status =
      case
        when (
          select coalesce(sum(balance),0)
          from public.packages
          where client_id = NEW.client_id
        ) <= 0 then 'Paid'
        when (
          select coalesce(sum(amount_paid),0)
          from public.packages
          where client_id = NEW.client_id
        ) > 0 then 'Partial'
        else 'Unpaid'
      end
  where id = NEW.client_id;

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_update_package_payment on public.payments;

create trigger trg_update_package_payment
after insert or update on public.payments
for each row execute function public.update_package_payment();

-- AUTO REMAINING SESSIONS WHEN APPOINTMENT DONE
create or replace function public.update_remaining_sessions()
returns trigger as $$
begin
  if NEW.status = 'Done'
     and OLD.status is distinct from 'Done'
     and NEW.package_id is not null then

    update public.packages
    set
      used_sessions = used_sessions + 1,
      remaining_sessions = greatest(total_sessions - (used_sessions + 1), 0)
    where id = NEW.package_id;

  end if;

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_update_remaining_sessions on public.appointments;

create trigger trg_update_remaining_sessions
after update on public.appointments
for each row execute function public.update_remaining_sessions();

-- OWNER PROTECTION
create or replace function public.prevent_owner_modification()
returns trigger as $$
begin
  if OLD.role = 'owner' then
    if TG_OP = 'DELETE' then
      raise exception 'Owner account cannot be deleted';
    end if;

    if NEW.role <> 'owner' then
      raise exception 'Owner role cannot be changed';
    end if;

    if NEW.is_active = false then
      raise exception 'Owner account cannot be disabled';
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_owner_modification on public.profiles;

create trigger trg_prevent_owner_modification
before update or delete on public.profiles
for each row execute function public.prevent_owner_modification();

-- SET OWNER ACCOUNT
update public.profiles
set
  role = 'owner',
  full_name = coalesce(nullif(full_name,''), 'Pretty Chic Owner'),
  username = coalesce(username, 'owner'),
  is_active = true
where email = 'prettychicstarosa@gmail.com';

-- REFRESH SUPABASE SCHEMA CACHE
notify pgrst, 'reload schema';

-- =========================================================
-- DONE
-- =========================================================