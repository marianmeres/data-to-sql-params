import { TestRunner } from '@marianmeres/test-runner';
import isEqual from 'lodash/isEqual.js';
import { strict as assert } from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataToSqlParams } from '../dist/index.js';

const suite = new TestRunner(path.basename(fileURLToPath(import.meta.url)));

suite.test('no extractor works', () => {
	const { keys, placeholders, pairs, values, map, _next } = dataToSqlParams({
		a: 1,
		x: undefined,
		b: 2,
		c: 3,
	});

	assert(isEqual(keys, ['"a"', '"b"', '"c"']));
	assert(isEqual(placeholders, ['$1', '$2', '$3']));
	assert(isEqual(values, [1, 2, 3]));
	assert(isEqual(pairs, ['"a"=$1', '"b"=$2', '"c"=$3']));
	assert(isEqual(map, { $a: 1, $b: 2, $c: 3 }));
});

suite.test('extractor as array whitelist works', () => {
	const { keys, placeholders, pairs, values, map } = dataToSqlParams(
		{
			a: 1,
			x: undefined,
			b: 2,
			c: 3,
		},
		// note that "x" must not be part of output even if present here
		['b', 'c', 'x']
	);

	assert(isEqual(keys, ['"b"', '"c"']));
	assert(isEqual(placeholders, ['$1', '$2']));
	assert(isEqual(values, [2, 3]));
	assert(isEqual(pairs, ['"b"=$1', '"c"=$2']));
	assert(isEqual(map, { $b: 2, $c: 3 }));
});

suite.test('extractor map works', () => {
	const { keys, placeholders, pairs, values, map, _extractor } = dataToSqlParams(
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

	assert(isEqual(keys, ['"b"', '"c"']));
	assert(isEqual(placeholders, ['$1', '$2']));
	assert(isEqual(values, [2, '6']));
	assert(isEqual(pairs, ['"b"=$1', '"c"=$2']));
	assert(isEqual(map, { $b: 2, $c: '6' }));

	// the returned extractor does not contain the original boolean flags, but no transform fn
	assert(typeof _extractor.b === 'function');
	assert(_extractor.b(123) === 123);
});

export default suite;
