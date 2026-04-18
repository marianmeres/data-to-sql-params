# Agent Instructions

## Package Overview

- **Name:** `@marianmeres/data-to-sql-params`
- **Purpose:** Convert JavaScript objects to SQL parameter components for parameterized queries
- **Default dialect:** PostgreSQL (`$1`, `$2` placeholders); MySQL (`?`) and SQL Server (`@p1`) also supported via option
- **License:** MIT
- **Zero dependencies**

## File Structure

```
src/
  mod.ts                    # Entry point (re-exports)
  data-to-sql-params.ts     # Core implementation
tests/
  data-to-sql-params.test.ts # Test suite (Deno)
scripts/
  build-npm.ts              # NPM build script
```

## Public API

### Exports

| Export             | Type      | Description                          |
| ------------------ | --------- | ------------------------------------ |
| `dataToSqlParams`  | Function  | Main utility function                |
| `SqlParamsResult`  | Interface | Return type                          |
| `SqlParamsOptions` | Interface | Options (placeholder style, startAt) |
| `Extractor<T>`     | Type      | Extractor shape union                |
| `PlaceholderStyle` | Type      | `"pg" \| "mysql" \| "mssql"`         |
| `TransformFn`      | Type      | `(v: any) => any` value transformer  |

### Function Signature

```typescript
dataToSqlParams<T extends Record<string, any> = Record<string, any>>(
  data: T | null | undefined,
  extractor?: Extractor<T>,
  options?: SqlParamsOptions
): SqlParamsResult
```

### Extractor Modes

1. **Omitted/undefined:** Extract all own keys (skip `undefined` values)
2. **`string[]`:** Whitelist of own keys to extract
3. **`Record<string, TransformFn | boolean>`:**
   - `true` — include without transform
   - `false` — exclude
   - function — transform value (return `undefined` to skip)

### Options

| Option             | Type                         | Default | Purpose                                        |
| ------------------ | ---------------------------- | ------- | ---------------------------------------------- |
| `placeholderStyle` | `"pg" \| "mysql" \| "mssql"` | `"pg"`  | Placeholder dialect for `placeholders`/`pairs` |
| `startAt`          | `number`                     | `1`     | Starting placeholder number (compose WHERE)    |

### Return Object Properties

| Property       | Type                          | Use Case                                             |
| -------------- | ----------------------------- | ---------------------------------------------------- |
| `keys`         | `string[]`                    | INSERT column list                                   |
| `placeholders` | `string[]`                    | INSERT/VALUES slot                                   |
| `values`       | `any[]`                       | Query parameter array                                |
| `pairs`        | `string[]`                    | UPDATE SET / WHERE conjuncts                         |
| `map`          | `Record<string, any>`         | Named parameters (`$name` keys, always)              |
| `next`         | `number`                      | Next placeholder number                              |
| `transformers` | `Record<string, TransformFn>` | Reuse transforms (successfully extracted keys only)  |
| `_next`        | `number`                      | **Deprecated** alias of `next`                       |
| `_extractor`   | `Record<string, TransformFn>` | **Deprecated** alias of `transformers` (same object) |

## Common Patterns

### INSERT

```typescript
const { keys, placeholders, values } = dataToSqlParams(data);
const sql = `INSERT INTO t (${keys.join(", ")}) VALUES (${placeholders.join(", ")})`;
db.query(sql, values);
```

### UPDATE (single-key WHERE)

```typescript
const { pairs, values, next } = dataToSqlParams(data);
const sql = `UPDATE t SET ${pairs.join(", ")} WHERE id = $${next}`;
db.query(sql, [...values, id]);
```

### UPDATE (multi-column WHERE — compose with `startAt`)

```typescript
const set = dataToSqlParams(updates);
const where = dataToSqlParams({ tenantId, id }, undefined, { startAt: set.next });
const sql = `UPDATE t SET ${set.pairs.join(", ")} WHERE ${where.pairs.join(" AND ")}`;
db.query(sql, [...set.values, ...where.values]);
```

### Transform Example

```typescript
dataToSqlParams(data, {
	id: true, // pass through
	name: (v) => v.toUpperCase(), // transform
	secret: false, // exclude
	date: (v) => v.toISOString(), // convert Date
});
```

### Non-PostgreSQL Placeholders

```typescript
dataToSqlParams(data, undefined, { placeholderStyle: "mysql" }); // ? placeholders
dataToSqlParams(data, undefined, { placeholderStyle: "mssql" }); // @pN placeholders
```

## Key Behaviors

1. **`undefined` values are always skipped** (in `data`, or when a transformer returns `undefined`)
2. **`null` passes through** as a real value (becomes a NULL binding)
3. **Only own properties are extracted** — inherited (prototype) properties are ignored
4. **`null`/`undefined` data is safe** — treated as an empty object
5. **Identifiers are SQL-escaped** (quotes doubled: `"` → `""`)
6. **`next` starts at 1** for empty objects (or whatever `startAt` is set to)
7. **Invalid extractor value** throws `TypeError`
8. **`transformers` omits skipped keys** — only keys whose values made it into the output appear
9. **`map` keys always use `$name`** regardless of `placeholderStyle` — it's a named-parameter output, separate from positional placeholders

## Development Commands

```bash
deno task test         # Run tests
deno task test:watch   # Watch mode
deno task npm:build    # Build for NPM
deno task publish      # Publish to JSR and NPM
```

## Database Compatibility

| Database        | `placeholderStyle` | Notes                     |
| --------------- | ------------------ | ------------------------- |
| PostgreSQL      | `"pg"` (default)   | Native `$N`               |
| SQLite          | `"pg"`             | Numbered params supported |
| MySQL / MariaDB | `"mysql"`          | `?` placeholders          |
| SQL Server      | `"mssql"`          | `@pN` placeholders        |

## Testing

- Framework: Deno Test
- Coverage: 26 test cases
- Key scenarios: empty data, `null`/`undefined` data, undefined handling, transforms, escaping, prototype-leak protection, `startAt` composition, placeholder-style dialects, BC aliases
