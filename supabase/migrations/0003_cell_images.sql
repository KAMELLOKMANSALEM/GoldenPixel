-- Per-cell artwork ("simulation module"): a multi-square block is built from one
-- image per cell. cell_images is a jsonb array of image URLs in the SAME order as
-- the block's `squares` (row-major: index = dr*width + dc). A single 1x1 block has
-- a one-element array. The wall and lightbox render these assembled as a mosaic.

alter table applications add column if not exists cell_images jsonb;
alter table blocks       add column if not exists cell_images jsonb;

-- place_block must also copy cell_images from the application to the new block.
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
  if v_app.status = 'published' and v_app.block_id is not null then
    select * into v_block from blocks where id = v_app.block_id;
    return v_block;
  end if;
  if v_app.status <> 'approved' then
    return null;
  end if;

  insert into blocks (
    squares, size, shape, state, status, amount_cents,
    image_url, original_image_url, cell_images, caption, link_url, owner_email,
    flagged, moderation, payment_provider, payment_ref, paid_at, application_id
  )
  values (
    p_cells, v_app.size, v_app.shape, 'sold', 'live', v_app.amount_cents,
    v_app.image_url, v_app.original_image_url, v_app.cell_images, v_app.caption, v_app.link_url, v_app.email,
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
