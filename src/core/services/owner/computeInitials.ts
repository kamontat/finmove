export function computeInitials(names: string[]): Record<string, string> {
	const result: Record<string, string> = {};
	const maxLen = names.reduce((m, n) => Math.max(m, n.length), 0);
	for (let i = 0; i < names.length; i++) {
		// biome-ignore lint/style/noNonNullAssertion: i is loop-bounded; also needed for j !== i collision check
		const name = names[i]!;
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
