import { assert, assertEquals, assertThrows } from "@std/assert";
import { dataToSqlParams } from "../src/data-to-sql-params.ts";

// import { strict as assert } from 'node:assert';
// import path from 'node:path';
// import { fileURLToPath } from 'node:url';
// import { dataToSqlParams } from '../dist/index.js';

// const suite = new TestRunner(path.basename(fileURLToPath(import.meta.url)));

Deno.test("no extractor works", () => {
	const { keys, placeholders, pairs, values, map, _next } = dataToSqlParams({
		a: 1,
		x: undefined,
		b: 2,
		c: 3,
	});

	assertEquals(keys, ['"a"', '"b"', '"c"']);
	assertEquals(placeholders, ["$1", "$2", "$3"]);
	assertEquals(values, [1, 2, 3]);
	assertEquals(pairs, ['"a" = $1', '"b" = $2', '"c" = $3']);
	assertEquals(map, { $a: 1, $b: 2, $c: 3 });
});

Deno.test("extractor as array whitelist works", () => {
	const { keys, placeholders, pairs, values, map } = dataToSqlParams(
		{ a: 1, x: undefined, b: 2, c: 3 },
		// note that "x" must not be part of output even if present here
		["b", "c", "x"],
	);

	assertEquals(keys, ['"b"', '"c"']);
	assertEquals(placeholders, ["$1", "$2"]);
	assertEquals(values, [2, 3]);
	assertEquals(pairs, ['"b" = $1', '"c" = $2']);
	assertEquals(map, { $b: 2, $c: 3 });
});

Deno.test("extractor map works", () => {
	const { keys, placeholders, pairs, values, map, _extractor } = dataToSqlParams(
		{ a: 1, x: undefined, b: 2, c: 3 },
		{
			// explicit true is special case "no transform" signal
			b: true,
			c: (v) => `${v + v}`,
		},
	);

	assertEquals(keys, ['"b"', '"c"']);
	assertEquals(placeholders, ["$1", "$2"]);
	assertEquals(values, [2, "6"]);
	assertEquals(pairs, ['"b" = $1', '"c" = $2']);
	assertEquals(map, { $b: 2, $c: "6" });

	// the returned extractor does not contain the original boolean flags, but no transform fn
	assert(typeof _extractor.b === "function");
	assert(_extractor.b(123) === 123);
});

Deno.test("extractor with false value", () => {
	const { keys, values } = dataToSqlParams(
		{ a: 1, x: undefined, b: 2, c: false },
		{ x: false, b: false, c: (v) => v },
	);

	assertEquals(keys, ['"c"']);
	assertEquals(values, [false]);
});

Deno.test("keys with special characters (quotes) are properly escaped", () => {
	const { keys, pairs } = dataToSqlParams(
		{ 'user"name': "alice", 'test"key"value': 123 },
	);

	assertEquals(keys, ['"user""name"', '"test""key""value"']);
	assertEquals(pairs, ['"user""name" = $1', '"test""key""value" = $2']);
});

Deno.test("empty object returns empty arrays", () => {
	const { keys, placeholders, values, pairs, map, _next } = dataToSqlParams({});

	assertEquals(keys, []);
	assertEquals(placeholders, []);
	assertEquals(values, []);
	assertEquals(pairs, []);
	assertEquals(map, {});
	assertEquals(_next, 1);
});

Deno.test("all undefined values returns empty arrays", () => {
	const { keys, values, _next } = dataToSqlParams({
		a: undefined,
		b: undefined,
		c: undefined,
	});

	assertEquals(keys, []);
	assertEquals(values, []);
	assertEquals(_next, 1);
});

Deno.test("transformer returning undefined skips the field", () => {
	const { keys, values } = dataToSqlParams(
		{ a: 1, b: 2, c: 3 },
		{
			a: true,
			b: (v) => undefined, // Transformer returns undefined
			c: (v) => v * 2,
		},
	);

	assertEquals(keys, ['"a"', '"c"']);
	assertEquals(values, [1, 6]);
});

Deno.test("_next counter reflects next available placeholder", () => {
	const result1 = dataToSqlParams({ a: 1, b: 2 });
	assertEquals(result1._next, 3);

	const result2 = dataToSqlParams({ x: 1 });
	assertEquals(result2._next, 2);

	const result3 = dataToSqlParams({ a: undefined });
	assertEquals(result3._next, 1);
});

Deno.test("_extractor can be reused for consistent transformations", () => {
	const data1 = { id: 1, name: "alice" };
	const result = dataToSqlParams(data1, {
		id: true,
		name: (v) => v.toUpperCase(),
	});

	// Reuse the extractor on new data
	const data2 = { id: 2, name: "bob" };
	const transformed = result._extractor.name(data2.name);

	assertEquals(transformed, "BOB");
	assertEquals(result.values[1], "ALICE");
});

Deno.test("handles various data types correctly", () => {
	const now = new Date("2024-01-01");
	const { values } = dataToSqlParams({
		str: "hello",
		num: 42,
		bool: true,
		nullVal: null,
		date: now,
		obj: { nested: "value" },
		arr: [1, 2, 3],
	});

	assertEquals(values[0], "hello");
	assertEquals(values[1], 42);
	assertEquals(values[2], true);
	assertEquals(values[3], null);
	assertEquals(values[4], now);
	assertEquals(values[5], { nested: "value" });
	assertEquals(values[6], [1, 2, 3]);
});

Deno.test("invalid extractor value throws TypeError", () => {
	assertThrows(
		// @ts-expect-error Testing invalid input
		() => dataToSqlParams({ a: 1 }, { a: "invalid" }),
		TypeError,
		"Unexpected transformer value 'invalid'",
	);
});

Deno.test("whitelist with non-existent keys skips them", () => {
	const { keys, values } = dataToSqlParams(
		{ a: 1, b: 2 },
		["a", "nonexistent", "b", "another"],
	);

	assertEquals(keys, ['"a"', '"b"']);
	assertEquals(values, [1, 2]);
});

Deno.test("map uses dollar prefix for named parameters", () => {
	const { map } = dataToSqlParams({
		userId: 123,
		userName: "alice",
		isActive: true,
	});

	assertEquals(map.$userId, 123);
	assertEquals(map.$userName, "alice");
	assertEquals(map.$isActive, true);
});

Deno.test("null/undefined data is treated as empty", () => {
	const a = dataToSqlParams(null);
	assertEquals(a.keys, []);
	assertEquals(a.values, []);
	assertEquals(a.next, 1);
	assertEquals(a._next, 1);

	const b = dataToSqlParams(undefined);
	assertEquals(b.keys, []);
	assertEquals(b.next, 1);

	// null data + whitelist still yields empty (no own keys)
	const c = dataToSqlParams(null, ["a", "b"]);
	assertEquals(c.keys, []);
	assertEquals(c.next, 1);
});

Deno.test("empty array extractor yields empty result", () => {
	const { keys, values, next } = dataToSqlParams({ a: 1, b: 2 }, []);
	assertEquals(keys, []);
	assertEquals(values, []);
	assertEquals(next, 1);
});

Deno.test("inherited (prototype) properties are ignored", () => {
	class Row {
		id = 1;
		name = "a";
	}
	// biome-ignore: intentionally adding a prototype method to test leak protection
	(Row.prototype as unknown as { extra: number }).extra = 999;

	const { keys, values } = dataToSqlParams(
		new Row() as unknown as Record<string, unknown>,
		["id", "name", "extra"],
	);
	assertEquals(keys, ['"id"', '"name"']);
	assertEquals(values, [1, "a"]);

	// No extractor: also only own keys, never inherited
	const r2 = dataToSqlParams(new Row() as unknown as Record<string, unknown>);
	assertEquals(r2.keys, ['"id"', '"name"']);
});

Deno.test("whitelist including Object.prototype keys is safely ignored", () => {
	const { keys, values } = dataToSqlParams(
		{ name: "ok" },
		["name", "toString", "constructor", "hasOwnProperty"],
	);
	assertEquals(keys, ['"name"']);
	assertEquals(values, ["ok"]);
});

Deno.test("transformers is the same reference as _extractor (BC alias)", () => {
	const { transformers, _extractor } = dataToSqlParams(
		{ a: 1 },
		{ a: (v) => v + 1 },
	);
	assertEquals(transformers, _extractor);
	// Proves identity, not just structural equality:
	assertEquals(transformers === _extractor, true);
});

Deno.test("transformers omits skipped keys (false, undefined, transform→undefined)", () => {
	const { transformers } = dataToSqlParams(
		{ keep: 1, dropFalse: 2, dropUndef: undefined, dropFn: 3 },
		{
			keep: true,
			dropFalse: false,
			dropUndef: true,
			dropFn: () => undefined,
		},
	);
	assertEquals(Object.keys(transformers).sort(), ["dropFn", "keep"]);
	assert(typeof transformers.keep === "function");
});

Deno.test("next alias matches _next and tracks placeholder counter", () => {
	const r = dataToSqlParams({ a: 1, b: 2, c: 3 });
	assertEquals(r.next, 4);
	assertEquals(r._next, 4);
	assertEquals(r.next, r._next);
});

Deno.test("startAt continues placeholder numbering for WHERE composition", () => {
	const set = dataToSqlParams({ name: "Jane", status: "active" });
	const where = dataToSqlParams(
		{ id: 123 },
		undefined,
		{ startAt: set.next },
	);

	assertEquals(set.placeholders, ["$1", "$2"]);
	assertEquals(set.next, 3);

	assertEquals(where.placeholders, ["$3"]);
	assertEquals(where.pairs, ['"id" = $3']);
	assertEquals(where.next, 4);
});

Deno.test('placeholderStyle: mysql emits "?" placeholders', () => {
	const { placeholders, pairs } = dataToSqlParams(
		{ a: 1, b: 2 },
		undefined,
		{ placeholderStyle: "mysql" },
	);
	assertEquals(placeholders, ["?", "?"]);
	assertEquals(pairs, ['"a" = ?', '"b" = ?']);
});

Deno.test('placeholderStyle: mssql emits "@pN" placeholders', () => {
	const { placeholders, pairs, next } = dataToSqlParams(
		{ a: 1, b: 2 },
		undefined,
		{ placeholderStyle: "mssql" },
	);
	assertEquals(placeholders, ["@p1", "@p2"]);
	assertEquals(pairs, ['"a" = @p1', '"b" = @p2']);
	assertEquals(next, 3);
});

Deno.test("placeholderStyle with startAt composes correctly", () => {
	const first = dataToSqlParams(
		{ a: 1 },
		undefined,
		{ placeholderStyle: "mssql" },
	);
	const second = dataToSqlParams(
		{ b: 2 },
		undefined,
		{ placeholderStyle: "mssql", startAt: first.next },
	);
	assertEquals(first.placeholders, ["@p1"]);
	assertEquals(second.placeholders, ["@p2"]);
});

Deno.test("map always uses $name regardless of placeholderStyle", () => {
	const { map } = dataToSqlParams(
		{ a: 1 },
		undefined,
		{ placeholderStyle: "mysql" },
	);
	assertEquals(map, { $a: 1 });
});
