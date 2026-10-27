begin;

create or replace view public.v_monthly_bill_balances
with (security_invoker = true)
as
select
  bill.monthly_bill_id,
  bill.billing_cycle_id,
  bill.business_owner_id,
  bill.business_id,
  bill.stall_number,
  bill.billing_month,
  bill.due_date,
  bill.owner_name,
  bill.business_name,
  bill.issued_at,
  totals.total_amount,
  totals.rent_amount,
  totals.electricity_amount,
  totals.water_amount,
  totals.other_amount,
  allocations.applied_amount,
  greatest(totals.total_amount - allocations.applied_amount, 0::numeric) as balance,
  case
    when greatest(totals.total_amount - allocations.applied_amount, 0::numeric) = 0 then 'fully_paid'
    when allocations.applied_amount > 0 and bill.due_date < (timezone('Asia/Manila', now()))::date then 'overdue_partially_paid'
    when allocations.applied_amount > 0 then 'partially_paid'
    when bill.due_date < (timezone('Asia/Manila', now()))::date then 'overdue'
    else 'pending'
  end as status,
  (
    greatest(totals.total_amount - allocations.applied_amount, 0::numeric) > 0
    and bill.billing_month < max(bill.billing_month) over (partition by bill.business_owner_id)
  ) as is_arrears,
  charges.charge_breakdown,
  history.payment_history
from public.monthly_bills bill
cross join lateral (
  select
    round(coalesce(sum(charge.amount), 0), 2) as total_amount,
    round(coalesce(sum(charge.amount) filter (where charge.charge_code = 'rent'), 0), 2) as rent_amount,
    round(coalesce(sum(charge.amount) filter (where charge.charge_code = 'electricity'), 0), 2) as electricity_amount,
    round(coalesce(sum(charge.amount) filter (where charge.charge_code = 'water'), 0), 2) as water_amount,
    round(coalesce(sum(charge.amount) filter (where charge.charge_code not in ('rent', 'electricity', 'water')), 0), 2) as other_amount
  from public.monthly_bill_charges charge
  where charge.monthly_bill_id = bill.monthly_bill_id
) totals
cross join lateral (
  select round(coalesce(sum(allocation.amount), 0), 2) as applied_amount
  from public.payment_allocations allocation
  where allocation.monthly_bill_id = bill.monthly_bill_id
) allocations
cross join lateral (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', charge.monthly_bill_charge_id,
    'code', charge.charge_code,
    'label', charge.charge_label,
    'amount', charge.amount,
    'description', charge.description,
    'utilityType', charge.utility_type
  ) order by charge.monthly_bill_charge_id), '[]'::jsonb) as charge_breakdown
  from public.monthly_bill_charges charge
  where charge.monthly_bill_id = bill.monthly_bill_id
) charges
cross join lateral (
  select coalesce(jsonb_agg(jsonb_build_object(
    'transactionId', payment_transaction.payment_transaction_id,
    'allocationId', allocation.payment_allocation_id,
    'amount', allocation.amount,
    'paymentDate', payment_transaction.payment_date,
    'referenceNumber', payment_transaction.reference_number,
    'notes', payment_transaction.notes,
    'recordedByStaffId', payment_transaction.recorded_by_staff_id,
    'recordedBy', public.billing_payment_recorder_name(payment_transaction.payment_transaction_id),
    'recordedAt', payment_transaction.recorded_at,
    'utilityType', allocation.utility_type
  ) order by payment_transaction.payment_date desc, payment_transaction.payment_transaction_id desc), '[]'::jsonb) as payment_history
  from public.payment_allocations allocation
  join public.payment_transactions payment_transaction
    on payment_transaction.payment_transaction_id = allocation.payment_transaction_id
  where allocation.monthly_bill_id = bill.monthly_bill_id
) history;

revoke all on public.v_monthly_bill_balances from anon;
grant select on public.v_monthly_bill_balances to authenticated;

commit;

notify pgrst, 'reload schema';
