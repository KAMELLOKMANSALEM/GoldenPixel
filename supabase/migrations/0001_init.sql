-- GoldenPixel schema
-- Two tables:
--   blocks            : one row per purchased/reserved unit (1/2/4/9 squares)
--   occupied_squares  : one row per taken cell, PRIMARY KEY (row, col)
-- The PK on (row, col) is what makes the wall race-safe: two browsers cannot both
-- insert the same cell, so the second reservation attempt fails atomically.

create extension if not exists "pgcrypto";

create type block_state  as enum ('reserved', 'sold');
create type block_status as enum ('live', 'removed');
create type cell_kind    as enum ('reserved', 'sold', 'blocked');

create table if not exists blocks (
  id                  uuid primary key default gen_random_uuid(),
  squares             jsonb not null,            -- [{row,col}, ...]
  size                smallint not null check (size in (1,2,4,9)),
  shape               text not null check (shape in ('1x1','1x2','2x1','2x2','3x3')),
  image_url           text,
  original_image_url  text,
  caption             text check (char_length(caption) <= 40),
  link_url            text,
  owner_email         text,
  state               block_state not null default 'reserved',
  reserved_until      timestamptz,
  status              block_status not null default 'live',
  flagged             boolean not null default false,
  -- moderation detail kept for the admin queue
  moderation          jsonb,
  -- payment bookkeeping
  amount_cents        integer not null,
  payment_provider    text,                      -- 'square' | 'paypal'
  payment_ref         text,                      -- provider order/payment id
  edit_token          text,                      -- for magic-link edit access
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);

create table if not exists occupied_squares (
  row       integer not null,
  col       integer not null,
  block_id  uuid references blocks(id) on delete cascade,
  kind      cell_kind not null,
  primary key (row, col)
);

-- Audit trail for admin actions (remove / refund+release).
create table if not exists admin_actions (
  id          uuid primary key default gen_random_uuid(),
  block_id    uuid references blocks(id) on delete set null,
  action      text not null,                      -- 'remove' | 'refund_release'
  admin_email text not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_blocks_status on blocks(status);
create index if not exists idx_blocks_state  on blocks(state);
create index if not exists idx_blocks_flagged on blocks(flagged) where flagged = true;
create index if not exists idx_blocks_reserved_until on blocks(reserved_until) where state = 'reserved';
create index if not exists idx_occ_block on occupied_squares(block_id);

-- ---------------------------------------------------------------------------
-- Atomic reserve. Inserts occupancy rows for every cell, then the block row.
-- If ANY cell is already taken, the PK conflict aborts the whole transaction
-- and no block is created. This is the race-safety guarantee.
-- `p_cells` is a jsonb array of {row, col}.
-- ---------------------------------------------------------------------------
create or replace function reserve_block(
  p_cells     jsonb,
  p_size      smallint,
  p_shape     text,
  p_amount    integer,
  p_minutes   integer
) returns blocks
language plpgsql
as $$
declare
  v_block   blocks;
  v_cell    jsonb;
  v_until   timestamptz := now() + (p_minutes || ' minutes')::interval;
begin
  insert into blocks (squares, size, shape, state, reserved_until, amount_cents)
  values (p_cells, p_size, p_shape, 'reserved', v_until, p_amount)
  returning * into v_block;

  for v_cell in select * from jsonb_array_elements(p_cells)
  loop
    insert into occupied_squares (row, col, block_id, kind)
    values ((v_cell->>'row')::int, (v_cell->>'col')::int, v_block.id, 'reserved');
    -- a PK conflict here raises unique_violation and rolls back the whole function
  end loop;

  return v_block;
end;
$$;

-- ---------------------------------------------------------------------------
-- Confirm payment: flip reserved -> sold, but only if the reservation is still
-- valid (block exists, still reserved, occupancy rows intact). Returns the block
-- on success, or null if it could no longer be honored (caller must refund).
-- ---------------------------------------------------------------------------
create or replace function confirm_block_paid(
  p_block_id  uuid,
  p_provider  text,
  p_ref       text
) returns blocks
language plpgsql
as $$
declare
  v_block blocks;
begin
  select * into v_block from blocks where id = p_block_id for update;
  if v_block is null then
    return null;
  end if;
  if v_block.state = 'sold' then
    return v_block; -- idempotent: webhook delivered twice
  end if;
  if v_block.state <> 'reserved' then
    return null;
  end if;

  update occupied_squares set kind = 'sold' where block_id = p_block_id;

  update blocks
     set state = 'sold',
         status = 'live',
         reserved_until = null,
         payment_provider = p_provider,
         payment_ref = p_ref,
         paid_at = now()
   where id = p_block_id
   returning * into v_block;

  return v_block;
end;
$$;

-- ---------------------------------------------------------------------------
-- Free expired reservations. Called by the cleanup cron AND opportunistically
-- on wall reads. Deleting the block cascades to its occupied_squares rows.
-- Returns the number of blocks released.
-- ---------------------------------------------------------------------------
create or replace function sweep_expired_reservations()
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  with deleted as (
    delete from blocks
     where state = 'reserved'
       and reserved_until is not null
       and reserved_until < now()
    returning id
  )
  select count(*) into v_count from deleted;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Refund + release: free the cells and delete the block (heavier admin action).
-- The Stripe/PayPal refund itself happens in app code; this clears the wall.
-- ---------------------------------------------------------------------------
create or replace function release_block(p_block_id uuid)
returns void
language plpgsql
as $$
begin
  delete from blocks where id = p_block_id; -- cascades occupied_squares
end;
$$;

-- RLS: lock the tables down. All app access goes through the service role
-- (server-side), which bypasses RLS. The browser never writes directly.
alter table blocks enable row level security;
alter table occupied_squares enable row level security;
alter table admin_actions enable row level security;

-- Optional read policy for the public wall if you ever query from the browser
-- with the anon key. Only live, sold art is exposed; reserved/removed details are not.
create policy "public reads live sold blocks"
  on blocks for select
  using (state = 'sold' and status = 'live');
