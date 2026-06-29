import { LinkIncludingShortenedCollectionAndTags } from "@linkwarden/types/global";

/**
 * Optimistic (just-added) links carry a temporary negative id and only exist
 * in the local cache until the create mutation resolves. While one is present
 * we must avoid full-list refetches, which would replace the cache with a server snapshot
 * that doesn't include it yet, making it flash out and back in.
 */
export const hasOptimisticLink = (
  links: LinkIncludingShortenedCollectionAndTags[]
) => links.some((e) => typeof e.id === "number" && e.id < 0);
