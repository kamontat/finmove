export function daysBetween(startDate: string, endDate: string): number {
	const start = new Date(`${startDate}T00:00:00`).getTime();
	const end = new Date(`${endDate}T00:00:00`).getTime();
	return Math.round((end - start) / (24 * 60 * 60 * 1000));
}
