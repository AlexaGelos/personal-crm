// Runs once before all tests: creates the test database if it is missing and brings
// it up to date with the migrations from ./drizzle
import { switchToTestDatabase } from "./database-name";
import { prepareTestDatabase } from "./prepare-database";

export default async function setup() {
  const testName = switchToTestDatabase();
  try {
    await prepareTestDatabase(testName);
  } catch (error) {
    // Vitest fails while printing an error thrown from here and hides its text: print it first
    console.error(error instanceof Error ? error.message : error);
    throw error;
  }
}
