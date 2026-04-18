# @marianmeres/data-to-sql-params

[![NPM version](https://img.shields.io/npm/v/@marianmeres/data-to-sql-params.svg)](https://www.npmjs.com/package/@marianmeres/data-to-sql-params)
[![JSR version](https://jsr.io/badges/@marianmeres/data-to-sql-params)](https://jsr.io/@marianmeres/data-to-sql-params)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight utility function for converting data objects into SQL parameter lists, making it easier to build dynamic SQL statements with parameterized queries.

Generates PostgreSQL-style placeholders (`$1`, `$2`, etc.) and properly quoted SQL identifiers, with support for value transformation and selective field extraction.

## Features

- 🔒 **SQL Injection Safe** - Properly escapes SQL identifiers (quotes are doubled per SQL standard)
- 🎯 **Flexible Extraction** - Choose which fields to include via whitelist or transform map
- 🔄 **Value Transformation** - Apply custom functions to transform values during extraction
- 📦 **Zero Dependencies** - Lightweight and self-contained
- 🎨 **Multiple Output Formats** - Keys, placeholders, values, pairs, and named parameters
- 🔢 **PostgreSQL-Compatible** - Uses `$1`, `$2` style placeholders
- 💪 **TypeScript Support** - Fully typed with JSDoc annotations

## Installation

```sh
deno add jsr:@marianmeres/data-to-sql-params
```

```sh
npm install @marianmeres/data-to-sql-params
```

## API

> **Full API documentation:** [API.md](API.md)

```typescript
function dataToSqlParams<T extends Record<string, any> = Record<string, any>>(
	data: T | null | undefined,
	extractor?: Extractor<T>,
	options?: SqlParamsOptions,
): SqlParamsResult;
```

### Parameters

- **`data`** - Source object. `null`/`undefined` is treated as an empty object. Only own (non-inherited) properties are considered.
- **`extractor`** _(optional)_ - Extraction strategy:
  - `undefined` - Extract all defined own keys
  - `string[]` - Whitelist of keys to extract
  - `Record<string, TransformFn | boolean>` - Map of keys to transform functions:
    - `true` - Include key without transformation
    - `false` - Exclude key from extraction
    - `function` - Apply transformation to the value
- **`options`** _(optional)_ - see [`SqlParamsOptions`](#sqlparamsoptions) below.

### `SqlParamsOptions`

| Option             | Type                         | Default | Purpose                                                                                 |
| ------------------ | ---------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `placeholderStyle` | `"pg" \| "mysql" \| "mssql"` | `"pg"`  | Placeholder dialect for `placeholders`/`pairs`                                          |
| `startAt`          | `number`                     | `1`     | Starting placeholder number — pass `next` from a previous call to compose WHERE clauses |

### Return Value (`SqlParamsResult`)

| Property       | Type                          | Description                                                                 |
| -------------- | ----------------------------- | --------------------------------------------------------------------------- |
| `keys`         | `string[]`                    | SQL-quoted identifiers for INSERT column lists                              |
| `placeholders` | `string[]`                    | Positional placeholders in the chosen dialect (default `$1`, `$2`, ...)     |
| `values`       | `any[]`                       | Extracted values in placeholder order                                       |
| `pairs`        | `string[]`                    | `"key" = <placeholder>` strings for UPDATE SET clauses                      |
| `map`          | `Record<string, any>`         | Named parameters with `$` prefix (always, regardless of `placeholderStyle`) |
| `next`         | `number`                      | Next available placeholder number                                           |
| `transformers` | `Record<string, TransformFn>` | Transform functions for successfully extracted keys                         |
| `_next`        | `number`                      | **Deprecated** alias of `next` (kept for backwards compatibility)           |
| `_extractor`   | `Record<string, TransformFn>` | **Deprecated** alias of `transformers` — same object reference              |

## Usage Examples

```js
import { dataToSqlParams } from "@marianmeres/data-to-sql-params";
```

### Basic Usage - Extract All Keys

```js
// No extractor - all defined keys are extracted (undefined values are skipped)
const result = dataToSqlParams({ a: 1, x: undefined, b: 2, c: 3 });
/* {
    keys: [ '"a"', '"b"', '"c"' ],
    placeholders: [ '$1', '$2', '$3' ],
    pairs: [ '"a" = $1', '"b" = $2', '"c" = $3' ],
    values: [ 1, 2, 3 ],
    map: { $a: 1, $b: 2, $c: 3 },
    _next: 4,
    _extractor: { ... }
} */
```

### Whitelist Specific Keys

```js
// Extract only specified keys (undefined values like "x" are skipped)
const result = dataToSqlParams(
	{ a: 1, x: undefined, b: 2, c: 3 },
	["b", "c", "x"],
);
/* {
    keys: [ '"b"', '"c"' ],
    placeholders: [ '$1', '$2' ],
    values: [ 2, 3 ],
    pairs: [ '"b" = $1', '"c" = $2' ],
    map: { $b: 2, $c: 3 },
    _next: 3
} */
```

### Transform Values During Extraction

```js
// Apply custom transformations (type casting, JSON stringify, etc.)
// Use `true` to include a key without transformation
const result = dataToSqlParams(
	{ id: 1, name: "alice", createdAt: new Date("2024-01-01") },
	{
		id: true,
		name: (v) => v.toUpperCase(),
		createdAt: (v) => v.toISOString(),
	},
);
/* {
    keys: [ '"id"', '"name"', '"createdAt"' ],
    placeholders: [ '$1', '$2', '$3' ],
    values: [ 1, 'ALICE', '2024-01-01T00:00:00.000Z' ],
    pairs: [ '"id" = $1', '"name" = $2', '"createdAt" = $3' ],
    map: { $id: 1, $name: 'ALICE', $createdAt: '2024-01-01T00:00:00.000Z' },
    _next: 4
} */
```

### Exclude Specific Keys

```js
// Use `false` to explicitly exclude keys
const result = dataToSqlParams(
	{ id: 1, password: "secret", email: "user@example.com" },
	{
		id: true,
		password: false, // Exclude from extraction
		email: true,
	},
);
// Only id and email are extracted, password is excluded
```

## Real-World Examples

### Dynamic INSERT Statement

```js
const userData = {
	name: "John Doe",
	email: "john@example.com",
	role: "admin",
	createdAt: new Date(),
};

const { keys, placeholders, values } = dataToSqlParams(userData, {
	name: true,
	email: true,
	role: true,
	createdAt: (d) => d.toISOString(),
});

const sql = `INSERT INTO users (${keys.join(", ")}) VALUES (${placeholders.join(", ")})`;
// INSERT INTO users ("name", "email", "role", "createdAt") VALUES ($1, $2, $3, $4)

await db.query(sql, values);
```

### Dynamic UPDATE Statement

```js
const updates = {
	name: "Jane Doe",
	email: "jane@example.com",
	updatedAt: new Date(),
};

const { pairs, values, next } = dataToSqlParams(updates, {
	name: true,
	email: true,
	updatedAt: (d) => d.toISOString(),
});

// Add WHERE condition using `next` for the next placeholder number
const userId = 123;
const sql = `UPDATE users SET ${pairs.join(", ")} WHERE "id" = $${next}`;
// UPDATE users SET "name" = $1, "email" = $2, "updatedAt" = $3 WHERE "id" = $4

await db.query(sql, [...values, userId]);
```

### Composing WHERE Clauses with `startAt`

For multi-column WHERE conditions, pass `next` as `startAt` to a second call:

```js
const set = dataToSqlParams({ status: "active", updatedAt: new Date().toISOString() });
const where = dataToSqlParams(
	{ tenantId: 7, id: 123 },
	undefined,
	{ startAt: set.next },
);

const sql = `UPDATE users SET ${set.pairs.join(", ")} WHERE ${where.pairs.join(" AND ")}`;
// UPDATE users SET "status" = $1, "updatedAt" = $2 WHERE "tenantId" = $3 AND "id" = $4

await db.query(sql, [...set.values, ...where.values]);
```

### Non-PostgreSQL Placeholders

```js
// MySQL / MariaDB
const { placeholders } = dataToSqlParams(
	{ a: 1, b: 2 },
	undefined,
	{ placeholderStyle: "mysql" },
);
// placeholders = ['?', '?']

// SQL Server
const { placeholders: p2 } = dataToSqlParams(
	{ a: 1, b: 2 },
	undefined,
	{ placeholderStyle: "mssql" },
);
// p2 = ['@p1', '@p2']
```

### Conditional INSERT or UPDATE (Upsert Pattern)

```js
const data = { id: 1, name: "Alice", status: "active" };
const exists = await checkIfExists(data.id);

const { keys, placeholders, values, pairs, next, transformers } = dataToSqlParams(
	data,
	{
		id: true,
		name: true,
		status: true,
	},
);

let sql;
if (exists) {
	// UPDATE: use pairs and add WHERE clause
	const pk = "id";
	sql = `UPDATE users SET ${pairs.join(", ")} WHERE "${pk}" = $${next}`;
	// UPDATE users SET "id" = $1, "name" = $2, "status" = $3 WHERE "id" = $4
	values.push(transformers[pk](data[pk]));
} else {
	// INSERT: use keys and placeholders
	sql = `INSERT INTO users (${keys.join(", ")}) VALUES (${placeholders.join(", ")})`;
	// INSERT INTO users ("id", "name", "status") VALUES ($1, $2, $3)
}

await db.query(sql, values);
```

### Using Named Parameters

Some database drivers support named parameters with the `$key` syntax:

```js
const { map } = dataToSqlParams({
	userId: 123,
	status: "active",
});

// If your DB driver supports named parameters:
await db.run("UPDATE users SET status = $status WHERE id = $userId", map);
// map = { $userId: 123, $status: 'active' }
```

### Reusing Transform Functions

```js
const data = { createdAt: new Date(), updatedAt: new Date() };
const { transformers } = dataToSqlParams(data, {
	createdAt: (d) => d.toISOString(),
	updatedAt: (d) => d.toISOString(),
});

// Later, reuse the same transformations for consistency
const newDate = new Date();
const transformed = transformers.createdAt(newDate);
// Ensures dates are always formatted the same way
```

Only keys that were **successfully extracted** appear in `transformers`. Keys excluded
via `false`, missing from data, or whose transformer returned `undefined` are absent.

## Important Notes

### SQL Identifier Escaping

The package properly escapes SQL identifiers according to the SQL standard (quotes are doubled). This protects against malformed identifiers:

```js
const { keys } = dataToSqlParams({ 'user"name': "test" });
// keys = ['"user""name"'] - quotes are escaped
```

**Note:** Field names (keys) come from your code, not user input. Values are safely parameterized. The package does not protect against SQL injection in field names from untrusted sources.

### `null` vs `undefined`

- `undefined` values are **skipped** (both on input and when a transformer returns `undefined`).
- `null` is a **value** — it passes through and becomes a real parameter binding.

This is deliberate: `null` expresses "set this column to NULL", while `undefined` means "don't touch this column".

### Own Properties Only

Only **own** properties of `data` are considered. Inherited properties from the prototype chain are ignored, so passing a class instance or extending an object via `Object.create(...)` will not leak prototype methods (`toString`, `constructor`, etc.) into your SQL.

### Database Compatibility

| Database        | `placeholderStyle` | Notes                              |
| --------------- | ------------------ | ---------------------------------- |
| PostgreSQL      | `"pg"` (default)   | `$1`, `$2`, ...                    |
| SQLite          | `"pg"`             | Numbered `$N` params work natively |
| MySQL / MariaDB | `"mysql"`          | `?` placeholders                   |
| SQL Server      | `"mssql"`          | `@p1`, `@p2`, ...                  |

### The `map` Object

The `map` property uses a `$` prefix for field names (e.g. `{ $name: 'John', $age: 30 }`). The sigil coincides with PostgreSQL's positional placeholder marker (`$1`, `$2`) — but `map` is a **separate output** for drivers that consume named parameters by string lookup (e.g. `better-sqlite3`). Don't mix `map` into a `pg` query; use `values` there.

### Backwards-Compatible Aliases

`_next` and `_extractor` remain in the result object as aliases of `next` and `transformers`. New code should prefer the non-prefixed names; the underscored ones are retained for existing consumers.

## License

MIT
