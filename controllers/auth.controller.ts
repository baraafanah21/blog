import "dotenv/config";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import * as userModel from "../models/user.model";
import * as refreshTokenModel from "../models/refreshToken.model";
import { generateAccessToken, generateRefreshToken } from "../utils/token";
import AppError from "../utils/AppError";
import catchAsync from "../utils/catchAsync";
import { Request, Response, NextFunction } from "express";
import type { User } from "../models/user.model";
import { requireEnv } from "../utils/env";

/**
 * A client can legitimately fire two refreshes at once — two requests hit 401
 * together — and the loser arrives after rotation to find a row revoked seconds
 * ago. That is a race, not a theft, so a token revoked this recently is still
 * served. The cost is a short window in which a stolen token also passes.
 */
const REUSE_GRACE_MS = 15_000;

/**
 * The token's own exp claim decides when its stored row expires, so the
 * JWT and the database can never drift apart on the same token's lifetime.
 */
const expiryOf = (token: string): Date => {
  const payload = jwt.decode(token);
  if (!payload || typeof payload === "string" || !payload.exp)
    throw new AppError("could not issue refresh token", 500);
  return new Date(payload.exp * 1000);
};

const signup = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { username, password } = req.body;
    if (await userModel.findByUsername(username))
      throw new AppError("already exists", 409);
    const password_hash = await bcrypt.hash(password, 10);
    await userModel.createUser({ username, password_hash });
    return res.status(201).json({ message: "created" });
  },
);

const login = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { username, password } = req.body;
    const DUMMY =
      "$2a$10$BD6VlkyUFe8t4iBCNm53NeFukmLw.1CxHoPd75JaIEGqYenBewGg.";
    const user = await userModel.findByUsername(username);
    if (!user) {
      await bcrypt.compare("anything", DUMMY);
      throw new AppError("Wrong Data", 401);
    }
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) throw new AppError("Wrong Data", 401);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await refreshTokenModel.save(
      user.id,
      refreshTokenModel.hashToken(refreshToken),
      expiryOf(refreshToken),
    );

    return res.json({ accessToken, refreshToken });
  },
);

const refreshToken = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { refreshToken: presented } = req.body;
    if (!presented) throw new AppError("no refresh token", 401);

    let decoded: Pick<User, "id" | "token_version">;
    try {
      decoded = jwt.verify(presented, requireEnv("REFRESH_TOKEN_SECRET"), {
        algorithms: ["HS256"],
      }) as Pick<User, "id" | "token_version">;
    } catch {
      throw new AppError("invalid refresh token", 403);
    }

    const presentedHash = refreshTokenModel.hashToken(presented);
    const stored = await refreshTokenModel.findByHash(presentedHash);

    // A signature-valid token the store never issued means a copy of it is
    // circulating. Burn every session for that user instead of serving it.
    if (!stored) {
      await refreshTokenModel.revokeAllForUser(decoded.id);
      throw new AppError("invalid refresh token", 403);
    }

    const revokedAt = stored.revoked_at?.getTime();
    const withinGrace =
      revokedAt !== undefined && Date.now() - revokedAt <= REUSE_GRACE_MS;

    // A revoked token presented long after the fact is a leaked copy.
    if (revokedAt !== undefined && !withinGrace) {
      await refreshTokenModel.revokeAllForUser(stored.user_id);
      throw new AppError("invalid refresh token", 403);
    }

    // The stored row is the authority on expiry, not just the exp claim.
    if (stored.expires_at.getTime() <= Date.now())
      throw new AppError("invalid refresh token", 403);

    const user = await userModel.findById(decoded.id);
    if (!user || decoded.token_version !== user.token_version)
      throw new AppError("unauthorized ", 401);

    const accessToken = generateAccessToken(user);

    // The loser of a race gets an access token and nothing else: the winner
    // already minted the replacement refresh token, and rotating a second time
    // would leave the client holding two live ones.
    if (withinGrace) return res.json({ accessToken });

    const newRefreshToken = generateRefreshToken(user);

    await refreshTokenModel.rotate(
      presentedHash,
      user.id,
      refreshTokenModel.hashToken(newRefreshToken),
      expiryOf(newRefreshToken),
    );

    return res.json({ accessToken, refreshToken: newRefreshToken });
  },
);

const logout = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) throw new AppError("unauthorized", 401);
    const { refreshToken: presented } = req.body ?? {};

    // With a refresh token we end just that session. Without one we keep the
    // old meaning of logout — end every session — which revokeAllForUser does
    // by also bumping token_version, killing outstanding access tokens.
    if (!presented) {
      await refreshTokenModel.revokeAllForUser(req.user.id);
      return res.status(200).json({ message: "logged out" });
    }

    const stored = await refreshTokenModel.findByHash(
      refreshTokenModel.hashToken(presented),
    );
    // Never let one user revoke another user's session; an unknown token is
    // already logged out, so treat that as success and stay idempotent.
    if (stored && stored.user_id !== req.user.id)
      throw new AppError("unauthorized", 401);
    if (stored) await refreshTokenModel.revoke(stored.token_hash);

    return res.status(200).json({ message: "logged out" });
  },
);

const updatePass = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { currentPass, newPass } = req.body;
    if (!req.user) throw new AppError("unauthorized", 401);
    const user = await userModel.findById(req.user.id);
    if (!user) throw new AppError("unauthorized", 401);
    const isMatch = await bcrypt.compare(currentPass, user.password_hash);

    if (!isMatch) throw new AppError("unauthorized", 401);

    const password_hash = await bcrypt.hash(newPass, 10);
    await userModel.updatePasswordTx(user.id, password_hash);
    return res.status(200).json({ message: "success" });
  },
);

export { signup, login, refreshToken, logout, updatePass };
