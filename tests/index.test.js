import { TestRunner } from '@marianmeres/test-runner';
import isEqual from 'lodash/isEqual.js';
import { strict as assert } from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataToSqlParams } from '../dist/index.js';

const suite = new TestRunner(path.basename(fileURLToPath(import.meta.url)));

suite.test('no extractor works', () => {
	const { keys, placeholders, pairs, values, _next } = dataToSqlParams({
		a: 1,
		x: undefined,
		b: 2,
		c: 3,
	});

	assert(isEqual(keys, ['"a"', '"b"', '"c"']), `ke: ${JSON.stringify(keys)}`);
	assert(
		isEqual(placeholders, ['$1', '$2', '$3']),
		`pl: ${JSON.stringify(placeholders)}`
	);
	assert(isEqual(values, [1, 2, 3]), `va: ${JSON.stringify(values)}`);
	assert(isEqual(pairs, ['"a"=$1', '"b"=$2', '"c"=$3']), `pa: ${JSON.stringify(pairs)}`);
});

suite.test('extractor as array whitelist works', () => {
	const { keys, placeholders, pairs, values } = dataToSqlParams(
		{
			a: 1,
			x: undefined,
			b: 2,
			c: 3,
		},
		// note that "x" must not be part of output even if present here
		['b', 'c', 'x']
	);

	assert(isEqual(keys, ['"b"', '"c"']), `ke: ${JSON.stringify(keys)}`);
	assert(isEqual(placeholders, ['$1', '$2']), `pl: ${JSON.stringify(placeholders)}`);
	assert(isEqual(values, [2, 3]), `va: ${JSON.stringify(values)}`);
	assert(isEqual(pairs, ['"b"=$1', '"c"=$2']), `pa: ${JSON.stringify(pairs)}`);
});

suite.test('extractor map works', () => {
	const { keys, placeholders, pairs, values, _extractor } = dataToSqlParams(
		{
			a: 1,
			x: undefined,
			b: 2,
			c: 3,
		},
		{
			// explicit true is special case "no transform" signal
			b: true,
			c: (v) => `${v + v}`,
		}
	);

	assert(isEqual(keys, ['"b"', '"c"']), `ke: ${JSON.stringify(keys)}`);
	assert(isEqual(placeholders, ['$1', '$2']), `pl: ${JSON.stringify(placeholders)}`);
	assert(isEqual(values, [2, '6']), `va: ${JSON.stringify(values)}`);
	assert(isEqual(pairs, ['"b"=$1', '"c"=$2']), `pa: ${JSON.stringify(pairs)}`);

	// the returned extractor does not contain the original boolean flags, but no transform fn
	assert(typeof _extractor.b === 'function');
	assert(_extractor.b(123) === 123);
});

suite.test('readme example', () => {
	// no extractor example
	// const result = dataToSqlParams({ a: 1, x: undefined, b: 2, c: 3 });

	const result = dataToSqlParams(
		{ a: 1, x: undefined, b: 2, c: 3 },
		// example custom extractor
		// ['b', 'c', 'x']
		{
			// explicit true is special case "no transform" signal
			b: true,
			c: (v) => `${v + v}`,
		}
	);
	console.log(result);
	// console.log(keys);
});

export default suite;
