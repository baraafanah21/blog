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

type UpdateArticle = Partial<Pick<Article, "title" | "content">>;

async function updateById(
  id: number,
  article: UpdateArticle,
): Promise<Article | undefined> {
  const allowedFields = ["title", "content"] as const;

  const fields = allowedFields.filter((field) => article[field] !== undefined);

  // Defensive check — الـ schema يفترض أنها تمنع هذا مسبقًا
  if (fields.length === 0) {
    return undefined;
  }

  const values = fields.map((field) => article[field]);

  const setClause = fields
    .map((field, index) => `${field} = $${index + 1}`)
    .join(", ");

  const idParameter = values.length + 1;

  const result = await pool.query<Article>(
    `UPDATE articles
     SET ${setClause}
     WHERE id = $${idParameter}
     RETURNING *`,
    [...values, id],
  );

  return result.rows[0];
}

export { getAll, createArticle, deleteById, findById, updateById };
export type { Article };
