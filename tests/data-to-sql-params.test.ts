import { assert, assertEquals, assertThrows } from "@std/assert";
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
	assertEquals(pairs, ['"a" = $1', '"b" = $2', '"c" = $3']);
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
	assertEquals(pairs, ['"b" = $1', '"c" = $2']);
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
	assertEquals(pairs, ['"b" = $1', '"c" = $2']);
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

Deno.test('keys with special characters (quotes) are properly escaped', () => {
	const { keys, pairs } = dataToSqlParams(
		{ 'user"name': 'alice', 'test"key"value': 123 }
	);

	assertEquals(keys, ['"user""name"', '"test""key""value"']);
	assertEquals(pairs, ['"user""name" = $1', '"test""key""value" = $2']);
});

Deno.test('empty object returns empty arrays', () => {
	const { keys, placeholders, values, pairs, map, _next } = dataToSqlParams({});

	assertEquals(keys, []);
	assertEquals(placeholders, []);
	assertEquals(values, []);
	assertEquals(pairs, []);
	assertEquals(map, {});
	assertEquals(_next, 1);
});

Deno.test('all undefined values returns empty arrays', () => {
	const { keys, values, _next } = dataToSqlParams({
		a: undefined,
		b: undefined,
		c: undefined,
	});

	assertEquals(keys, []);
	assertEquals(values, []);
	assertEquals(_next, 1);
});

Deno.test('transformer returning undefined skips the field', () => {
	const { keys, values } = dataToSqlParams(
		{ a: 1, b: 2, c: 3 },
		{
			a: true,
			b: (v) => undefined, // Transformer returns undefined
			c: (v) => v * 2,
		}
	);

	assertEquals(keys, ['"a"', '"c"']);
	assertEquals(values, [1, 6]);
});

Deno.test('_next counter reflects next available placeholder', () => {
	const result1 = dataToSqlParams({ a: 1, b: 2 });
	assertEquals(result1._next, 3);

	const result2 = dataToSqlParams({ x: 1 });
	assertEquals(result2._next, 2);

	const result3 = dataToSqlParams({ a: undefined });
	assertEquals(result3._next, 1);
});

Deno.test('_extractor can be reused for consistent transformations', () => {
	const data1 = { id: 1, name: 'alice' };
	const result = dataToSqlParams(data1, {
		id: true,
		name: (v) => v.toUpperCase(),
	});

	// Reuse the extractor on new data
	const data2 = { id: 2, name: 'bob' };
	const transformed = result._extractor.name(data2.name);

	assertEquals(transformed, 'BOB');
	assertEquals(result.values[1], 'ALICE');
});

Deno.test('handles various data types correctly', () => {
	const now = new Date('2024-01-01');
	const { values } = dataToSqlParams({
		str: 'hello',
		num: 42,
		bool: true,
		nullVal: null,
		date: now,
		obj: { nested: 'value' },
		arr: [1, 2, 3],
	});

	assertEquals(values[0], 'hello');
	assertEquals(values[1], 42);
	assertEquals(values[2], true);
	assertEquals(values[3], null);
	assertEquals(values[4], now);
	assertEquals(values[5], { nested: 'value' });
	assertEquals(values[6], [1, 2, 3]);
});

Deno.test('invalid extractor value throws TypeError', () => {
	assertThrows(
		// @ts-expect-error Testing invalid input
		() => dataToSqlParams({ a: 1 }, { a: 'invalid' }),
		TypeError,
		"Unexpected transformer value 'invalid'"
	);
});

Deno.test('whitelist with non-existent keys skips them', () => {
	const { keys, values } = dataToSqlParams(
		{ a: 1, b: 2 },
		['a', 'nonexistent', 'b', 'another']
	);

	assertEquals(keys, ['"a"', '"b"']);
	assertEquals(values, [1, 2]);
});

Deno.test('map uses dollar prefix for named parameters', () => {
	const { map } = dataToSqlParams({
		userId: 123,
		userName: 'alice',
		isActive: true,
	});

	assertEquals(map.$userId, 123);
	assertEquals(map.$userName, 'alice');
	assertEquals(map.$isActive, true);
});
