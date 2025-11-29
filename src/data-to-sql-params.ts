/**
 * Transform function type for converting values during extraction
 */
export type TransformFn = (v: any) => any;

/**
 * Converts a data object into SQL parameter lists for building dynamic SQL statements.
 *
 * This function extracts data from an object and generates various formats useful for
 * programmatically creating SQL statements with parameterized queries (PostgreSQL-style $1, $2, etc).
 *
 * @param data - The source data object to extract values from
 * @param extractor - Optional extraction strategy:
 *   - `undefined`: Extract all keys from data (except undefined values)
 *   - `string[]`: Array of key names to extract (whitelist)
 *   - `Record<string, TransformFn | boolean>`: Object mapping keys to transform functions or boolean flags
 *     - `true`: Include the key without transformation
 *     - `false`: Exclude the key from extraction
 *     - `TransformFn`: Include the key and apply the transformation function
 *
 * @returns Object containing:
 *   - `keys`: Array of quoted SQL identifiers (e.g., `['"name"', '"age"']`)
 *   - `placeholders`: Array of positional placeholders (e.g., `['$1', '$2']`)
 *   - `values`: Array of extracted values in the same order as placeholders
 *   - `pairs`: Array of "key = placeholder" strings for UPDATE statements (e.g., `['"name" = $1']`)
 *   - `map`: Object with named parameters using `$` prefix (e.g., `{$name: 'John', $age: 30}`)
 *   - `_next`: Next placeholder number available for additional parameters
 *   - `_extractor`: Object containing the transform functions used for each key
 *
 * @example
 * // Extract all defined keys
 * const result = dataToSqlParams({ a: 1, b: 2, c: undefined });
 * // result.keys = ['"a"', '"b"']
 * // result.placeholders = ['$1', '$2']
 * // result.values = [1, 2]
 * // result.pairs = ['"a" = $1', '"b" = $2']
 * // result.map = { $a: 1, $b: 2 }
 *
 * @example
 * // Extract specific keys only
 * const result = dataToSqlParams({ a: 1, b: 2, c: 3 }, ['a', 'c']);
 * // result.values = [1, 3]
 *
 * @example
 * // Transform values during extraction
 * const result = dataToSqlParams(
 *   { id: 1, name: 'John', createdAt: new Date() },
 *   { id: true, name: (v) => v.toUpperCase(), createdAt: (v) => v.toISOString() }
 * );
 */
export const dataToSqlParams = (
	data: Record<string, any>,
	extractor?: string[] | Record<string, TransformFn | boolean>
): {
	keys: string[];
	placeholders: string[];
	values: any[];
	pairs: string[];
	map: Record<string, any>;
	_next: number;
	_extractor: Record<string, TransformFn>;
} => {
	const _noTransform = (v: any) => v;

	// If no extractor is provided, collect all data keys
	if (!extractor) {
		extractor = Object.keys(data);
	}

	// If array, use as a whitelist and extract all with default no-op strategy
	if (Array.isArray(extractor)) {
		extractor = extractor.reduce((m, k) => ({ ...m, [k]: _noTransform }), {});
	}

	let _counter = 1;
	return Object.entries(extractor).reduce(
		(m, [k, extract]) => {
			// Skip undefined values and explicitly excluded keys
			if (data[k] === undefined || extract === false) return m;

			// Explicit true is a special case for no transformation
			if (extract === true) extract = _noTransform;

			// At this point, we expect a transformer function
			if (typeof extract !== 'function') {
				throw new TypeError(`Unexpected transformer value '${extract}'`);
			}

			// Save transformer for later reuse
			m._extractor[k] = extract;

			const value = extract(data[k]);

			// Skip undefined values returned by transformer
			if (value !== undefined) {
				// SQL standard style quoted identifier (escape quotes by doubling them)
				const key = `"${k.replace(/"/g, '""')}"`;
				const placeholder = `$${_counter++}`;

				m.keys.push(key);
				m.placeholders.push(placeholder);
				m.values.push(value);
				m.pairs.push(`${key} = ${placeholder}`);
				m.map[`$${k}`] = value;

				// Track next available placeholder number for potential later use
				m._next = _counter;
			}

			return m;
		},
		{
			keys: [],
			placeholders: [],
			values: [],
			pairs: [],
			map: {},
			_next: _counter,
			_extractor: {},
		} as any
	);
};
