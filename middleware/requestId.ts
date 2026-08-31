import { randomUUID } from "node:crypto";
import { Request, Response, NextFunction } from "express";

const requestId = (req: Request, res: Response, next: NextFunction) => {
  res.locals.requestId = randomUUID();

  res.setHeader("X-Request-Id", res.locals.requestId);

  next();
};

export default requestId;
