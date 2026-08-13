import express from "express";
import errorHandler from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import articleRoutes from "./routes/articleRoutes";
const app = express();
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/articles", articleRoutes);
app.use(errorHandler);

export default app;
