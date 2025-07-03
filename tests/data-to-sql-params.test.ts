import { assert, assertEquals, assertRejects } from "@std/assert";
import { dataToSqlParams } from "../src/data-to-sql-params.ts";

// import { strict as assert } from 'node:assert';
// import path from 'node:path';
// import { fileURLToPath } from 'node:url';
// import { dataToSqlParams } from '../dist/index.js';

// const suite = new TestRunner(path.basename(fileURLToPath(import.meta.url)));

Deno.test('no extractor works', () => {
	const { keys, placeholders, pairs, values, map, _next } = dataToSqlParams({
		a: 1,
		x: undefined,
		b: 2,
		c: 3,
	});

	assertEquals(keys, ['"a"', '"b"', '"c"']);
	assertEquals(placeholders, ['$1', '$2', '$3']);
	assertEquals(values, [1, 2, 3]);
	assertEquals(pairs, ['"a"=$1', '"b"=$2', '"c"=$3']);
	assertEquals(map, { $a: 1, $b: 2, $c: 3 });
});

Deno.test('extractor as array whitelist works', () => {
	const { keys, placeholders, pairs, values, map } = dataToSqlParams(
		{ a: 1, x: undefined, b: 2, c: 3 },
		// note that "x" must not be part of output even if present here
		['b', 'c', 'x']
	);

	assertEquals(keys, ['"b"', '"c"']);
	assertEquals(placeholders, ['$1', '$2']);
	assertEquals(values, [2, 3]);
	assertEquals(pairs, ['"b"=$1', '"c"=$2']);
	assertEquals(map, { $b: 2, $c: 3 });
});

Deno.test('extractor map works', () => {
	const { keys, placeholders, pairs, values, map, _extractor } = dataToSqlParams(
		{ a: 1, x: undefined, b: 2, c: 3 },
		{
			// explicit true is special case "no transform" signal
			b: true,
			c: (v) => `${v + v}`,
		}
	);

	assertEquals(keys, ['"b"', '"c"']);
	assertEquals(placeholders, ['$1', '$2']);
	assertEquals(values, [2, '6']);
	assertEquals(pairs, ['"b"=$1', '"c"=$2']);
	assertEquals(map, { $b: 2, $c: '6' });

	// the returned extractor does not contain the original boolean flags, but no transform fn
	assert(typeof _extractor.b === 'function');
	assert(_extractor.b(123) === 123);
});

Deno.test('extractor with false value', () => {
	const { keys, values } = dataToSqlParams(
		{ a: 1, x: undefined, b: 2, c: false },
		{ x: false, b: false, c: (v) => v }
	);

    assertEquals(keys, ['"c"']);
    assertEquals(values, [false]);
});
