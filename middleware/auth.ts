import jsonwebtoken from "jsonwebtoken";
import { findById } from "../models/user.model";
import type { User } from "../models/user.model";
import { requireEnv } from "../utils/env";

import { Request, Response, NextFunction } from "express";

const authMiddleWare = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  const authHeader = req.get("Authorization");
  if (!authHeader) return res.status(401).json({ message: "unauthorized" });
  if (!authHeader.startsWith("Bearer "))
    return res.status(401).json({ message: "unauthorized" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jsonwebtoken.verify(
      token,
      requireEnv("ACCESS_TOKEN_SECRET"),
      { algorithms: ["HS256"] },
    ) as Pick<User, "id" | "role" | "token_version">;
    const user = await findById(decoded.id);
    if (!user) return res.status(401).json({ message: "unauthorized" });
    if (user.token_version !== decoded.token_version)
      return res.status(401).json({ message: "unauthorized" });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "unauthorized" });
  }
};

function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.user) return res.status(401).json({ message: "unathorized" });
    if (!allowedRoles.includes(req.user.role))
      return res.status(403).json({ message: "ليس لديك صلاحية" });

    next();
  };
}

export { authMiddleWare, authorize };
