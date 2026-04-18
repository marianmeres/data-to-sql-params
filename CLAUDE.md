# @marianmeres/data-to-sql-params

Lightweight utility for converting JS objects to PostgreSQL-style parameterized SQL components.

## Quick Reference

```typescript
import { dataToSqlParams } from "@marianmeres/data-to-sql-params";

const { keys, placeholders, values, pairs, map, next, transformers } =
  dataToSqlParams(data, extractor?, options?);
```

## Core Concept

Takes object → returns SQL building blocks:

- `keys`: `['"col1"', '"col2"']` — for INSERT column list
- `placeholders`: `['$1', '$2']` (default) — for VALUES clause
- `values`: `[val1, val2]` — parameter array for `db.query()`
- `pairs`: `['"col1" = $1', '"col2" = $2']` — for UPDATE SET / WHERE
- `map`: `{ $col1: val1, $col2: val2 }` — named parameters (always `$`-prefixed)
- `next`: next placeholder number — pass as `options.startAt` to compose WHERE
- `transformers`: transform fns for successfully extracted keys (reuse for consistency)
- `_next` / `_extractor`: **deprecated** aliases of `next` / `transformers`

## Extractor Options

1. **Omit**: Extract all defined own keys
2. **Array**: Whitelist `['name', 'email']`
3. **Object**: Per-key control `{ name: true, password: false, date: (v) => v.toISOString() }`

## Options

- `placeholderStyle`: `"pg"` (default) | `"mysql"` (`?`) | `"mssql"` (`@pN`)
- `startAt`: starting placeholder number (for WHERE-clause composition)

## Key Files

- `src/data-to-sql-params.ts` — Main implementation
- `src/mod.ts` — Entry point
- `tests/data-to-sql-params.test.ts` — Test suite

## Commands

```bash
deno task test      # Run tests
deno task publish   # Publish to JSR + NPM
```

## Notes

- `undefined` values always skipped; `null` passes through as a real value
- Only own properties of `data` are considered (prototype chain ignored)
- `null`/`undefined` data is treated as an empty object
- Identifiers properly escaped (quotes doubled)
- MIT licensed, zero dependencies
