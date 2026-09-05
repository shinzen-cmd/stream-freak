import { CastMember, EpisodeItem, GenreItem, MediaDetail, MediaItem, SeasonItem, VideoItem } from "@/types/media";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "2bfcfcc1a3f1f3aecf5f752b9adf9c3d";

export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function getTMDBImageUrl(path: string | null | undefined, size: "w300" | "w500" | "w780" | "w1280" | "original" = "w500"): string {
  if (!path) return "/placeholder-poster.png";
  if (path.startsWith("http")) return path;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getTMDBBackdropUrl(path: string | null | undefined, size: "w780" | "w1280" | "original" = "original"): string {
  if (!path) return "/placeholder-backdrop.png";
  if (path.startsWith("http")) return path;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

const tmdbClientCache = new Map<string, { data: any; expiresAt: number }>();
const tmdbInFlight = new Map<string, Promise<any>>();
const TMDB_CACHE_TTL = 10 * 60 * 1000; // 10 mins

async function fetchFromTMDB<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const cacheKey = url.toString();
  const now = Date.now();

  const cached = tmdbClientCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  if (tmdbInFlight.has(cacheKey)) {
    return tmdbInFlight.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch(url.toString(), {
        next: { revalidate: 3600 }, // cache for 1 hour
      });

      if (!res.ok) {
        throw new Error(`TMDB Error ${res.status}: ${res.statusText} for ${endpoint}`);
      }

      const json = await res.json();
      tmdbClientCache.set(cacheKey, { data: json, expiresAt: now + TMDB_CACHE_TTL });
      return json;
    } finally {
      tmdbInFlight.delete(cacheKey);
    }
  })();

  tmdbInFlight.set(cacheKey, promise);
  return promise;
}

interface RawTMDBItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  adult?: boolean;
  number_of_episodes?: number;
  status?: string;
}

export function normalizeTMDBItem(item: RawTMDBItem, forcedMediaType?: "movie" | "tv"): MediaItem {
  const mediaType = forcedMediaType || (item.media_type === "tv" || item.name ? "tv" : "movie");
  const title = item.title || item.name || "Untitled";
  const originalTitle = item.original_title || item.original_name;
  const releaseDate = item.release_date || item.first_air_date || "";

  return {
    id: item.id,
    tmdbId: item.id,
    title,
    originalTitle,
    overview: item.overview || "No synopsis available.",
    posterPath: item.poster_path ? getTMDBImageUrl(item.poster_path, "w500") : null,
    backdropPath: item.backdrop_path ? getTMDBBackdropUrl(item.backdrop_path, "original") : null,
    mediaType,
    releaseDate,
    voteAverage: Math.round((item.vote_average || 0) * 10) / 10,
    voteCount: item.vote_count,
    popularity: item.popularity,
    genreIds: item.genre_ids,
    adult: item.adult,
    totalEpisodes: item.number_of_episodes,
    status: item.status,
  };
}

export async function getTrendingMovies(timeWindow: "day" | "week" = "week"): Promise<MediaItem[]> {
  try {
    const data = await fetchFromTMDB<{ results: RawTMDBItem[] }>(`/trending/movie/${timeWindow}`);
    return (data.results || []).map((item) => normalizeTMDBItem(item, "movie"));
  } catch (error) {
    console.error("Error fetching trending movies:", error);
    return [];
  }
}

export async function getTrendingTV(timeWindow: "day" | "week" = "week"): Promise<MediaItem[]> {
  try {
    const data = await fetchFromTMDB<{ results: RawTMDBItem[] }>(`/trending/tv/${timeWindow}`);
    return (data.results || []).map((item) => normalizeTMDBItem(item, "tv"));
  } catch (error) {
    console.error("Error fetching trending TV shows:", error);
    return [];
  }
}

export async function getPopularMovies(page = 1): Promise<MediaItem[]> {
  try {
    const data = await fetchFromTMDB<{ results: RawTMDBItem[] }>("/movie/popular", { page });
    return (data.results || []).map((item) => normalizeTMDBItem(item, "movie"));
  } catch (error) {
    console.error("Error fetching popular movies:", error);
    return [];
  }
}

export async function getPopularTV(page = 1): Promise<MediaItem[]> {
  try {
    const data = await fetchFromTMDB<{ results: RawTMDBItem[] }>("/tv/popular", { page });
    return (data.results || []).map((item) => normalizeTMDBItem(item, "tv"));
  } catch (error) {
    console.error("Error fetching popular TV:", error);
    return [];
  }
}

export async function getTopRatedMovies(page = 1): Promise<MediaItem[]> {
  try {
    const data = await fetchFromTMDB<{ results: RawTMDBItem[] }>("/movie/top_rated", { page });
    return (data.results || []).map((item) => normalizeTMDBItem(item, "movie"));
  } catch (error) {
    console.error("Error fetching top rated movies:", error);
    return [];
  }
}

export async function getTopRatedTV(page = 1): Promise<MediaItem[]> {
  try {
    const data = await fetchFromTMDB<{ results: RawTMDBItem[] }>("/tv/top_rated", { page });
    return (data.results || []).map((item) => normalizeTMDBItem(item, "tv"));
  } catch (error) {
    console.error("Error fetching top rated TV:", error);
    return [];
  }
}

export async function getUpcomingMovies(page = 1): Promise<MediaItem[]> {
  try {
    const data = await fetchFromTMDB<{ results: RawTMDBItem[] }>("/movie/upcoming", { page });
    return (data.results || []).map((item) => normalizeTMDBItem(item, "movie"));
  } catch (error) {
    console.error("Error fetching upcoming movies:", error);
    return [];
  }
}

export async function getOnTheAirTV(page = 1): Promise<MediaItem[]> {
  try {
    const data = await fetchFromTMDB<{ results: RawTMDBItem[] }>("/tv/on_the_air", { page });
    return (data.results || []).map((item) => normalizeTMDBItem(item, "tv"));
  } catch (error) {
    console.error("Error fetching on the air TV:", error);
    return [];
  }
}

export async function getBollywoodMovies(page = 1): Promise<MediaItem[]> {
  try {
    const data = await fetchFromTMDB<{ results: RawTMDBItem[] }>("/discover/movie", {
      with_original_language: "hi",
      sort_by: "popularity.desc",
      page,
    });
    return (data.results || []).map((item) => normalizeTMDBItem(item, "movie"));
  } catch (error) {
    console.error("Error fetching Bollywood movies:", error);
    return [];
  }
}

export async function getBollywoodSeries(page = 1): Promise<MediaItem[]> {
  try {
    const data = await fetchFromTMDB<{ results: RawTMDBItem[] }>("/discover/tv", {
      with_original_language: "hi",
      sort_by: "popularity.desc",
      page,
    });
    return (data.results || []).map((item) => normalizeTMDBItem(item, "tv"));
  } catch (error) {
    console.error("Error fetching Bollywood series:", error);
    return [];
  }
}

export async function getTopRatedBollywoodMovies(page = 1): Promise<MediaItem[]> {
  try {
    const data = await fetchFromTMDB<{ results: RawTMDBItem[] }>("/discover/movie", {
      with_original_language: "hi",
      sort_by: "vote_average.desc",
      "vote_count.gte": 40,
      page,
    });
    return (data.results || []).map((item) => normalizeTMDBItem(item, "movie"));
  } catch (error) {
    console.error("Error fetching top rated Bollywood:", error);
    return [];
  }
}

export async function getMovieGenres(): Promise<GenreItem[]> {
  try {
    const data = await fetchFromTMDB<{ genres: GenreItem[] }>("/genre/movie/list");
    return data.genres || [];
  } catch (error) {
    console.error("Error fetching movie genres:", error);
    return [];
  }
}

export async function getTVGenres(): Promise<GenreItem[]> {
  try {
    const data = await fetchFromTMDB<{ genres: GenreItem[] }>("/genre/tv/list");
    return data.genres || [];
  } catch (error) {
    console.error("Error fetching TV genres:", error);
    return [];
  }
}

export async function discoverMovies(params: {
  genreId?: string | number;
  sortBy?: string;
  year?: string | number;
  page?: number;
  withOriginalLanguage?: string;
  withSpokenLanguages?: string;
}): Promise<{ items: MediaItem[]; totalPages: number }> {
  try {
    const queryParams: Record<string, string | number> = {
      page: params.page || 1,
      sort_by: params.sortBy || "popularity.desc",
    };
    if (params.genreId) queryParams.with_genres = params.genreId;
    if (params.year) queryParams.primary_release_year = params.year;
    if (params.withOriginalLanguage) queryParams.with_original_language = params.withOriginalLanguage;
    if (params.withSpokenLanguages) queryParams.with_spoken_languages = params.withSpokenLanguages;

    const data = await fetchFromTMDB<{ results: RawTMDBItem[]; total_pages: number }>("/discover/movie", queryParams);
    return {
      items: (data.results || []).map((item) => normalizeTMDBItem(item, "movie")),
      totalPages: data.total_pages || 1,
    };
  } catch (error) {
    console.error("Error discovering movies:", error);
    return { items: [], totalPages: 1 };
  }
}

export async function getHollywoodHindiDubbedMovies(page = 1): Promise<MediaItem[]> {
  try {
    const data = await fetchFromTMDB<{ results: RawTMDBItem[] }>("/discover/movie", {
      with_original_language: "en",
      with_spoken_languages: "hi",
      sort_by: "popularity.desc",
      page,
    });
    return (data.results || []).map((item) => normalizeTMDBItem(item, "movie"));
  } catch (error) {
    console.error("Error fetching Hollywood Hindi dubbed movies:", error);
    return [];
  }
}

export async function discoverTV(params: {
  genreId?: string | number;
  sortBy?: string;
  year?: string | number;
  page?: number;
}): Promise<{ items: MediaItem[]; totalPages: number }> {
  try {
    const queryParams: Record<string, string | number> = {
      page: params.page || 1,
      sort_by: params.sortBy || "popularity.desc",
    };
    if (params.genreId) queryParams.with_genres = params.genreId;
    if (params.year) queryParams.first_air_date_year = params.year;

    const data = await fetchFromTMDB<{ results: RawTMDBItem[]; total_pages: number }>("/discover/tv", queryParams);
    return {
      items: (data.results || []).map((item) => normalizeTMDBItem(item, "tv")),
      totalPages: data.total_pages || 1,
    };
  } catch (error) {
    console.error("Error discovering TV shows:", error);
    return { items: [], totalPages: 1 };
  }
}

export async function searchTMDB(query: string, page = 1): Promise<MediaItem[]> {
  if (!query.trim()) return [];
  try {
    const data = await fetchFromTMDB<{ results: RawTMDBItem[] }>("/search/multi", {
      query,
      page,
      include_adult: "false",
    });
    return (data.results || [])
      .filter((item) => item.media_type === "movie" || item.media_type === "tv")
      .map((item) => normalizeTMDBItem(item));
  } catch (error) {
    console.error("Error searching TMDB:", error);
    return [];
  }
}

export async function getMovieDetails(id: number | string): Promise<MediaDetail | null> {
  try {
    const data = await fetchFromTMDB<any>(`/movie/${id}`, {
      append_to_response: "credits,videos,recommendations,similar",
    });

    const cast: CastMember[] = (data.credits?.cast || []).slice(0, 16).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: c.profile_path ? getTMDBImageUrl(c.profile_path, "w300") : null,
      role: "Cast",
    }));

    const videos: VideoItem[] = (data.videos?.results || []).map((v: any) => ({
      id: v.id,
      key: v.key,
      name: v.name,
      site: v.site,
      type: v.type,
      official: v.official,
    }));

    const trailer = videos.find((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));

    const recommendations: MediaItem[] = (data.recommendations?.results || [])
      .slice(0, 12)
      .map((item: any) => normalizeTMDBItem(item, "movie"));

    const similar: MediaItem[] = (data.similar?.results || [])
      .slice(0, 12)
      .map((item: any) => normalizeTMDBItem(item, "movie"));

    return {
      ...normalizeTMDBItem(data, "movie"),
      tagline: data.tagline,
      runtime: data.runtime,
      genresList: data.genres || [],
      genres: (data.genres || []).map((g: GenreItem) => g.name),
      cast,
      videos,
      trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
      recommendations: recommendations.length > 0 ? recommendations : similar,
      similar,
    };
  } catch (error) {
    console.error(`Error fetching movie details for ${id}:`, error);
    return null;
  }
}

export async function getTVDetails(id: number | string): Promise<MediaDetail | null> {
  try {
    const data = await fetchFromTMDB<any>(`/tv/${id}`, {
      append_to_response: "credits,videos,recommendations,similar",
    });

    const cast: CastMember[] = (data.credits?.cast || []).slice(0, 16).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: c.profile_path ? getTMDBImageUrl(c.profile_path, "w300") : null,
      role: "Cast",
    }));

    const videos: VideoItem[] = (data.videos?.results || []).map((v: any) => ({
      id: v.id,
      key: v.key,
      name: v.name,
      site: v.site,
      type: v.type,
      official: v.official,
    }));

    const trailer = videos.find((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));

    const seasons: SeasonItem[] = (data.seasons || [])
      .filter((s: any) => s.season_number > 0)
      .map((s: any) => ({
        id: s.id,
        seasonNumber: s.season_number,
        name: s.name,
        overview: s.overview || "",
        posterPath: s.poster_path ? getTMDBImageUrl(s.poster_path, "w300") : null,
        episodeCount: s.episode_count,
      }));

    const recommendations: MediaItem[] = (data.recommendations?.results || [])
      .slice(0, 12)
      .map((item: any) => normalizeTMDBItem(item, "tv"));

    const similar: MediaItem[] = (data.similar?.results || [])
      .slice(0, 12)
      .map((item: any) => normalizeTMDBItem(item, "tv"));

    return {
      ...normalizeTMDBItem(data, "tv"),
      tagline: data.tagline,
      runtime: data.episode_run_time?.[0],
      genresList: data.genres || [],
      genres: (data.genres || []).map((g: GenreItem) => g.name),
      cast,
      videos,
      seasons,
      totalEpisodes: data.number_of_episodes,
      trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
      recommendations: recommendations.length > 0 ? recommendations : similar,
      similar,
    };
  } catch (error) {
    console.error(`Error fetching TV details for ${id}:`, error);
    return null;
  }
}

export async function getTVSeasonEpisodes(tvId: number | string, seasonNumber: number): Promise<EpisodeItem[]> {
  try {
    const data = await fetchFromTMDB<any>(`/tv/${tvId}/season/${seasonNumber}`);
    return (data.episodes || []).map((ep: any) => ({
      id: ep.id,
      episodeNumber: ep.episode_number,
      seasonNumber: ep.season_number,
      name: ep.name || `Episode ${ep.episode_number}`,
      overview: ep.overview || "No episode summary available.",
      stillPath: ep.still_path ? getTMDBImageUrl(ep.still_path, "w500") : null,
      airDate: ep.air_date,
      runtime: ep.runtime,
      voteAverage: Math.round((ep.vote_average || 0) * 10) / 10,
    }));
  } catch (error) {
    console.error(`Error fetching season ${seasonNumber} for TV ${tvId}:`, error);
    return [];
  }
}
