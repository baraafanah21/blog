import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing from .env`);
  return value;
}
export { requireEnv };
