import "dotenv/config";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import * as userModel from "../models/user.model";
import { generateAccessToken, generateRefreshToken } from "../utils/token";
import AppError from "../utils/AppError";
import catchAsync from "../utils/catchAsync";
import { Request, Response, NextFunction } from "express";
import type { User } from "../models/user.model";
import { requireEnv } from "../utils/env";

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
    return res.json({ accessToken, refreshToken });
  },
);

const refreshToken = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError("no refresh token", 401);

    let decoded: Pick<User, "id" | "role" | "token_version">;
    try {
      decoded = jwt.verify(refreshToken, requireEnv("REFRESH_TOKEN_SECRET"), {
        algorithms: ["HS256"],
      }) as Pick<User, "id" | "role" | "token_version">;
    } catch {
      throw new AppError("invalid refresh token", 403);
    }
    // باقي المنطق بعد decoded...
    const user = await userModel.findById(decoded.id);
    if (!user || decoded.token_version !== user.token_version)
      throw new AppError("unauthorized ", 401);

    const accessToken = generateAccessToken(user);
    return res.json({ accessToken });
  },
);

const logout = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) throw new AppError("unauthorized", 401);
    await userModel.incrementTokenVersion(req.user.id);
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
