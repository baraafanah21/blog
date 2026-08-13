import { pool } from "../config/db";
interface User {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  token_version: number;
}

async function createUser(
  user: Pick<User, "username" | "password_hash">,
): Promise<User | undefined> {
  const result = await pool.query<User>(
    `INSERT INTO users (username, password_hash, role, token_version)
VALUES ($1, $2, $3, $4) RETURNING *`,
    [user.username, user.password_hash, "user", 0],
  );

  return result.rows[0];
}

async function findByUsername(username: string): Promise<User | undefined> {
  const result = await pool.query<User>(
    "Select * from users where username= $1 ",
    [username],
  );
  return result.rows[0];
}

async function findById(id: number): Promise<User | undefined> {
  const result = await pool.query<User>("SELECT * FROM USERS WHERE id =$1", [
    id,
  ]);
  return result.rows[0];
}

async function incrementTokenVersion(id: number): Promise<User | undefined> {
  const result = await pool.query<User>(
    "update users  set token_version=token_version +1 where id=$1  RETURNING * ",
    [id],
  );
  return result.rows[0];
}

async function updatePasswordTx(id: number, newHash: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      newHash,
      id,
    ]);

    await client.query(
      "UPDATE users SET token_version = token_version + 1 WHERE id = $1",
      [id],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export {
  createUser,
  findById,
  findByUsername,
  updatePasswordTx,
  incrementTokenVersion,
};
export type { User };
