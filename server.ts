import app from "./app";
import { pool } from "./config/db";

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  try {
    await pool.query("SELECT 1");

    console.log("db connected");
    console.log(`server is running on port ${PORT}`);
  } catch {
    console.log("connection failed");
    process.exit(1);
  }
});
