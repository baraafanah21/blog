import { Request, Response, NextFunction } from "express";
import AppError from "../utils/AppError";
import log from "../utils/logger";

const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const requestId = res.locals.requestId as string | undefined;
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const logMessage = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  // Only AppError messages are safe to expose: everything else may leak internals.
  const clientMessage = isAppError ? err.message : "Something Wrong!";

  log({
    requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    userId: req.user?.id,
    message: logMessage,
    stack,
  });

  res.status(statusCode).json({
    message: clientMessage,
    requestId,
  });
};

export default errorHandler;
