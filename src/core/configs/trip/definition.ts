import type { z } from "zod";
import { defineConfig } from "../kernel";
import type { ConfigDefinition } from "../types";
import { readTripConfig, readTripConfigVersion, writeTripConfig } from "./io";
import { tripV0ToV1 } from "./migrations/v0_to_v1";
import { tripV0Schema } from "./schemas/v0";
import type { TripV1 } from "./schemas/v1";
import { tripV1Schema } from "./schemas/v1";

// The schemas use z.ZodTypeAny annotations (necessary to satisfy
// isolatedDeclarations without forcing exactOptionalPropertyTypes onto every
// optional zod field), so the migration map and saveConfig's `data` parameter
// can't both be inferred precisely. Explicit type carries enough information
// downstream (loadConfig data is TripV1, saveConfig accepts TripV1).
type TripSchemas = {
	0: z.ZodTypeAny;
	1: z.ZodType<TripV1>;
};

export const tripConfig: ConfigDefinition<"trip", TripSchemas, 1> =
	defineConfig({
		name: "trip",
		latestVersion: 1,
		schemas: {
			0: { schema: tripV0Schema, migrations: { 1: tripV0ToV1 } },
			1: { schema: tripV1Schema },
		},
		readConfig: readTripConfig,
		writeConfig: writeTripConfig,
		parseVersion: readTripConfigVersion,
	} as ConfigDefinition<"trip", TripSchemas, 1>);
