export type MediaType = "movie" | "tv" | "anime";

export interface GenreItem {
  id: number | string;
  name: string;
}

export interface MediaItem {
  id: string | number;
  tmdbId?: number;
  anilistId?: number;
  malId?: number;
  title: string;
  originalTitle?: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  mediaType: MediaType;
  releaseDate?: string;
  voteAverage: number;
  voteCount?: number;
  popularity?: number;
  genres?: string[];
  genreIds?: number[];
  adult?: boolean;
  totalEpisodes?: number;
  status?: string;
  bannerImage?: string | null;
}

export interface CastMember {
  id: number | string;
  name: string;
  character: string;
  profilePath: string | null;
  role?: string;
}

export interface VideoItem {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface EpisodeItem {
  id: number | string;
  episodeNumber: number;
  seasonNumber?: number;
  name: string;
  overview: string;
  stillPath: string | null;
  airDate?: string;
  runtime?: number;
  voteAverage?: number;
}

export interface SeasonItem {
  id: number | string;
  seasonNumber: number;
  name: string;
  overview: string;
  posterPath: string | null;
  episodeCount: number;
  episodes?: EpisodeItem[];
}

export interface MediaDetail extends MediaItem {
  tagline?: string;
  runtime?: number;
  genresList: GenreItem[];
  cast: CastMember[];
  videos: VideoItem[];
  seasons?: SeasonItem[];
  recommendations: MediaItem[];
  similar?: MediaItem[];
  trailerUrl?: string;
  episodesCount?: number;
  studios?: string[];
  nativeTitle?: string;
  format?: string;
  seasonYear?: number;
  nextAiringEpisode?: { episode: number; airingAt: number };
}

export interface PlayerServer {
  id: string;
  name: string;
  url: string;
  quality?: string;
}

export interface WatchHistoryItem {
  id: string | number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  progressPercent: number;
  timestamp: number;
}
