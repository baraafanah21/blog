import crypto from "node:crypto";
import { pool } from "../config/db";

export interface RefreshTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

/**
 * Creates a SHA-256 fingerprint of a refresh token.
 * Do NOT use bcrypt here: the token is already a high-entropy secret.
 */
export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
};

/**
 * Stores a new refresh token hash.
 */
export async function save(
  userId: number,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await pool.query(
    `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [userId, tokenHash, expiresAt],
  );
}

/**
 * Finds a refresh token by its hash.
 * Returns the complete row because callers need revoked_at,
 * expires_at, and user_id.
 */
export async function findByHash(
  tokenHash: string,
): Promise<RefreshTokenRow | undefined> {
  const result = await pool.query<RefreshTokenRow>(
    `
      SELECT
        id,
        user_id,
        token_hash,
        expires_at,
        revoked_at,
        created_at
      FROM refresh_tokens
      WHERE token_hash = $1
      LIMIT 1
    `,
    [tokenHash],
  );

  return result.rows[0];
}

/**
 * Revokes one refresh token.
 * We keep the row instead of deleting it so its revoked state
 * remains auditable and detectable.
 */
export async function revoke(tokenHash: string): Promise<void> {
  await pool.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = COALESCE(revoked_at, now())
      WHERE token_hash = $1
    `,
    [tokenHash],
  );
}

/**
 * Rotation is one conceptual decision, so it gets one name and one
 * transaction: the old token dies exactly when the new one is born.
 * Two separate calls from a controller would look independent and are
 * easy to forget half of later.
 */
export async function rotate(
  oldHash: string,
  userId: number,
  newHash: string,
  expiresAt: Date,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, now())
       WHERE token_hash = $1`,
      [oldHash],
    );
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, newHash, expiresAt],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Revokes all active refresh tokens belonging to a user.
 */
export async function revokeAllForUser(userId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
    await client.query(
      `UPDATE users SET token_version = token_version + 1
       WHERE id = $1`,
      [userId],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteExpired(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM refresh_tokens
     WHERE expires_at < now() - INTERVAL '7 days'`,
  );
  return result.rowCount ?? 0;
}
