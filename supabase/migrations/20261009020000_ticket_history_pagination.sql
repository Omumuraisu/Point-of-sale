create index if not exists ticket_transactions_issued_at_id_idx
  on public.ticket_transactions (issued_at desc, id desc);
