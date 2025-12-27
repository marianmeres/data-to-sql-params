# @marianmeres/data-to-sql-params

Lightweight utility for converting JS objects to PostgreSQL-style parameterized SQL components.

## Quick Reference

```typescript
import { dataToSqlParams } from "@marianmeres/data-to-sql-params";

const { keys, placeholders, values, pairs, map, _next } = dataToSqlParams(data, extractor?);
```

## Core Concept

Takes object → returns SQL building blocks:
- `keys`: `['"col1"', '"col2"']` - for INSERT column list
- `placeholders`: `['$1', '$2']` - for VALUES clause
- `values`: `[val1, val2]` - parameter array for db.query()
- `pairs`: `['"col1" = $1', '"col2" = $2']` - for UPDATE SET
- `map`: `{ $col1: val1, $col2: val2 }` - named parameters
- `_next`: next placeholder number for WHERE clause

## Extractor Options

1. **Omit**: Extract all defined keys
2. **Array**: Whitelist of keys `['name', 'email']`
3. **Object**: Per-key control `{ name: true, password: false, date: (v) => v.toISOString() }`

## Key Files

- `src/data-to-sql-params.ts` - Main implementation
- `src/mod.ts` - Entry point
- `tests/data-to-sql-params.test.ts` - Test suite

## Commands

```bash
deno task test      # Run tests
deno task publish   # Publish to JSR + NPM
```

## Notes

- Undefined values always skipped
- Identifiers properly escaped (quotes doubled)
- MIT licensed, zero dependencies
