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
      case "--data-dir":
        result.dataDir = argv[++i];
        break;
      case "--trip":
        result.trip = argv[++i];
        break;
      case "--page":
        result.page = argv[++i];
        break;
    }
  }

  return result;
}
