import express from "express";
import errorHandler from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import articleRoutes from "./routes/articleRoutes";
import { generalLimiter } from "./middleware/rateLimiters";
import helmet from "helmet";
import AppError from "./utils/AppError";

const app = express();
app.use(helmet());
app.use(generalLimiter);
app.use(express.json({ limit: "10kb" }));
app.use("/auth", authRoutes);
app.use("/articles", articleRoutes);
app.use((_req, _res, next) => next(new AppError("Not Found", 404)));
app.use(errorHandler);

export default app;
