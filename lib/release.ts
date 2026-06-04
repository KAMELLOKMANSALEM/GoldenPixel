import { supabaseAdmin } from "./supabase/admin";

// Delete a block and free its cells (cascade to occupied_squares). Used for
// cancel, and by admin refund+release. The money side (refund) is handled by callers.
export async function releaseBlock(blockId: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.rpc("release_block", { p_block_id: blockId });
  if (error) throw error;
}
