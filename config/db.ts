import { Pool } from "pg";
import { requireEnv } from "../utils/env";

const DB = requireEnv("DATABASE");
const pool = new Pool({ connectionString: DB });
export { pool };
