import { config } from "dotenv";

/**
 * Loads the local environment before the database client is imported.
 * Imported for its side effect, first, by mcp/stdio.ts.
 */
config({ path: [".env.local", ".env"], quiet: true });
