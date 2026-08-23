import { z } from "zod";

const articleSchema = z.object({
  title: z.string().min(2, "title is too short").max(100, "title is too long"),

  content: z.string().min(50, "content is too short"),
});

export const createArticleSchema = articleSchema.strict();

export const updateArticleSchema = articleSchema
  .strict()
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const articleIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type ArticleIdParamInput = z.infer<typeof articleIdParamSchema>;
