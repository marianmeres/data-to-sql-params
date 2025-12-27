# API Reference

## dataToSqlParams

```typescript
function dataToSqlParams(
  data: Record<string, any>,
  extractor?: string[] | Record<string, TransformFn | boolean>
): SqlParamsResult
```

Converts a data object into SQL parameter lists for building dynamic SQL statements.

### Parameters

#### `data`

**Type:** `Record<string, any>`

The source data object to extract values from. All enumerable properties are candidates for extraction.

#### `extractor` (optional)

**Type:** `string[] | Record<string, TransformFn | boolean>`

Defines which keys to extract and how to transform their values. There are three modes:

| Mode | Value | Behavior |
|------|-------|----------|
| Extract all | `undefined` (omit parameter) | Extracts all keys from data, skipping `undefined` values |
| Whitelist | `string[]` | Only extracts the specified keys |
| Transform map | `Record<string, TransformFn \| boolean>` | Fine-grained control per key (see below) |

**Transform map values:**

- `true` - Include the key without transformation
- `false` - Exclude the key from extraction
- `TransformFn` - Apply a custom transformation function

### Return Value

Returns a `SqlParamsResult` object with the following properties:

#### `keys`

**Type:** `string[]`

Array of SQL-quoted identifiers (column names). Quotes within identifiers are properly escaped by doubling.

```typescript
// Example
['"name"', '"email"', '"created_at"']
```

#### `placeholders`

**Type:** `string[]`

Array of PostgreSQL-style positional placeholders corresponding to the values.

```typescript
// Example
['$1', '$2', '$3']
```

#### `values`

**Type:** `any[]`

Array of extracted (and optionally transformed) values in the same order as placeholders.

```typescript
// Example
['John', 'john@example.com', '2024-01-01T00:00:00.000Z']
```

#### `pairs`

**Type:** `string[]`

Array of `"key" = $N` strings for use in UPDATE SET clauses.

```typescript
// Example
['"name" = $1', '"email" = $2', '"created_at" = $3']
```

#### `map`

**Type:** `Record<string, any>`

Object with named parameters using `$` prefix for the key. Useful for database drivers that support named parameter binding.

```typescript
// Example
{ $name: 'John', $email: 'john@example.com', $created_at: '2024-01-01T00:00:00.000Z' }
```

#### `_next`

**Type:** `number`

The next placeholder number available. Use this when you need to add additional parameters (e.g., WHERE conditions) after the main query components.

```typescript
// If 3 fields were extracted, _next will be 4
```

#### `_extractor`

**Type:** `Record<string, TransformFn>`

Object containing the transform functions used for each extracted key. Boolean values in the original extractor are converted to identity functions. Use this to apply the same transformations consistently in other parts of your query.

---

## SqlParamsResult

```typescript
interface SqlParamsResult {
  keys: string[];
  placeholders: string[];
  values: any[];
  pairs: string[];
  map: Record<string, any>;
  _next: number;
  _extractor: Record<string, TransformFn>;
}
```

Result object returned by `dataToSqlParams()`. See the return value documentation above for details on each property.

---

## TransformFn

```typescript
type TransformFn = (v: any) => any
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
import { dataToSqlParams } from '@marianmeres/data-to-sql-params';

const result = dataToSqlParams({ a: 1, x: undefined, b: 2, c: 3 });
// result.keys = ['"a"', '"b"', '"c"']
// result.placeholders = ['$1', '$2', '$3']
// result.values = [1, 2, 3]
// result.pairs = ['"a" = $1', '"b" = $2', '"c" = $3']
// result.map = { $a: 1, $b: 2, $c: 3 }
// result._next = 4
```

### Whitelist Keys

```typescript
const result = dataToSqlParams(
  { a: 1, x: undefined, b: 2, c: 3 },
  ['b', 'c', 'x']  // 'x' will be skipped (undefined)
);
// result.keys = ['"b"', '"c"']
// result.values = [2, 3]
```

### Transform Values

```typescript
const result = dataToSqlParams(
  { id: 1, name: 'alice', createdAt: new Date('2024-01-01') },
  {
    id: true,                           // Include without transformation
    name: (v) => v.toUpperCase(),       // Transform to uppercase
    createdAt: (v) => v.toISOString(),  // Convert Date to string
  }
);
// result.values = [1, 'ALICE', '2024-01-01T00:00:00.000Z']
```

### Exclude Keys

```typescript
const result = dataToSqlParams(
  { id: 1, password: 'secret', email: 'user@example.com' },
  {
    id: true,
    password: false,  // Explicitly exclude
    email: true,
  }
);
// Only id and email are extracted
```

### Dynamic INSERT Statement

```typescript
const userData = {
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: new Date(),
};

const { keys, placeholders, values } = dataToSqlParams(userData, {
  name: true,
  email: true,
  createdAt: (d) => d.toISOString(),
});

const sql = `INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;
// INSERT INTO users ("name", "email", "createdAt") VALUES ($1, $2, $3)

await db.query(sql, values);
```

### Dynamic UPDATE Statement

```typescript
const updates = { name: 'Jane Doe', email: 'jane@example.com' };
const userId = 123;

const { pairs, values, _next } = dataToSqlParams(updates);

const sql = `UPDATE users SET ${pairs.join(', ')} WHERE "id" = $${_next}`;
// UPDATE users SET "name" = $1, "email" = $2 WHERE "id" = $3

await db.query(sql, [...values, userId]);
```

### Reusing Transform Functions

```typescript
const data = { id: 1, name: 'alice' };
const { _extractor, values } = dataToSqlParams(data, {
  id: true,
  name: (v) => v.toUpperCase(),
});

// Later, apply the same transformation for consistency
const newName = 'bob';
const transformed = _extractor.name(newName);  // 'BOB'
```
