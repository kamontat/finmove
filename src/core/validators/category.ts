import type { Category } from "../models";

export function validateCategory(
	value: string,
	existing: Category[],
	originalValue?: string,
): string[] {
	const errors: string[] = [];
	const trimmed = value.trim();
	if (!trimmed) {
		errors.push("Category is required");
		return errors;
	}
	const collision = existing.some(
		(c) => c.value === trimmed && c.value !== originalValue,
	);
	if (collision) errors.push(`Category "${trimmed}" already exists`);
	return errors;
}
