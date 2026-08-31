import express from "express";
import errorHandler from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import articleRoutes from "./routes/articleRoutes";
import { generalLimiter } from "./middleware/rateLimiters";
import helmet from "helmet";
import AppError from "./utils/AppError";
import cors from "cors";
import requestId from "./middleware/requestId";

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") ?? [];

const app = express();
app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(requestId);
app.use(generalLimiter);
app.use(express.json({ limit: "10kb" }));
app.use("/auth", authRoutes);
app.use("/articles", articleRoutes);
app.use((_req, _res, next) => next(new AppError("Not Found", 404)));
app.use(errorHandler);

export default app;
