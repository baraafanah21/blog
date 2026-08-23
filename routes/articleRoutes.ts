import express from "express";
import * as articleControl from "../controllers/article.controller";
import validate from "../middleware/validate";
import {
  createArticleSchema,
  updateArticleSchema,
} from "../validators/article.validator";

import { authMiddleWare, authorize } from "../middleware/auth";

const router = express.Router();

router.get("/allarticles", articleControl.getAllArticles);
router.get("/article/:id", articleControl.getArticleById);
router.post(
  "/create",
  authMiddleWare,
  authorize("admin", "editor"),
  validate(createArticleSchema),
  articleControl.createArticle,
);

router.patch(
  "/:id",
  authMiddleWare,
  authorize("editor", "admin"),
  validate(updateArticleSchema),
  articleControl.updateById,
);
router.delete("/:id", authMiddleWare, articleControl.deleteArticle);

export default router;
