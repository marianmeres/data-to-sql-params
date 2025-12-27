# Agent Instructions

## Package Overview

- **Name:** `@marianmeres/data-to-sql-params`
- **Purpose:** Convert JavaScript objects to SQL parameter components for parameterized queries
- **Style:** PostgreSQL (`$1`, `$2` placeholders)
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

| Export | Type | Description |
|--------|------|-------------|
| `dataToSqlParams` | Function | Main utility function |
| `SqlParamsResult` | Interface | Return type of dataToSqlParams |
| `TransformFn` | Type | `(v: any) => any` - Value transformer |

### Function Signature

```typescript
dataToSqlParams(
  data: Record<string, any>,
  extractor?: string[] | Record<string, TransformFn | boolean>
): SqlParamsResult
```

### Extractor Modes

1. **Omitted/undefined:** Extract all keys (skip `undefined` values)
2. **`string[]`:** Whitelist of keys to extract
3. **`Record<string, TransformFn | boolean>`:**
   - `true` = include without transform
   - `false` = exclude
   - `function` = transform value

### Return Object Properties

| Property | Type | Use Case |
|----------|------|----------|
| `keys` | `string[]` | INSERT column list |
| `placeholders` | `string[]` | INSERT/SELECT values |
| `values` | `any[]` | Query parameter array |
| `pairs` | `string[]` | UPDATE SET clause |
| `map` | `Record<string, any>` | Named parameters |
| `_next` | `number` | WHERE clause placeholders |
| `_extractor` | `Record<string, TransformFn>` | Reuse transforms |

## Common Patterns

### INSERT

```typescript
const { keys, placeholders, values } = dataToSqlParams(data);
const sql = `INSERT INTO t (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;
db.query(sql, values);
```

### UPDATE

```typescript
const { pairs, values, _next } = dataToSqlParams(data);
const sql = `UPDATE t SET ${pairs.join(', ')} WHERE id = $${_next}`;
db.query(sql, [...values, id]);
```

### Transform Example

```typescript
dataToSqlParams(data, {
  id: true,                      // pass through
  name: (v) => v.toUpperCase(),  // transform
  secret: false,                 // exclude
  date: (v) => v.toISOString(), // convert Date
});
```

## Key Behaviors

1. **`undefined` values are always skipped** (in data or from transformer)
2. **Identifiers are SQL-escaped** (quotes doubled: `"` → `""`)
3. **`_next` starts at 1** for empty objects
4. **Transformer returning `undefined`** skips that field
5. **Invalid extractor value** throws `TypeError`

## Development Commands

```bash
deno task test         # Run tests
deno task test:watch   # Watch mode
deno task npm:build    # Build for NPM
deno task publish      # Publish to JSR and NPM
```

## Database Compatibility

| Database | Compatible | Notes |
|----------|------------|-------|
| PostgreSQL | Yes | Native `$N` placeholders |
| SQLite | Yes | Supports numbered params |
| MySQL | Partial | Needs `?` placeholder conversion |
| SQL Server | Partial | Needs `@pN` conversion |

## Testing

- Framework: Deno Test
- Coverage: 14 test cases
- Key scenarios: empty data, undefined handling, transforms, escaping, edge cases
