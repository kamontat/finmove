export interface AppArgs {
	dataDir: string;
	trip?: string;
	page?: string;
}

export function parseArgs(argv: string[]): AppArgs {
	const result: AppArgs = {
		dataDir: "./data",
	};

	for (let i = 0; i < argv.length; i++) {
		switch (argv[i]) {
			case "--data-dir": {
				const val = argv[++i];
				if (val !== undefined) result.dataDir = val;
				break;
			}
			case "--trip": {
				const val = argv[++i];
				if (val !== undefined) result.trip = val;
				break;
			}
			case "--page": {
				const val = argv[++i];
				if (val !== undefined) result.page = val;
				break;
			}
		}
	}

	return result;
}
