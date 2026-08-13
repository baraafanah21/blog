import express from "express";
import * as authControl from "../controllers/auth.controller";
import { authMiddleWare } from "../middleware/auth";
import validate from "../middleware/validate";
import { loginSchema, signupSchema } from "../validators/auth.validator";
const router = express.Router();

router.post("/login", validate(loginSchema), authControl.login);
router.post("/signup", validate(signupSchema), authControl.signup);
router.post("/refresh", authControl.refreshToken);
router.post("/logout", authMiddleWare, authControl.logout);

router.patch("/updatepassword", authMiddleWare, authControl.updatePass);

export default router;
