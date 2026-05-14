export function computeInitials(names: string[]): Record<string, string> {
	const result: Record<string, string> = {};
	for (let i = 0; i < names.length; i++) {
		// biome-ignore lint/style/noNonNullAssertion: loop bounds guarantee i < names.length
		const name = names[i]!;
		const maxLen = Math.max(name.length, ...names.map((n) => n.length));
		let chosen = name;
		for (let k = 1; k <= maxLen; k++) {
			const prefix = name.slice(0, k);
			const collides = names.some(
				(other, j) => j !== i && other.slice(0, k) === prefix,
			);
			if (!collides) {
				chosen = prefix;
				break;
			}
		}
		result[name] = chosen;
	}
	return result;
}
