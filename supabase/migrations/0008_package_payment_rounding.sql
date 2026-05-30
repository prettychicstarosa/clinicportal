-- =========================================================
-- PRETTY CHIC — PACKAGE PAYMENT ROUNDING FIX
-- A package whose remaining balance is under ₱1 (rounding noise,
-- e.g. price 3998 / paid 3998 leaving 0.01) is treated as fully Paid
-- and its stored balance is zeroed so it displays ₱0.00.
-- Safe to re-run.
-- =========================================================

create or replace function public.refresh_package_payment()
returns trigger as $$
begin
  NEW.balance := greatest(0, coalesce(NEW.price, 0) - coalesce(NEW.amount_paid, 0));

  if coalesce(NEW.price, 0) <= 0 then
    NEW.payment_status := 'Unpaid';
  elsif NEW.balance <= 0.99 then
    -- Within rounding tolerance → fully paid.
    NEW.balance := 0;
    NEW.payment_status := 'Paid';
  elsif coalesce(NEW.amount_paid, 0) > 0 then
    NEW.payment_status := 'Partial';
  else
    NEW.payment_status := 'Unpaid';
  end if;

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_packages_payment on public.packages;
create trigger trg_packages_payment
before insert or update of price, amount_paid on public.packages
for each row execute function public.refresh_package_payment();

-- Backfill existing rows so already-saved packages pick up the new rule.
-- Re-assigning amount_paid keeps it in the trigger's "update of" column list,
-- which re-runs refresh_package_payment() and recomputes balance + status.
update public.packages set amount_paid = amount_paid;

-- Refresh PostgREST schema cache.
notify pgrst, 'reload schema';

-- =========================================================
-- DONE
-- =========================================================
