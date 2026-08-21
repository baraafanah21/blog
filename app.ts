import express from "express";
import errorHandler from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import articleRoutes from "./routes/articleRoutes";
import { generalLimiter } from "./middleware/rateLimiters";
const app = express();
app.use(generalLimiter);
app.use(express.json({ limit: "10kb" }));
app.use("/auth", authRoutes);
app.use("/articles", articleRoutes);
app.use(errorHandler);

export default app;
