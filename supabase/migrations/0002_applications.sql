-- GoldenPixel — eligibility funnel.
-- The product moved from instant-publish to a gated application flow. An
-- `applications` row now carries an artist through: survey -> (theatrical)
-- eligibility -> pay -> submit art -> admin review -> place square -> publish.
-- A `blocks` row is created only at publish, so the public wall query
-- (state='sold', status='live') is unchanged.

create type application_status as enum (
  'eligible',   -- survey done, passed the (theatrical) check, not yet paid
  'paid',       -- payment confirmed server-side
  'submitted',  -- artwork submitted, awaiting admin review
  'approved',   -- admin approved; artist may place + publish
  'rejected',   -- admin rejected; refunded
  'refunded',   -- payment refunded (reject or admin reversal)
  'published'   -- placed on the wall (block created)
);

create table if not exists applications (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  survey              jsonb not null default '{}'::jsonb,
  size                smallint not null check (size in (1,2,4,9)),
  shape               text not null check (shape in ('1x1','1x2','2x1','2x2','3x3')),
  amount_cents        integer not null,
  status              application_status not null default 'eligible',
  payment_provider    text,
  payment_ref         text,
  paid_at             timestamptz,
  image_url           text,
  original_image_url  text,
  caption             text check (char_length(caption) <= 40),
  link_url            text,
  flagged             boolean not null default false,
  moderation          jsonb,
  review_notes        text,
  reviewed_by         text,
  reviewed_at         timestamptz,
  refunded_at         timestamptz,
  block_id            uuid references blocks(id) on delete set null,
  access_token        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_applications_status on applications(status);
create index if not exists idx_applications_flagged on applications(flagged) where flagged = true;
create index if not exists idx_applications_payment_ref on applications(payment_ref);

-- Traceability from a published block back to its application.
alter table blocks add column if not exists application_id uuid references applications(id) on delete set null;

alter table applications enable row level security;
-- No public policies: all access is server-side via the service role.

-- ---------------------------------------------------------------------------
-- Publish step: an APPROVED + PAID application places its block. Atomically
-- claims the cells (occupied_squares PK on (row,col) is the race guard) and
-- creates a sold/live block, copying the submitted art/caption/link/owner.
-- Returns the new block, or null if the application isn't in a placeable state.
-- A cell conflict raises unique_violation (caller maps to 409 -> pick again).
-- ---------------------------------------------------------------------------
create or replace function place_block(
  p_application_id uuid,
  p_cells          jsonb
) returns blocks
language plpgsql
as $$
declare
  v_app    applications;
  v_block  blocks;
  v_cell   jsonb;
begin
  select * into v_app from applications where id = p_application_id for update;
  if v_app is null then
    return null;
  end if;
  -- Idempotent: if already published, return the existing block.
  if v_app.status = 'published' and v_app.block_id is not null then
    select * into v_block from blocks where id = v_app.block_id;
    return v_block;
  end if;
  if v_app.status <> 'approved' then
    return null;
  end if;

  insert into blocks (
    squares, size, shape, state, status, amount_cents,
    image_url, original_image_url, caption, link_url, owner_email,
    flagged, moderation, payment_provider, payment_ref, paid_at, application_id
  )
  values (
    p_cells, v_app.size, v_app.shape, 'sold', 'live', v_app.amount_cents,
    v_app.image_url, v_app.original_image_url, v_app.caption, v_app.link_url, v_app.email,
    v_app.flagged, v_app.moderation, v_app.payment_provider, v_app.payment_ref, v_app.paid_at,
    v_app.id
  )
  returning * into v_block;

  for v_cell in select * from jsonb_array_elements(p_cells)
  loop
    insert into occupied_squares (row, col, block_id, kind)
    values ((v_cell->>'row')::int, (v_cell->>'col')::int, v_block.id, 'sold');
  end loop;

  update applications
     set status = 'published', block_id = v_block.id, updated_at = now()
   where id = p_application_id;

  return v_block;
end;
$$;
