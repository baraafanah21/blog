import express from "express";
import * as authControl from "../controllers/auth.controller";
import { authMiddleWare } from "../middleware/auth";
import validate from "../middleware/validate";
import { authLimiter, passwordLimiter } from "../middleware/rateLimiters";
import {
  loginSchema,
  signupSchema,
  updatePassSchema,
} from "../validators/auth.validator";
const router = express.Router();

router.post("/login", authLimiter, validate(loginSchema), authControl.login);
router.post("/signup", validate(signupSchema), authControl.signup);
router.post("/refresh", authControl.refreshToken);
router.post("/logout", authMiddleWare, authControl.logout);

router.patch(
  "/updatepassword",
  authMiddleWare,
  passwordLimiter,
  validate(updatePassSchema),
  authControl.updatePass,
);

export default router;
