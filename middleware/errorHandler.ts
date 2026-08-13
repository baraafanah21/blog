import { Request, Response, NextFunction } from "express";
import AppError from "../utils/AppError";

const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.log(err);

  if (err instanceof AppError)
    return res.status(err.statusCode).json({ message: err.message });
  return res.status(500).json({ message: "Something Wrong!" });
};

export default errorHandler;
