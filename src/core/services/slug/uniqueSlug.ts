import { toSlug } from "./toSlug";

export function uniqueSlug(name: string, takenIds: Iterable<string>): string {
	const taken = new Set(takenIds);
	const base = toSlug(name);
	if (!taken.has(base)) return base;
	let i = 2;
	while (taken.has(`${base}-${i}`)) i++;
	return `${base}-${i}`;
}
