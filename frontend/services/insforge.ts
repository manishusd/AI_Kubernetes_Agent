import { createClient } from "@insforge/sdk";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

let cachedClient: ReturnType<typeof createClient> | null = null;

export const missingInsforgeEnv = !baseUrl || !anonKey;

export function getInsforgeClient() {
  if (missingInsforgeEnv) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient({
      baseUrl,
      anonKey,
    });
  }

  return cachedClient;
}
