import { CastMember, GenreItem, MediaDetail, MediaItem, VideoItem } from "@/types/media";

const ANILIST_URL = process.env.NEXT_PUBLIC_ANILIST_URL || "https://graphql.anilist.co";

export const ANIME_GENRES: GenreItem[] = [
  { id: "Action", name: "Action" },
  { id: "Adventure", name: "Adventure" },
  { id: "Comedy", name: "Comedy" },
  { id: "Drama", name: "Drama" },
  { id: "Fantasy", name: "Fantasy" },
  { id: "Horror", name: "Horror" },
  { id: "Mecha", name: "Mecha" },
  { id: "Music", name: "Music" },
  { id: "Mystery", name: "Mystery" },
  { id: "Psychological", name: "Psychological" },
  { id: "Romance", name: "Romance" },
  { id: "Sci-Fi", name: "Sci-Fi" },
  { id: "Slice of Life", name: "Slice of Life" },
  { id: "Sports", name: "Sports" },
  { id: "Supernatural", name: "Supernatural" },
  { id: "Thriller", name: "Thriller" },
];

function cleanHtml(str?: string | null): string {
  if (!str) return "No synopsis available.";
  return str.replace(/<[^>]*>?/gm, "").replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
}

const anilistClientCache = new Map<string, { data: any; expiresAt: number }>();
const anilistInFlight = new Map<string, Promise<any>>();
const ANILIST_CACHE_TTL = 10 * 60 * 1000; // 10 mins
let anilistDownUntil = 0;

async function fetchAniList<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const now = Date.now();
  if (now < anilistDownUntil) {
    return null as unknown as T;
  }

  const cacheKey = JSON.stringify({ query, variables });

  const cached = anilistClientCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  if (anilistInFlight.has(cacheKey)) {
    return anilistInFlight.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch(ANILIST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 StreamFreak/1.0",
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(2000),
        next: { revalidate: 3600 },
      });

      if (!res.ok) {
        if (res.status === 403 || res.status >= 500) {
          anilistDownUntil = Date.now() + 5 * 60 * 1000; // 5 min circuit breaker
        }
        throw new Error(`AniList error ${res.status}: ${res.statusText}`);
      }

      const json = await res.json().catch(() => ({ data: null }));
      if (json && json.errors && !json.data) {
        throw new Error(`AniList GraphQL errors: ${JSON.stringify(json.errors)}`);
      }

      const responseData = json?.data || null;
      if (responseData) {
        anilistClientCache.set(cacheKey, { data: responseData, expiresAt: now + ANILIST_CACHE_TTL });
      }
      return responseData as T;
    } catch (err: any) {
      console.warn(`[AniList Fetcher] Handled error: ${err?.message || err}`);
      return null as unknown as T;
    } finally {
      anilistInFlight.delete(cacheKey);
    }
  })();

  anilistInFlight.set(cacheKey, promise);
  return promise;
}

const KITSU_BASE = "https://kitsu.io/api/edge";
const kitsuClientCache = new Map<string, { data: any; expiresAt: number }>();
const kitsuInFlight = new Map<string, Promise<any>>();
const KITSU_CACHE_TTL = 10 * 60 * 1000;

async function fetchKitsu(path: string): Promise<any> {
  const url = path.startsWith("http") ? path : `${KITSU_BASE}${path}`;
  const now = Date.now();

  const cached = kitsuClientCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  if (kitsuInFlight.has(url)) {
    return kitsuInFlight.get(url)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 StreamFreak/1.0",
        },
        signal: AbortSignal.timeout(12000),
        next: { revalidate: 3600 },
      });

      if (!res.ok) return null;
      const json = await res.json();
      kitsuClientCache.set(url, { data: json, expiresAt: now + KITSU_CACHE_TTL });
      return json;
    } catch (err: any) {
      console.warn(`[Kitsu Fetcher] Handled error: ${err?.message || err}`);
      return null;
    } finally {
      kitsuInFlight.delete(url);
    }
  })();

  kitsuInFlight.set(url, promise);
  return promise;
}

function normalizeKitsuItem(item: any, included: any[] = []): MediaItem {
  const mapData = item.relationships?.mappings?.data || [];
  const mapIds = new Set(mapData.map((m: any) => m.id));

  const malMapping = (included || []).find(
    (inc: any) => mapIds.has(inc.id) && inc.attributes?.externalSite === "myanimelist/anime"
  );
  const anilistMapping = (included || []).find(
    (inc: any) => mapIds.has(inc.id) && inc.attributes?.externalSite === "anilist/anime"
  );

  const malId = malMapping?.attributes?.externalId
    ? Number(malMapping.attributes.externalId)
    : undefined;
  const anilistId = anilistMapping?.attributes?.externalId
    ? Number(anilistMapping.attributes.externalId)
    : Number(item.id);

  const attr = item.attributes || {};
  const title = attr.canonicalTitle || attr.titles?.en || attr.titles?.en_jp || "Anime";
  const originalTitle = attr.titles?.ja_jp || attr.titles?.en_jp || title;
  const posterPath =
    attr.posterImage?.large ||
    attr.posterImage?.original ||
    attr.posterImage?.medium ||
    attr.posterImage?.small ||
    null;
  const backdropPath =
    attr.coverImage?.large ||
    attr.coverImage?.original ||
    attr.coverImage?.small ||
    posterPath;
  const voteAverage = attr.averageRating
    ? Math.round((Number(attr.averageRating) / 10) * 10) / 10
    : 0;

  const catData = item.relationships?.categories?.data || [];
  const catIds = new Set(catData.map((c: any) => c.id));
  const genres = (included || [])
    .filter((inc: any) => catIds.has(inc.id) && inc.type === "categories")
    .map((inc: any) => inc.attributes?.title)
    .filter(Boolean);

  return {
    id: `anime-${anilistId}`,
    anilistId,
    malId,
    title,
    originalTitle,
    overview: cleanHtml(attr.synopsis || attr.description || ""),
    posterPath,
    backdropPath,
    mediaType: "anime",
    releaseDate: attr.startDate ? String(attr.startDate).substring(0, 4) : undefined,
    voteAverage,
    popularity: attr.userCount || 0,
    genres,
    totalEpisodes: attr.episodeCount || undefined,
    status:
      attr.status === "finished"
        ? "FINISHED"
        : attr.status === "current"
        ? "RELEASING"
        : attr.status,
    bannerImage: backdropPath,
  };
}

async function fetchKitsuDetails(numericId: string | number): Promise<MediaDetail | null> {
  const cleanId = String(numericId).replace("anime-", "").trim();
  if (!cleanId) return null;

  let item: any = null;
  let included: any[] = [];

  // 1. Try finding via AniList ID mapping
  const aniMapJson = await fetchKitsu(
    `/mappings?filter[external_site]=anilist/anime&filter[external_id]=${cleanId}&include=item`
  );
  if (aniMapJson?.included?.length) {
    item = aniMapJson.included.find((inc: any) => inc.type === "anime");
  }

  // 2. Try finding via MAL ID mapping
  if (!item) {
    const malMapJson = await fetchKitsu(
      `/mappings?filter[external_site]=myanimelist/anime&filter[external_id]=${cleanId}&include=item`
    );
    if (malMapJson?.included?.length) {
      item = malMapJson.included.find((inc: any) => inc.type === "anime");
    }
  }

  // 3. Try finding directly by Kitsu ID
  if (!item) {
    const directJson = await fetchKitsu(`/anime/${cleanId}`);
    if (directJson?.data) {
      item = directJson.data;
    }
  }

  if (!item) return null;

  // Retrieve item's full mappings and categories
  const fullMapJson = await fetchKitsu(`/anime/${item.id}?include=mappings,categories`);
  if (fullMapJson?.included) {
    included = fullMapJson.included;
  }

  const base = normalizeKitsuItem(item, included);
  const attr = item.attributes || {};

  const videos: VideoItem[] = [];
  let trailerUrl: string | undefined;
  if (attr.youtubeVideoId) {
    videos.push({
      id: attr.youtubeVideoId,
      key: attr.youtubeVideoId,
      name: "Official Trailer",
      site: "YouTube",
      type: "Trailer",
      official: true,
    });
    trailerUrl = `https://www.youtube.com/watch?v=${attr.youtubeVideoId}`;
  }

  const genresList: GenreItem[] = (included || [])
    .filter((inc: any) => inc.type === "categories")
    .map((c: any) => ({
      id: c.attributes?.title || c.id,
      name: c.attributes?.title || c.id,
    }));

  return {
    ...base,
    runtime: attr.episodeLength || undefined,
    genresList:
      genresList.length > 0 ? genresList : (base.genres || []).map((g) => ({ id: g, name: g })),
    cast: [],
    videos,
    trailerUrl,
    recommendations: [],
    studios: [],
    nativeTitle: attr.titles?.ja_jp,
    format: attr.subtype ? attr.subtype.toUpperCase() : "TV",
    seasonYear: attr.startDate ? parseInt(attr.startDate.substring(0, 4), 10) : undefined,
    episodesCount: attr.episodeCount || 1,
  };
}

export function normalizeAniListItem(media: any): MediaItem {
  const title = media.title?.english || media.title?.romaji || media.title?.native || "Untitled Anime";
  const originalTitle = media.title?.native || media.title?.romaji;
  const posterPath = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || null;
  const backdropPath = media.bannerImage || posterPath;
  const voteAverage = media.averageScore ? Math.round((media.averageScore / 10) * 10) / 10 : 0;

  return {
    id: `anime-${media.id}`,
    anilistId: media.id,
    malId: media.idMal || undefined,
    title,
    originalTitle,
    overview: cleanHtml(media.description),
    posterPath,
    backdropPath,
    mediaType: "anime",
    releaseDate: media.seasonYear ? String(media.seasonYear) : undefined,
    voteAverage,
    popularity: media.popularity,
    genres: media.genres || [],
    totalEpisodes: media.episodes,
    status: media.status,
    bannerImage: media.bannerImage,
  };
}

const MEDIA_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
  }
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  description
  averageScore
  meanScore
  popularity
  episodes
  status
  seasonYear
  genres
  format
`;

export async function getTrendingAnime(page = 1, perPage = 20): Promise<MediaItem[]> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  try {
    const data = await fetchAniList<{ Page: { media: any[] } }>(query, { page, perPage });
    if (data?.Page?.media && data.Page.media.length > 0) {
      return data.Page.media.map(normalizeAniListItem);
    }
  } catch {}

  // Resilient fallback to Kitsu
  const offset = (page - 1) * perPage;
  const json = await fetchKitsu(
    `/anime?sort=popularityRank&page[limit]=${perPage}&page[offset]=${offset}&include=mappings`
  );
  if (json?.data?.length) {
    return json.data.map((item: any) => normalizeKitsuItem(item, json.included));
  }
  return [];
}

export async function getPopularAnime(page = 1, perPage = 20): Promise<MediaItem[]> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  try {
    const data = await fetchAniList<{ Page: { media: any[] } }>(query, { page, perPage });
    if (data?.Page?.media && data.Page.media.length > 0) {
      return data.Page.media.map(normalizeAniListItem);
    }
  } catch {}

  // Resilient fallback to Kitsu
  const offset = (page - 1) * perPage;
  const json = await fetchKitsu(
    `/anime?sort=-userCount&page[limit]=${perPage}&page[offset]=${offset}&include=mappings`
  );
  if (json?.data?.length) {
    return json.data.map((item: any) => normalizeKitsuItem(item, json.included));
  }
  return [];
}

export async function getTopRatedAnime(page = 1, perPage = 20): Promise<MediaItem[]> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: SCORE_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  try {
    const data = await fetchAniList<{ Page: { media: any[] } }>(query, { page, perPage });
    if (data?.Page?.media && data.Page.media.length > 0) {
      return data.Page.media.map(normalizeAniListItem);
    }
  } catch {}

  // Resilient fallback to Kitsu
  const offset = (page - 1) * perPage;
  const json = await fetchKitsu(
    `/anime?sort=-averageRating&page[limit]=${perPage}&page[offset]=${offset}&include=mappings`
  );
  if (json?.data?.length) {
    return json.data.map((item: any) => normalizeKitsuItem(item, json.included));
  }
  return [];
}

export async function searchAnime(search: string, page = 1, perPage = 20): Promise<MediaItem[]> {
  if (!search.trim()) return [];
  const query = `
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(search: $search, type: ANIME, isAdult: false, sort: POPULARITY_DESC) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  try {
    const data = await fetchAniList<{ Page: { media: any[] } }>(query, { search, page, perPage });
    if (data?.Page?.media && data.Page.media.length > 0) {
      return data.Page.media.map(normalizeAniListItem);
    }
  } catch {}

  // Resilient fallback to Kitsu
  const offset = (page - 1) * perPage;
  const json = await fetchKitsu(
    `/anime?filter[text]=${encodeURIComponent(search)}&page[limit]=${perPage}&page[offset]=${offset}&include=mappings`
  );
  if (json?.data?.length) {
    return json.data.map((item: any) => normalizeKitsuItem(item, json.included));
  }
  return [];
}

export async function discoverAnime(params: {
  genre?: string;
  sortBy?: string;
  year?: number | string;
  page?: number;
  perPage?: number;
}): Promise<{ items: MediaItem[]; totalPages: number }> {
  let sortOption = "POPULARITY_DESC";
  if (params.sortBy === "vote_average.desc") sortOption = "SCORE_DESC";
  if (params.sortBy === "trending") sortOption = "TRENDING_DESC";
  if (params.sortBy === "release_date.desc") sortOption = "START_DATE_DESC";

  const query = `
    query ($page: Int, $perPage: Int, $genre: String, $sort: [MediaSort], $seasonYear: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          lastPage
        }
        media(genre: $genre, sort: $sort, seasonYear: $seasonYear, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  try {
    const variables: any = {
      page: params.page || 1,
      perPage: params.perPage || 20,
      sort: [sortOption],
    };
    if (params.genre && params.genre !== "All") variables.genre = params.genre;
    if (params.year) variables.seasonYear = Number(params.year);

    const data = await fetchAniList<{ Page: { pageInfo: { lastPage: number }; media: any[] } }>(
      query,
      variables
    );
    if (data?.Page?.media && data.Page.media.length > 0) {
      return {
        items: data.Page.media.map(normalizeAniListItem),
        totalPages: data?.Page?.pageInfo?.lastPage || 1,
      };
    }
  } catch {}

  // Resilient fallback to Kitsu
  const page = params.page || 1;
  const perPage = params.perPage || 20;
  const offset = (page - 1) * perPage;
  let sort = "-userCount";
  if (params.sortBy === "vote_average.desc") sort = "-averageRating";
  if (params.sortBy === "trending") sort = "popularityRank";
  if (params.sortBy === "release_date.desc") sort = "-startDate";

  let path = `/anime?sort=${sort}&page[limit]=${perPage}&page[offset]=${offset}&include=mappings`;
  if (params.genre && params.genre !== "All") {
    const cat = encodeURIComponent(params.genre.toLowerCase().replace(/\s+/g, "-"));
    path += `&filter[categories]=${cat}`;
  }
  if (params.year) {
    path += `&filter[seasonYear]=${params.year}`;
  }

  const json = await fetchKitsu(path);
  if (json?.data?.length) {
    const total = json.meta?.count || 100;
    return {
      items: json.data.map((item: any) => normalizeKitsuItem(item, json.included)),
      totalPages: Math.ceil(total / perPage),
    };
  }
  return { items: [], totalPages: 1 };
}

export async function getAnimeDetails(id: number | string): Promise<MediaDetail | null> {
  const numericId = typeof id === "string" ? id.replace("anime-", "") : id;
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_FIELDS}
        duration
        season
        seasonYear
        nextAiringEpisode {
          episode
          airingAt
        }
        trailer {
          id
          site
          thumbnail
        }
        characters(sort: ROLE, perPage: 12) {
          edges {
            role
            node {
              id
              name {
                full
                native
              }
              image {
                large
                medium
              }
            }
          }
        }
        studios(isMain: true) {
          nodes {
            id
            name
          }
        }
        recommendations(perPage: 12, sort: RATING_DESC) {
          nodes {
            mediaRecommendation {
              ${MEDIA_FIELDS}
            }
          }
        }
      }
    }
  `;

  try {
    let media: any = null;
    try {
      const data = await fetchAniList<{ Media: any }>(query, { id: Number(numericId) });
      media = data?.Media;
    } catch {
      media = null;
    }

    if (media) {
      const base = normalizeAniListItem(media);

      const cast: CastMember[] = (media.characters?.edges || []).map((edge: any) => ({
        id: edge.node?.id,
        name: edge.node?.name?.full || edge.node?.name?.native || "Character",
        character: edge.role || "Character",
        profilePath: edge.node?.image?.large || edge.node?.image?.medium || null,
        role: edge.role,
      }));

      const videos: VideoItem[] = [];
      let trailerUrl: string | undefined;
      if (media.trailer && media.trailer.site === "youtube") {
        videos.push({
          id: media.trailer.id,
          key: media.trailer.id,
          name: "Official Trailer",
          site: "YouTube",
          type: "Trailer",
          official: true,
        });
        trailerUrl = `https://www.youtube.com/watch?v=${media.trailer.id}`;
      }

      const recommendations: MediaItem[] = (media.recommendations?.nodes || [])
        .filter((node: any) => node.mediaRecommendation)
        .map((node: any) => normalizeAniListItem(node.mediaRecommendation));

      const studios: string[] = (media.studios?.nodes || []).map((s: any) => s.name);

      return {
        ...base,
        runtime: media.duration,
        genresList: (media.genres || []).map((g: string) => ({ id: g, name: g })),
        cast,
        videos,
        trailerUrl,
        recommendations,
        studios,
        nativeTitle: media.title?.native,
        format: media.format,
        seasonYear: media.seasonYear,
        episodesCount: media.episodes || (media.format === "MOVIE" ? 1 : undefined),
        nextAiringEpisode: media.nextAiringEpisode,
      };
    }
  } catch (error) {
    console.error(`Error fetching anime details for ${id}:`, error);
  }

  // Resilient fallback to Kitsu
  return fetchKitsuDetails(numericId);
}
