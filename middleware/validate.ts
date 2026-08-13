import AppError from "../utils/AppError";
import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => issue.message)
        .join(",");
      return next(new AppError(message, 400));
    }
    req.body = result.data;
    next();
  };
};

export default validate;
