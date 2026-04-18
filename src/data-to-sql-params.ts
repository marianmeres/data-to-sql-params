/**
 * @module
 *
 * Converts JavaScript objects into SQL parameter lists for building parameterized SQL statements.
 *
 * This module provides utilities for transforming data objects into PostgreSQL-style
 * parameterized query components (`$1`, `$2`, etc.), with support for value transformation,
 * selective field extraction, alternate placeholder styles and composable results for
 * `WHERE` clauses.
 *
 * @example Basic usage
 * ```ts
 * import { dataToSqlParams } from "@marianmeres/data-to-sql-params";
 *
 * const { keys, placeholders, values } = dataToSqlParams({ name: "John", age: 30 });
 * const sql = `INSERT INTO users (${keys.join(", ")}) VALUES (${placeholders.join(", ")})`;
 * // sql = 'INSERT INTO users ("name", "age") VALUES ($1, $2)'
 * // values = ["John", 30]
 * ```
 */

/**
 * Transform function type for converting values during extraction.
 *
 * A transform function receives a value from the source data object and returns
 * a transformed value to be used in the SQL parameters. Return `undefined` to
 * skip the field entirely.
 *
 * @param v - The original value from the data object
 * @returns The transformed value, or `undefined` to skip this field
 *
 * @example
 * ```ts
 * // Transform a Date to ISO string
 * const dateTransform: TransformFn = (v) => v.toISOString();
 *
 * // Transform to uppercase
 * const upperTransform: TransformFn = (v) => v.toUpperCase();
 *
 * // Conditionally skip a field
 * const skipEmpty: TransformFn = (v) => v || undefined;
 * ```
 */
// deno-lint-ignore no-explicit-any
export type TransformFn = (v: any) => any;

/**
 * Supported placeholder dialects.
 *
 * - `pg`    → `$1`, `$2`, ... (PostgreSQL, SQLite)
 * - `mysql` → `?`, `?`, ...   (MySQL, MariaDB; no numbering)
 * - `mssql` → `@p1`, `@p2`, ... (SQL Server)
 */
export type PlaceholderStyle = "pg" | "mysql" | "mssql";

/**
 * Options for {@link dataToSqlParams}.
 */
export interface SqlParamsOptions {
	/**
	 * Placeholder dialect to emit for `placeholders` and `pairs`.
	 * Default: `"pg"`.
	 *
	 * Note: `map` always uses the `$name` convention regardless of this option,
	 * because named parameters and positional placeholders are independent concerns.
	 */
	placeholderStyle?: PlaceholderStyle;

	/**
	 * Starting number for positional placeholders. Default: `1`.
	 *
	 * Set this to an existing result's `next` to compose a `WHERE` clause
	 * that continues numbering from a previous `dataToSqlParams` call
	 * without colliding.
	 *
	 * @example
	 * ```ts
	 * const set = dataToSqlParams(updates);
	 * const where = dataToSqlParams({ id: 123 }, undefined, { startAt: set.next });
	 * const sql = `UPDATE t SET ${set.pairs.join(", ")} WHERE ${where.pairs.join(" AND ")}`;
	 * await db.query(sql, [...set.values, ...where.values]);
	 * ```
	 */
	startAt?: number;
}

/**
 * Result object returned by {@link dataToSqlParams}.
 *
 * Contains all the components needed to build parameterized SQL statements.
 */
export interface SqlParamsResult {
	/**
	 * Array of SQL-quoted identifiers (column names).
	 *
	 * @example `['"name"', '"age"']`
	 */
	keys: string[];

	/**
	 * Array of positional placeholders, in the dialect set by
	 * {@link SqlParamsOptions.placeholderStyle} (default `pg`).
	 *
	 * @example `['$1', '$2']`
	 */
	placeholders: string[];

	/**
	 * Array of extracted values in the same order as {@link placeholders}.
	 *
	 * @example `['John', 30]`
	 */
	// deno-lint-ignore no-explicit-any
	values: any[];

	/**
	 * Array of `"key" = placeholder` strings for UPDATE SET clauses or WHERE conjuncts.
	 *
	 * @example `['"name" = $1', '"age" = $2']`
	 */
	pairs: string[];

	/**
	 * Object with named parameters using `$` prefix for the key.
	 * Useful for database drivers that consume named parameters (e.g. `better-sqlite3`).
	 *
	 * Note: the `$name` prefix is unrelated to the `$1`/`$2` positional placeholders
	 * in {@link placeholders} — this object is a separate named-parameter output.
	 *
	 * @example `{ $name: 'John', $age: 30 }`
	 */
	// deno-lint-ignore no-explicit-any
	map: Record<string, any>;

	/**
	 * The next available placeholder number. Feed this into
	 * {@link SqlParamsOptions.startAt} of a follow-up call to extend the parameter list.
	 *
	 * @example If 3 fields were extracted, `next` is `4`.
	 */
	next: number;

	/**
	 * Transform functions used for each successfully extracted key, keyed by original field name.
	 * Enables reusing the same transformation elsewhere (e.g. for a WHERE clause that must
	 * match the format written into the SET clause).
	 *
	 * Boolean `true` in the input extractor is stored here as an identity function;
	 * keys excluded via `false`, missing from data, or whose transformer returned
	 * `undefined` do NOT appear here.
	 */
	transformers: Record<string, TransformFn>;

	/**
	 * Alias of {@link next}. Retained for backwards compatibility.
	 *
	 * @deprecated Prefer {@link next}.
	 */
	_next: number;

	/**
	 * Alias of {@link transformers} — the same object is referenced. Retained for backwards compatibility.
	 *
	 * @deprecated Prefer {@link transformers}.
	 */
	_extractor: Record<string, TransformFn>;
}

/**
 * Extractor shape accepted by {@link dataToSqlParams}.
 *
 * - `undefined`: extract every own key of `data` whose value is not `undefined`
 * - array: whitelist of keys to extract (own keys only)
 * - object map: per-key control (`true` = pass through, `false` = exclude, function = transform)
 */
export type Extractor<T> =
	| ReadonlyArray<Extract<keyof T, string>>
	| { [K in Extract<keyof T, string>]?: TransformFn | boolean }
	| readonly string[]
	| Record<string, TransformFn | boolean>;

const _noTransform: TransformFn = (v) => v;

const formatPlaceholder = (n: number, style: PlaceholderStyle): string => {
	switch (style) {
		case "mysql":
			return "?";
		case "mssql":
			return `@p${n}`;
		case "pg":
		default:
			return `$${n}`;
	}
};

/**
 * Converts a data object into SQL parameter lists for building dynamic SQL statements.
 *
 * Extracts values from an object and generates the building blocks for parameterized
 * queries: quoted identifiers, positional placeholders, the values array, `"col" = $n`
 * pairs, a named-parameter map, and the next placeholder number for chaining.
 *
 * @param data - Source data object. `null`/`undefined` is treated as an empty object.
 *               Only own (non-inherited) properties are considered.
 * @param extractor - Optional extraction strategy:
 *   - `undefined`: extract all defined own keys
 *   - `string[]`: whitelist of keys to extract
 *   - `Record<string, TransformFn | boolean>`:
 *     - `true`  — include the key without transformation
 *     - `false` — exclude the key from extraction
 *     - function — include and apply the transformer
 * @param options - Optional {@link SqlParamsOptions} (placeholder dialect, starting number).
 *
 * @example
 * // Extract all defined own keys (undefined values and inherited keys are skipped)
 * const result = dataToSqlParams({ a: 1, b: 2, c: undefined });
 * // result.keys         = ['"a"', '"b"']
 * // result.placeholders = ['$1', '$2']
 * // result.values       = [1, 2]
 * // result.pairs        = ['"a" = $1', '"b" = $2']
 * // result.map          = { $a: 1, $b: 2 }
 * // result.next         = 3
 *
 * @example
 * // Continue numbering into a WHERE clause
 * const set   = dataToSqlParams({ name: "Jane" });
 * const where = dataToSqlParams({ id: 1 }, undefined, { startAt: set.next });
 * const sql = `UPDATE t SET ${set.pairs} WHERE ${where.pairs}`;
 * await db.query(sql, [...set.values, ...where.values]);
 *
 * @example
 * // MySQL-style placeholders
 * const { placeholders } = dataToSqlParams({ a: 1, b: 2 }, undefined, { placeholderStyle: "mysql" });
 * // ['?', '?']
 */
export const dataToSqlParams = <
	// deno-lint-ignore no-explicit-any
	T extends Record<string, any> = Record<string, any>,
>(
	data: T | null | undefined,
	extractor?: Extractor<T>,
	options?: SqlParamsOptions,
): SqlParamsResult => {
	const style: PlaceholderStyle = options?.placeholderStyle ?? "pg";
	const startAt = options?.startAt ?? 1;
	// deno-lint-ignore no-explicit-any
	const safeData: Record<string, any> = (data ?? {}) as Record<string, any>;

	let normalized: Record<string, TransformFn | boolean>;
	if (extractor == null) {
		normalized = Object.fromEntries(
			Object.keys(safeData).map((k) => [k, _noTransform]),
		);
	} else if (Array.isArray(extractor)) {
		normalized = Object.fromEntries(
			(extractor as readonly string[]).map((k) => [k, _noTransform]),
		);
	} else {
		normalized = extractor as Record<string, TransformFn | boolean>;
	}

	const transformers: Record<string, TransformFn> = {};
	const result: SqlParamsResult = {
		keys: [],
		placeholders: [],
		values: [],
		pairs: [],
		map: {},
		next: startAt,
		transformers,
		_next: startAt,
		_extractor: transformers,
	};

	let counter = startAt;
	for (const [k, rawExtract] of Object.entries(normalized)) {
		if (!Object.hasOwn(safeData, k)) continue;
		if (safeData[k] === undefined) continue;
		if (rawExtract === false) continue;

		let extract: TransformFn;
		if (rawExtract === true) {
			extract = _noTransform;
		} else if (typeof rawExtract === "function") {
			extract = rawExtract as TransformFn;
		} else {
			throw new TypeError(`Unexpected transformer value '${rawExtract}'`);
		}

		transformers[k] = extract;

		const value = extract(safeData[k]);
		if (value === undefined) continue;

		const key = `"${k.replace(/"/g, '""')}"`;
		const placeholder = formatPlaceholder(counter++, style);
		result.keys.push(key);
		result.placeholders.push(placeholder);
		result.values.push(value);
		result.pairs.push(`${key} = ${placeholder}`);
		result.map[`$${k}`] = value;
	}

	result.next = counter;
	result._next = counter;

	return result;
};
