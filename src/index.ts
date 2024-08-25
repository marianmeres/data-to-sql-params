//
export const dataToSqlParams = (
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
} => {
	const _noTransform = (v: any) => v;

	// if no extractor, just collect all data keys
	if (!extractor) {
		extractor = Object.keys(data);
	}

	// if array, use as a whitelist and extract all with default noop strategy
	if (Array.isArray(extractor)) {
		extractor = extractor.reduce((m, k) => ({ ...m, [k]: _noTransform }), {});
	}

	let _counter = 1;
	return Object.entries(extractor).reduce(
		(m, [k, extract]) => {
			if (data[k] === undefined) return m;

			// explicit true is a special case no transform signal
			if (extract === true) extract = (v: any) => v;

			// save for later reuse
			m._extractor[k] = extract;

			const value = extract(data[k]);

			// skip undefined-s
			if (value !== undefined) {
				// SQL standard style quote identifier
				const key = `"${k}"`;
				const placeholder = `$${_counter++}`;

				m.keys.push(key);
				m.placeholders.push(placeholder);
				m.values.push(value);
				m.pairs.push(`${key}=${placeholder}`);
				m.map[`$${k}`] = value;

				// somewhat special case info for potential later consumption
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
