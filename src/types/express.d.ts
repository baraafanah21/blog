import "express"; // نتأكد إن نوع Express الأصلي محمّل

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: string; token_version: number };
    }
  }
}

export {};
