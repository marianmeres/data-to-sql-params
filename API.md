# API Reference

## dataToSqlParams

```typescript
function dataToSqlParams<T extends Record<string, any> = Record<string, any>>(
	data: T | null | undefined,
	extractor?: Extractor<T>,
	options?: SqlParamsOptions,
): SqlParamsResult;
```

Converts a data object into SQL parameter lists for building dynamic SQL statements.

### Parameters

#### `data`

**Type:** `T | null | undefined`

The source data object to extract values from. Only **own** (non-inherited) properties are considered; prototype-chain properties are ignored. Passing `null` or `undefined` is safe and is treated as an empty object.

#### `extractor` (optional)

**Type:** `Extractor<T>` — see [`Extractor<T>`](#extractort).

Defines which keys to extract and how to transform their values. Three modes:

| Mode          | Value                                    | Behavior                                      |
| ------------- | ---------------------------------------- | --------------------------------------------- |
| Extract all   | `undefined` (omit parameter)             | Extracts every defined own key from `data`    |
| Whitelist     | `string[]`                               | Only extracts the listed keys (own keys only) |
| Transform map | `Record<string, TransformFn \| boolean>` | Per-key control (see below)                   |

**Transform map values:**

- `true` — Include the key without transformation
- `false` — Exclude the key from extraction
- `TransformFn` — Apply a custom transformation function

#### `options` (optional)

**Type:** [`SqlParamsOptions`](#sqlparamsoptions)

| Option             | Type                         | Default | Purpose                                |
| ------------------ | ---------------------------- | ------- | -------------------------------------- |
| `placeholderStyle` | `"pg" \| "mysql" \| "mssql"` | `"pg"`  | Dialect for `placeholders` and `pairs` |
| `startAt`          | `number`                     | `1`     | Starting positional-placeholder number |

### Return Value

Returns a [`SqlParamsResult`](#sqlparamsresult) object with the following properties:

#### `keys`

**Type:** `string[]`

Array of SQL-quoted identifiers (column names). Quotes within identifiers are escaped by doubling per SQL standard.

```typescript
['"name"', '"email"', '"created_at"'];
```

#### `placeholders`

**Type:** `string[]`

Positional placeholders corresponding to the values, in the dialect set by `placeholderStyle`.

- `pg` (default): `['$1', '$2', '$3']`
- `mysql`: `['?', '?', '?']`
- `mssql`: `['@p1', '@p2', '@p3']`

#### `values`

**Type:** `any[]`

Array of extracted (and optionally transformed) values in the same order as `placeholders`.

#### `pairs`

**Type:** `string[]`

Array of `"key" = <placeholder>` strings for use in UPDATE SET clauses or WHERE conjuncts.

```typescript
['"name" = $1', '"email" = $2', '"created_at" = $3'];
```

#### `map`

**Type:** `Record<string, any>`

Named-parameter object using the `$`-prefixed field name as key. Independent of `placeholderStyle` — this is a named-parameter output, not a positional one. Intended for drivers that bind by name (e.g. `better-sqlite3`).

```typescript
{ $name: 'John', $email: 'john@example.com' }
```

#### `next`

**Type:** `number`

The next available placeholder number. Feed this into `options.startAt` of a follow-up call to chain parameter lists (e.g. for a WHERE clause).

#### `transformers`

**Type:** `Record<string, TransformFn>`

The transform functions used for each **successfully extracted** key, keyed by original field name. Useful for applying the same transformation elsewhere (e.g. in a WHERE clause) so the SQL stays consistent with the SET clause.

Boolean `true` in the input extractor is stored here as an identity function. Keys that were **skipped** (excluded via `false`, absent from `data`, or whose transformer returned `undefined`) do NOT appear here.

#### `_next`

**Type:** `number`

**Deprecated.** Alias of `next`. Retained for backwards compatibility.

#### `_extractor`

**Type:** `Record<string, TransformFn>`

**Deprecated.** Alias of `transformers` — the exact same object reference is used, so mutations to either are visible through both.

---

## SqlParamsOptions

```typescript
interface SqlParamsOptions {
	placeholderStyle?: "pg" | "mysql" | "mssql";
	startAt?: number;
}
```

### `placeholderStyle`

Placeholder dialect for `placeholders` and `pairs`. Default `"pg"`.

- `"pg"` → `$1`, `$2`, ... (PostgreSQL, SQLite)
- `"mysql"` → `?` (MySQL, MariaDB — no numbering)
- `"mssql"` → `@p1`, `@p2`, ... (SQL Server)

The `map` output always uses `$name` regardless of this option.

### `startAt`

Starting placeholder number. Default `1`. Use with `next` from a previous call to compose WHERE clauses without placeholder collisions:

```typescript
const set = dataToSqlParams({ status: "active" });
const where = dataToSqlParams({ id: 1 }, undefined, { startAt: set.next });
// where.placeholders = ['$2']
```

---

## SqlParamsResult

```typescript
interface SqlParamsResult {
	keys: string[];
	placeholders: string[];
	values: any[];
	pairs: string[];
	map: Record<string, any>;
	next: number;
	transformers: Record<string, TransformFn>;
	/** @deprecated alias of `next` */
	_next: number;
	/** @deprecated alias of `transformers` */
	_extractor: Record<string, TransformFn>;
}
```

See the return-value documentation above for details on each property.

---

## Extractor\<T>

```typescript
type Extractor<T> =
	| ReadonlyArray<Extract<keyof T, string>>
	| { [K in Extract<keyof T, string>]?: TransformFn | boolean }
	| readonly string[]
	| Record<string, TransformFn | boolean>;
```

Union of the three accepted extractor shapes. The first two members provide typed extraction when `T` is a concrete interface; the latter two accept any string keys for looser usage.

---

## PlaceholderStyle

```typescript
type PlaceholderStyle = "pg" | "mysql" | "mssql";
```

---

## TransformFn

```typescript
type TransformFn = (v: any) => any;
```

Transform function type for converting values during extraction.

- **Input:** The original value from the data object
- **Output:** The transformed value to use in the SQL parameters
- **Special:** Return `undefined` to skip the field entirely

### Examples

```typescript
// Transform Date to ISO string
const dateTransform: TransformFn = (v) => v.toISOString();

// Transform to uppercase
const upperTransform: TransformFn = (v) => v.toUpperCase();

// JSON stringify objects
const jsonTransform: TransformFn = (v) => JSON.stringify(v);

// Conditionally skip empty values
const skipEmpty: TransformFn = (v) => v || undefined;
```

---

## Usage Examples

### Extract All Keys

```typescript
import { dataToSqlParams } from "@marianmeres/data-to-sql-params";

const result = dataToSqlParams({ a: 1, x: undefined, b: 2, c: 3 });
// result.keys         = ['"a"', '"b"', '"c"']
// result.placeholders = ['$1', '$2', '$3']
// result.values       = [1, 2, 3]
// result.pairs        = ['"a" = $1', '"b" = $2', '"c" = $3']
// result.map          = { $a: 1, $b: 2, $c: 3 }
// result.next         = 4
```

### Whitelist Keys

```typescript
const result = dataToSqlParams(
	{ a: 1, x: undefined, b: 2, c: 3 },
	["b", "c", "x"], // 'x' is skipped (undefined in data)
);
// result.keys   = ['"b"', '"c"']
// result.values = [2, 3]
```

### Transform Values

```typescript
const result = dataToSqlParams(
	{ id: 1, name: "alice", createdAt: new Date("2024-01-01") },
	{
		id: true, // Include without transformation
		name: (v) => v.toUpperCase(), // Transform to uppercase
		createdAt: (v) => v.toISOString(), // Convert Date to string
	},
);
// result.values = [1, 'ALICE', '2024-01-01T00:00:00.000Z']
```

### Exclude Keys

```typescript
const result = dataToSqlParams(
	{ id: 1, password: "secret", email: "user@example.com" },
	{
		id: true,
		password: false, // Explicitly exclude
		email: true,
	},
);
// Only id and email are extracted
```

### Dynamic INSERT Statement

```typescript
const userData = {
	name: "John Doe",
	email: "john@example.com",
	createdAt: new Date(),
};

const { keys, placeholders, values } = dataToSqlParams(userData, {
	name: true,
	email: true,
	createdAt: (d) => d.toISOString(),
});

const sql = `INSERT INTO users (${keys.join(", ")}) VALUES (${placeholders.join(", ")})`;
// INSERT INTO users ("name", "email", "createdAt") VALUES ($1, $2, $3)

await db.query(sql, values);
```

### Dynamic UPDATE Statement

```typescript
const updates = { name: "Jane Doe", email: "jane@example.com" };
const userId = 123;

const { pairs, values, next } = dataToSqlParams(updates);

const sql = `UPDATE users SET ${pairs.join(", ")} WHERE "id" = $${next}`;
// UPDATE users SET "name" = $1, "email" = $2 WHERE "id" = $3

await db.query(sql, [...values, userId]);
```

### Composing WHERE with `startAt`

```typescript
const set = dataToSqlParams({ status: "active" });
const where = dataToSqlParams(
	{ tenantId: 7, id: 123 },
	undefined,
	{ startAt: set.next },
);

const sql = `UPDATE users SET ${set.pairs.join(", ")} WHERE ${where.pairs.join(" AND ")}`;
// UPDATE users SET "status" = $1 WHERE "tenantId" = $2 AND "id" = $3

await db.query(sql, [...set.values, ...where.values]);
```

### Non-PostgreSQL Placeholders

```typescript
// MySQL
const mysql = dataToSqlParams(
	{ a: 1, b: 2 },
	undefined,
	{ placeholderStyle: "mysql" },
);
// mysql.placeholders = ['?', '?']
// mysql.pairs        = ['"a" = ?', '"b" = ?']

// SQL Server
const mssql = dataToSqlParams(
	{ a: 1, b: 2 },
	undefined,
	{ placeholderStyle: "mssql" },
);
// mssql.placeholders = ['@p1', '@p2']
```

### Reusing Transform Functions

```typescript
const data = { id: 1, name: "alice" };
const { transformers, values } = dataToSqlParams(data, {
	id: true,
	name: (v) => v.toUpperCase(),
});

// Later, apply the same transformation for consistency
const newName = "bob";
const transformed = transformers.name(newName); // 'BOB'
```
