import { ZVENT_MONTHS } from "../../constants";

export function buildZventTag(
	id: string,
	name: string,
	endDate: string,
): string {
	const date = new Date(endDate);
	const month = ZVENT_MONTHS[date.getUTCMonth()];
	const year = date.getUTCFullYear();
	return `Zvent: ${id} ${name} (${month} ${year})`;
}
