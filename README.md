# @marianmeres/data-to-sql-params

A single utility function to convert data object to various helper lists.
Useful for automatically creating SQL statements.

## Installation

```
npm install @marianmeres/data-to-sql-params
```

## `dataToSqlParams` signature

```typescript
function dataToSqlParams(
	data: Record<string, any>,
	extractor?: string[] | Record<string, CallableFunction | true>
): {
	keys: string[];
	placeholders: string[];
	values: any[];
	pairs: string[];
	_next: number;
	_extractor: Record<string, CallableFunction>;
} {
	/* ... */
}
```

## Example usage

```js
import { dataToSqlParams } from '@marianmeres/data-to-sql-params';

// no extractor example - all defined keys are extracted
const result = dataToSqlParams({ a: 1, x: undefined, b: 2, c: 3 });
/* result is now:
    {
        keys: [ '"a"', '"b"', '"c"' ],
        placeholders: [ '$1', '$2', '$3' ],
        pairs: [ '"a"=$1', '"b"=$2', '"c"=$3' ],
        values: [ 1, 2, 3 ],
        _next: 4,
        _extractor: Record<string, CallableFunction> (actual value omitted)
    }
*/

// extractor as a plain key whitelist (note that "x" will not be part of output)
const result = dataToSqlParams({ a: 1, x: undefined, b: 2, c: 3 }, ['b', 'c', 'x']);
/* result is now:
    {
        keys: [ '"b"', '"c"' ],
        placeholders: [ '$1', '$2' ],
        values: [ 2, 3 ],
        pairs: [ '"b"=$1', '"c"=$2' ],
        _next: 3,
        _extractor: Record<string, CallableFunction> (actual value omitted)
    }
*/

// custom extractor example - transforming data upon extraction
// (explicit true below just whitelists the given key)
const result = dataToSqlParams(
	{ a: 1, x: undefined, b: 2, c: 3 },
	{ b: true, c: (v) => `${v + v}` }
);
/* result is now:
    {
        keys: [ '"b"', '"c"' ],
        placeholders: [ '$1', '$2' ],
        values: [ 2, '6' ],
        pairs: [ '"b"=$1', '"c"=$2' ],
        _next: 3,
        _extractor: Record<string, CallableFunction> (actual value omitted)
    }
*/
```

## What is it good for?

For helping to programmatically build SQL statements. For example:

```js
// assuming result from the last example above
let { keys, values, placeholders, pairs, _next } = result;

if (fooRecordExists) {
	sql = `update foo set ${pairs} where "id" = $${_next++}`;
	// update foo set "b" = $1,"c" = $2 where "id" = $3
} else {
	sql = `insert into foo (${keys}) values (${placeholders})`;
	// insert into foo ("b", "c") values ($1, $2)
}
```
