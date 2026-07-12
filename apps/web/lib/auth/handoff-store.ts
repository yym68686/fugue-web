import "server-only";

import { ensureDbSchema } from "@/lib/db/schema";
import { queryDb } from "@/lib/db/pool";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function consumeSessionHandoff(id: string, expiresAt: number) {
  if (
    !isUuid(id) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1_000)
  ) {
    return false;
  }

  await ensureDbSchema();
  const result = await queryDb<{ id: string }>(
    `
      INSERT INTO app_auth_consumed_handoffs (id, expires_at)
      VALUES ($1, to_timestamp($2))
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `,
    [id, expiresAt],
  );

  await queryDb(
    `
      DELETE FROM app_auth_consumed_handoffs
      WHERE expires_at < NOW() - INTERVAL '1 day'
    `,
  );

  return result.rowCount === 1;
}
