import { z } from "zod";

const signupSchema = z.object({
  username: z.string().min(3, "username must be at least 3").max(100),
  password: z.string().min(8, "password must be at least 8"),
});
const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export { signupSchema, loginSchema };
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
