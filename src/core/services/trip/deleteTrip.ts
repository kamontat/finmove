import { rmSync } from "node:fs";

export function deleteTrip(tripPath: string): void {
	rmSync(tripPath, { recursive: true, force: true });
}
