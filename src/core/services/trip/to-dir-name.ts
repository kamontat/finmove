export function toDirName(tripName: string, startDate: string): string {
	const year = startDate.slice(0, 4);
	const slug = tripName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	return `${slug}-${year}`;
}
