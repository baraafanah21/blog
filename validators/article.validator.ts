import { z } from "zod";

const articleSchema = z.object({
  title: z.string().min(2, "title is too short").max(100, "title is too long"),
  content: z.string().min(50, "content is too short"),
});

export const createArticleSchema = articleSchema; // كامل
export const updateArticleSchema = articleSchema.partial(); // كل الحقول اختيارية

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
