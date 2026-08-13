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

function generateRefreshToken(
  user: Pick<User, "id" | "role" | "token_version">,
): string {
  const options: SignOptions = { expiresIn: "7d", algorithm: "HS256" };
  return jsonwebtoken.sign(
    {
      id: user.id,
      role: user.role,
      token_version: user.token_version,
    },
    REFRESH_SECRET,
    options,
  );
}

export { generateAccessToken, generateRefreshToken };
