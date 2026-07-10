import { createMMKV } from "react-native-mmkv";
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";

const storage = createMMKV({ id: "react-query" });

const CACHE_KEY = "REACT_QUERY_CACHE";

let persistenceBroken = false;

const shrinkStorage = () => {
  try {
    storage.trim();
  } catch {}
};

const infiniteQueryKeys = new Set(["links", "publicLinks", "tags"]);

const isInfiniteQueryKey = (queryKey: unknown) =>
  Array.isArray(queryKey) &&
  typeof queryKey[0] === "string" &&
  infiniteQueryKeys.has(queryKey[0]);

const hasInfiniteDataShape = (data: unknown) =>
  data == null ||
  (typeof data === "object" &&
    Array.isArray((data as any).pages) &&
    Array.isArray((data as any).pageParams));

export const sanitizePersistedClient = (
  client: PersistedClient
): PersistedClient => {
  const queries = client.clientState?.queries;
  if (!Array.isArray(queries)) return client;

  const sanitizedQueries = queries.filter((query) => {
    if (!isInfiniteQueryKey(query.queryKey)) return true;
    return hasInfiniteDataShape(query.state?.data);
  });

  if (sanitizedQueries.length === queries.length) return client;

  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: sanitizedQueries,
    },
  };
};

export const mmkvPersister: Persister = {
  persistClient: async (client) => {
    if (persistenceBroken) return;

    let json: string;
    try {
      json = JSON.stringify(client);
    } catch (e) {
      console.error("Error persisting client:", e);
      return;
    }

    try {
      storage.set(CACHE_KEY, json);
    } catch {
      try {
        storage.clearAll();
        storage.trim();
        storage.set(CACHE_KEY, json);
      } catch (e) {
        persistenceBroken = true;
        console.error(
          `Error persisting client (payload ${json.length} chars):`,
          e
        );
      }
    }
  },
  restoreClient: async () => {
    try {
      const json = storage.getString(CACHE_KEY);
      return json ? sanitizePersistedClient(JSON.parse(json)) : undefined;
    } catch (e) {
      console.error("Error restoring client:", e);
      return undefined;
    } finally {
      shrinkStorage();
    }
  },
  removeClient: async () => {
    try {
      storage.remove(CACHE_KEY);
      shrinkStorage();
    } catch (e) {
      console.error("Error removing client:", e);
    }
  },
};
