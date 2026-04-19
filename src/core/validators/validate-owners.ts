import type { Owner } from "../models";

export function validateOwners(owners: Owner[]): string[] {
	const errors: string[] = [];
	const seenIds = new Set<string>();

	for (const owner of owners) {
		if (!owner.name || owner.name.trim() === "") {
			errors.push(`Owner with id "${owner.id}" has an empty name.`);
		}

		if (seenIds.has(owner.id)) {
			errors.push(`Duplicate owner ID found: "${owner.id}".`);
		} else {
			seenIds.add(owner.id);
		}
	}

	return errors;
}
