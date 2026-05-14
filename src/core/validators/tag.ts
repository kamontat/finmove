import type { Tag } from "../models";

export function validateTag(
	value: string,
	existing: Tag[],
	originalValue?: string,
): string[] {
	const errors: string[] = [];
	const trimmed = value.trim();
	if (!trimmed) {
		errors.push("Tag is required");
		return errors;
	}
	const collision = existing.some(
		(t) => t.value === trimmed && t.value !== originalValue,
	);
	if (collision) errors.push(`Tag "${trimmed}" already exists`);
	return errors;
}
