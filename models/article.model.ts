import { pool } from "../config/db";
interface Article {
  id: number;
  title: string;
  content: string;
  author_id: number;
}

async function getAll(): Promise<Article[]> {
  const result = await pool.query<Article>("SELECT * FROM articles");
  return result.rows;
}

async function createArticle(
  article: Pick<Article, "title" | "content" | "author_id">,
): Promise<Article | undefined> {
  const result = await pool.query<Article>(
    "INSERT INTO articles (title, content, author_id) VALUES ($1, $2, $3) RETURNING *",
    [article.title, article.content, article.author_id],
  );

  return result.rows[0];
}

async function deleteById(id: number): Promise<Article | undefined> {
  const result = await pool.query<Article>(
    "DELETE FROM articles WHERE id = $1 RETURNING *",
    [id],
  );
  return result.rows[0];
}

async function findById(id: number): Promise<Article | undefined> {
  const result = await pool.query<Article>(
    "SELECT * FROM articles WHERE id = $1",
    [id],
  );
  return result.rows[0];
}

async function updateById(
  id: number,
  article: Pick<Article, "title" | "content">,
): Promise<Article | undefined> {
  const result = await pool.query<Article>(
    "UPDATE articles SET title = $1, content = $2 WHERE id = $3 RETURNING *",
    [article.title, article.content, id],
  );
  return result.rows[0];
}

export { getAll, createArticle, deleteById, findById, updateById };
export type { Article };
