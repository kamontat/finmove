import { defineConfig } from "../kernel";
import type { ConfigDefinition } from "../types";
import { readTripConfig, readTripConfigVersion, writeTripConfig } from "./io";
import { tripV0ToV1 } from "./migrations/v0_to_v1";
import { tripV0Schema } from "./schemas/v0";
import { tripV1Schema } from "./schemas/v1";

// Schemas are typed as z.ZodTypeAny (necessary for isolatedDeclarations + zod 4
// + exactOptionalPropertyTypes interaction), so z.infer<schema> resolves to
// `unknown` and migration signatures don't match their concrete types. The
// `as never` cast on `schemas` is the same pattern used in kernel tests.
export const tripConfig: ConfigDefinition<"trip", never, 1> = defineConfig({
	name: "trip",
	latestVersion: 1,
	schemas: {
		0: { schema: tripV0Schema, migrations: { 1: tripV0ToV1 } },
		1: { schema: tripV1Schema },
	} as never,
	readConfig: readTripConfig,
	writeConfig: writeTripConfig,
	parseVersion: readTripConfigVersion,
});
