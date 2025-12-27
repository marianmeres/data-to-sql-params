/**
 * @module
 *
 * A lightweight utility for converting JavaScript objects into SQL parameter lists
 * for building parameterized SQL statements with PostgreSQL-style placeholders.
 *
 * @example Basic INSERT statement
 * ```ts
 * import { dataToSqlParams } from "@marianmeres/data-to-sql-params";
 *
 * const user = { name: "John", email: "john@example.com", age: 30 };
 * const { keys, placeholders, values } = dataToSqlParams(user);
 *
 * const sql = `INSERT INTO users (${keys.join(", ")}) VALUES (${placeholders.join(", ")})`;
 * // 'INSERT INTO users ("name", "email", "age") VALUES ($1, $2, $3)'
 * await db.query(sql, values);
 * ```
 *
 * @example UPDATE statement with WHERE clause
 * ```ts
 * import { dataToSqlParams } from "@marianmeres/data-to-sql-params";
 *
 * const updates = { name: "Jane", status: "active" };
 * const { pairs, values, _next } = dataToSqlParams(updates);
 *
 * const sql = `UPDATE users SET ${pairs.join(", ")} WHERE "id" = $${_next}`;
 * // 'UPDATE users SET "name" = $1, "status" = $2 WHERE "id" = $3'
 * await db.query(sql, [...values, userId]);
 * ```
 */
export * from "./data-to-sql-params.ts";