import { MediaDetail, MediaType } from "@/types/media";
import { getMovieDetails, getTVDetails } from "@/lib/tmdb";
import { getAnimeDetails } from "@/lib/anilist";

interface CacheEntry {
  data: MediaDetail | null;
  expiresAt: number;
}

// In-memory 10-minute session cache for media details
const mediaCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<MediaDetail | null>>();
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Unified metadata resolver that strictly routes requests to the correct upstream API:
 * - "anime" → AniList GraphQL (returns idMal for VidLink mapping)
 * - "tv"    → TMDB /tv/{id}
 * - "movie" → TMDB /movie/{id}
 *
 * IMPORTANT: Fallback logic ONLY falls within the same media type's API.
 * We NEVER cross-query TMDB Movie/TV with AniList IDs, or vice versa,
 * because their ID namespaces overlap and would silently return wrong content.
 *
 * Includes request deduplication and in-memory caching.
 */
export async function getMediaDetails(
  rawId: string | number,
  rawType: MediaType = "movie"
): Promise<MediaDetail | null> {
  const cleanId = String(rawId).replace("anime-", "").trim();
  if (!cleanId) return null;

  const normalizedType: MediaType =
    rawType === "anime" ? "anime" : rawType === "tv" ? "tv" : "movie";
  const cacheKey = `${normalizedType}:${cleanId}`;
  const now = Date.now();

  // 1. Check in-memory cache
  const cached = mediaCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // 2. Return active in-flight promise if duplicate request is already pending
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  // 3. Execute new fetch with dedicated routing
  const fetchPromise = (async (): Promise<MediaDetail | null> => {
    try {
      let result: MediaDetail | null = null;

      if (normalizedType === "anime") {
        // Dedicated Anime Route → AniList GraphQL (returns idMal for MAL mapping)
        result = await getAnimeDetails(cleanId);
        // NOTE: No TMDB fallback for anime — IDs are different namespaces.
        // If AniList returns null, the content genuinely isn't found.
      } else if (normalizedType === "tv") {
        // Dedicated TV Series Route → TMDB /tv/{id}
        result = await getTVDetails(cleanId);
        // No cross-namespace fallback: we don't fall back to Movie or Anime
        // because TV IDs, Movie IDs, and AniList IDs overlap.
      } else {
        // Dedicated Movie Route → TMDB /movie/{id}
        result = await getMovieDetails(cleanId);
        // No cross-namespace fallback: a failed Movie fetch stays null.
        // Cross-querying TMDB /tv/ with a Movie ID would return random wrong content.
      }

      // Store in session cache
      mediaCache.set(cacheKey, {
        data: result,
        expiresAt: now + CACHE_TTL_MS,
      });

      return result;
    } catch (err) {
      console.error(`[mediaService] Error fetching details for ${cacheKey}:`, err);
      return null;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}
