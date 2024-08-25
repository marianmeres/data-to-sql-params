# @marianmeres/data-to-sql-params

A single helper function to convert data objects to various helper lists.
Useful for programmatically creating SQL statements.

## Installation

```
npm install @marianmeres/data-to-sql-params
```

## Signature

```typescript
function dataToSqlParams(
	data: Record<string, any>,
	extractor?: string[] | Record<string, CallableFunction | true>
): {
	keys: string[];
	placeholders: string[];
	values: any[];
	pairs: string[];
	map: Record<string, any>;
	_next: number;
	_extractor: Record<string, CallableFunction>;
} {
	/* ... */
}
```

## Example usage

```js
import { dataToSqlParams } from '@marianmeres/data-to-sql-params';
```

```js
// no extractor example - all defined keys are extracted
const result = dataToSqlParams({ a: 1, x: undefined, b: 2, c: 3 });
/* {
    keys: [ '"a"', '"b"', '"c"' ],
    placeholders: [ '$1', '$2', '$3' ],
    pairs: [ '"a"=$1', '"b"=$2', '"c"=$3' ],
    values: [ 1, 2, 3 ],
    map: { $a: 1, $b: 2, $c: 3 },
    _next: 4,
    _extractor: Record<string, CallableFunction> (actual value omitted)
} */
```

```js
// extractor as a plain key whitelist (note that "x" will not be part of output)
const result = dataToSqlParams({ a: 1, x: undefined, b: 2, c: 3 }, ['b', 'c', 'x']);
/* {
    keys: [ '"b"', '"c"' ],
    placeholders: [ '$1', '$2' ],
    values: [ 2, 3 ],
    pairs: [ '"b"=$1', '"c"=$2' ],
    map: { $b: 2, $c: 3 },
    _next: 3,
    _extractor: Record<string, CallableFunction> (actual value omitted)
} */
```

```js
// custom extractor example - transforming data upon extraction
// eg. cast to string, JSON encode, etc...
// (explicit true below just whitelists the given key)
const result = dataToSqlParams(
	{ id: 1, x: undefined, b: 2, c: 3 },
	{ id: true, c: (v) => `${v + v}` }
);
/* {
    keys: [ '"id"', '"c"' ],
    placeholders: [ '$1', '$2' ],
    values: [ 1, '6' ],
    pairs: [ '"id"=$1', '"c"=$2' ],
    map: { $id: 1, $c: 6 },
    _next: 3,
    _extractor: Record<string, CallableFunction> (actual value omitted)
} */
```

## What is it good for?

For helping to programmatically build SQL statements. For example:

```js
// assuming result from the last example above
let { keys, values, placeholders, pairs, map, _next } = result;

if (fooRecordExists) {
	const pk = 'id'; // example
	sql = `update foo set ${pairs} where "${pk}" = $${_next++}`;
	// update foo set "id" = $1,"c" = $2 where "id" = $3
	values.push(_extractor[pk](data[pk]));
} else {
	sql = `insert into foo (${keys}) values (${placeholders})`;
	// insert into foo ("id", "c") values ($1, $2)
}

// and now execute the statement
await db.query(sql, values);

// or we can use the named map (if the db supports it), eg:
await db.run('update foo set c = $c where id = $id', map);
```
