const { selectWeightedEntry } = require('./weightedSelector');

// Each pass reads the last successful decisions and publishes a fresh set. Decisions
// that no longer occur (e.g. a talent slot lost with level) disappear on that pass.
class GenerationDraft {
	constructor(previous, edit) {
		this.previous = previous?.records ?? new Map();
		this.records = new Map();
		this.edit = edit;
		if (edit) {
			const control = previous?.records.get(edit.key);
			if (!control?.label || (edit.value !== undefined &&
				!previous.options(edit.key).some(option => option.id === edit.value))) {
				throw new Error('INVALID_GENERATION_CHOICE');
			}
		}
	}

	draw(key, draw, { signature = '', options, label, group, initial, catalogDefault } = {}) {
		const old = this.previous.get(key);
		const edited = this.edit?.key === key;
		const downstream = this.edit && key.startsWith(this.edit.key + '.');
		const reset = edited || (downstream && old?.mode !== 'fixed' && !/\.(category|route\d+|presence|source)$/.test(key));
		// Carried loot uses the original bounded rejection sampler for the initial roll.
		const reserve = group && (this.previous.size || !group.startsWith('loot:'));
		const eligible = reserve ? this.available(key, options, group) : options;
		let value;
		if (edited && this.edit.value !== undefined) {
			value = this.edit.value;
		} else if (!reset && old && old.signature === signature &&
			(!eligible || eligible.some(item => item.id === old.value))) {
			value = old.value;
		} else {
			if (!reset && catalogDefault !== undefined) value = catalogDefault;
			else value = !this.previous.size && initial !== undefined ? initial : draw(eligible);
		}
		let mode;
		if (edited) mode = this.edit.value === undefined ? 'random' : 'fixed';
		else if (!reset && old?.signature === signature && old.value === value) mode = old.mode;
		this.records.set(key, { value, signature, options, label, group, mode });
		return value;
	}

	// Reuse the same allocation rolls as the budget/profile changes. Extending
	// the tape on a new pass must never mutate the last validated preview.
	randomStream(key, random) {
		const tape = [...this.draw(key, () => [], { label: key })];
		this.records.get(key).value = tape;
		let i = 0;
		return () => {
			if (i === tape.length) tape.push(random());
			return tape[i++];
		};
	}

	// When the rules remove a slot, keep user-selected entries ahead of
	// untouched rolls. Move the entry together with its nested decisions.
	retainSlots(path, count) {
		const prefix = path + '.';
		const slots = new Map();
		for (const [key, record] of this.previous) {
			if (!key.startsWith(prefix)) continue;
			const [index, ...rest] = key.slice(prefix.length).split('.');
			if (!/^\d+$/.test(index)) continue;
			const slot = Number(index);
			if (!slots.has(slot)) slots.set(slot, []);
			slots.get(slot).push({ key, rest, record });
		}
		const overflow = [...slots.keys()].filter(index => index >= count);
		if (!overflow.length) return;
		const chosen = entries => entries.some(({ record }) => record.mode === 'fixed');
		const replaceable = [...slots.keys()].filter(i => i < count && !chosen(slots.get(i))).sort((a, b) => a - b);
		this.previous = new Map(this.previous);
		for (const index of overflow) {
			const entries = slots.get(index);
			for (const { key } of entries) this.previous.delete(key);
			if (!chosen(entries) || !replaceable.length) continue;
			const destination = replaceable.pop();
			for (const { key } of slots.get(destination)) this.previous.delete(key);
			for (const { rest, record } of entries)
				this.previous.set([path, destination, ...rest].join('.'), record);
		}
	}

	available(key, options, group) {
		const used = new Set();
		for (const [other, record] of new Map([...this.previous, ...this.records])) {
			if (other !== key && record.group === group) used.add(record.value);
		}
		return options.filter(option => !used.has(option.id));
	}

	options(key) {
		const record = this.records.get(key);
		if (!record?.options) return [];
		const options = record.group ? this.available(key, record.options, record.group) : record.options;
		return options.map(({ id, name }) => ({ id, name }));
	}

	controls() {
		return [...this.records].filter(([, record]) => record.label).map(([key, record]) => ({
			key, label: record.label, selectable: Boolean(record.options),
			current: record.options?.find(entry => entry.id === record.value)?.name,
		}));
	}
}

function pickEntry(draft, key, generator, entries, random, group, initial) {
	if (!draft) return selectWeightedEntry(entries, random);
	const id = draft.draw(key, eligible => selectWeightedEntry(eligible, random).id, {
		signature: generator.id, label: generator.name, options: entries, group, initial,
	});
	return entries.find(entry => entry.id === id);
}

function roll(draft, key, draw, settings) {
	return draft ? draft.draw(key, draw, settings) : draw();
}

function rollLevel(draft, level, draw) {
	if (!draft) return level ?? draw();
	return Number(draft.draw('level', () => String(draw()), {
		label: 'level', options: Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), name: String(i + 1) })),
		...(level !== undefined ? { initial: String(level) } : {}),
	}));
}

function optionalRoll(draft, path, draw, label = 'presence') {
	if (!draft) return draw();
	return draft.draw(path + '.presence', () => draw() ? 'yes' : 'no', {
		label, options: [{ id: 'yes', name: 'include' }, { id: 'no', name: 'none' }],
	}) === 'yes';
}

// An authored slot starts with its catalog entry. A different slot definition restores
// its own default. Fixed RULE bindings and references embedded in prose stay authoritative.
function customizeReference(draft, method, reference, locale, { path, random }) {
	if (typeof reference !== 'string' || !/^root\.generation\.(traits|talents|armor|equipment|inventory|statusEffects|modifiers)(\.|$)/.test(path)) {
		return reference;
	}
	const template = method === 'resolveInlineString';
	const match = template ? /^\{\{\s*([\w]+):([\w]+)\s*\}\}$/.exec(reference) : /^([\w]+):([\w]+)$/.exec(reference);
	if (!match) return reference;
	const [, generatorId, initial] = match;
	const generator = require('./generatorCatalog').getGenerator(generatorId, locale);
	const id = draft.draw(path, eligible => selectWeightedEntry(eligible, random).id, {
		signature: reference, options: generator.entries, label: generator.name, catalogDefault: initial,
	});
	return template ? `{{ ${generatorId}:${id} }}` : `${generatorId}:${id}`;
}

function withDraft(resolver, draft) {
	if (!draft) return resolver;
	return Object.fromEntries(['generate', 'resolveReference', 'resolveInlineString', 'resolveInlineReference']
		.map(method => [method, (reference, locale, options = {}) => {
			const selected = customizeReference(draft, method, reference, locale, options);
			return resolver[method](selected, locale, { ...options, draft });
		}]));
}

module.exports = { GenerationDraft, pickEntry, roll, rollLevel, optionalRoll, withDraft };
