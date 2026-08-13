import { Request, Response, NextFunction } from "express";
import * as articleModel from "../models/article.model";
import type { Article } from "../models/article.model";
import catchAsync from "..//utils/catchAsync";
import AppError from "../utils/AppError";

const getAllArticles = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const articles = await articleModel.getAll();
    return res.status(200).json({ articles });
  },
);

const getArticleById = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("invalid id", 400);
    const article = await articleModel.findById(id);
    if (!article) throw new AppError("not Found!", 404);
    return res.status(200).json({ article });
  },
);

const createArticle = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { title, content } = req.body;
    if (!req.user) throw new AppError("unauthorized", 401);
    const author_id = req.user.id;
    const articleData: Pick<Article, "title" | "content" | "author_id"> = {
      title: title,
      content: content,
      author_id: author_id,
    };

    const article = await articleModel.createArticle(articleData);
    if (!article) throw new AppError("Conflict", 409);
    return res.status(201).json({ article });
  },
);

const deleteArticle = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) throw new AppError("unauthorized", 401);
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("invalid id", 400);
    const existing = await articleModel.findById(id);
    if (!existing) throw new AppError("Article not found", 404);
    if (existing.author_id !== req.user.id && req.user.role !== "admin")
      throw new AppError("Forbidden", 403);
    const article = await articleModel.deleteById(id);
    return res.status(200).json({ article });
  },
);

const updateById = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) throw new AppError("unauthorized", 401);
    const { title, content } = req.body;
    const articleData: Pick<Article, "title" | "content"> = {
      title: title,
      content: content,
    };
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("invalid id", 400);
    const existing = await articleModel.findById(id);
    if (!existing) throw new AppError("Article not found", 404);
    if (existing.author_id !== req.user.id && req.user.role !== "admin")
      throw new AppError("Forbidden", 403);
    const article = await articleModel.updateById(id, articleData);
    return res.status(200).json({ article });
  },
);

export {
  getAllArticles,
  getArticleById,
  createArticle,
  deleteArticle,
  updateById,
};
