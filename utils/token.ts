import jsonwebtoken, { SignOptions } from "jsonwebtoken";
import "dotenv/config";
import { requireEnv } from "./env";
import type { User } from "../models/user.model";
const ACCESS_SECRET = requireEnv("ACCESS_TOKEN_SECRET");
const REFRESH_SECRET = requireEnv("REFRESH_TOKEN_SECRET");
function generateAccessToken(
  user: Pick<User, "id" | "role" | "token_version">,
): string {
  const options: SignOptions = {
    expiresIn: "15m",
    algorithm: "HS256",
  };
  return jsonwebtoken.sign(
    {
      id: user.id,
      role: user.role,
      token_version: user.token_version,
    },
    ACCESS_SECRET,
    options,
  );
}

/**
 * A refresh token proves one thing: the right to renew. It carries no role,
 * because a role baked in here would outlive a role change by up to 7 days.
 * The role is read from the database at issue time instead.
 */
function generateRefreshToken(
  user: Pick<User, "id" | "token_version">,
): string {
  const options: SignOptions = { expiresIn: "7d", algorithm: "HS256" };
  return jsonwebtoken.sign(
    {
      id: user.id,
      token_version: user.token_version,
    },
    REFRESH_SECRET,
    options,
  );
}

export { generateAccessToken, generateRefreshToken };
