import { db } from "./db";

// Delete a block and free its cells (cascade to occupied_squares). Used for
// cancel and by admin refund+release. The money side (refund) is handled by callers.
export async function releaseBlock(blockId: string): Promise<void> {
  const sql = db();
  await sql`select release_block(${blockId}::uuid)`;
}
