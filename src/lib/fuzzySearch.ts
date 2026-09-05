import { MediaItem } from "@/types/media";
import { searchTMDB } from "@/lib/tmdb";
import { searchAnime } from "@/lib/anilist";

/**
 * Curated knowledge base of popular Movies, TV Shows, Anime, and Bollywood titles
 * for rapid client-side typo correction and phonetic matching.
 */
export const POPULAR_TITLES_DICTIONARY = [
  // Anime
  "Attack on Titan",
  "Demon Slayer: Kimetsu no Yaiba",
  "Jujutsu Kaisen",
  "Solo Leveling",
  "Chainsaw Man",
  "Naruto Shippuden",
  "One Piece",
  "Bleach: Thousand-Year Blood War",
  "Death Note",
  "Fullmetal Alchemist: Brotherhood",
  "Hunter x Hunter",
  "My Hero Academia",
  "Dragon Ball Super",
  "Dragon Ball Z",
  "Tokyo Ghoul",
  "Sword Art Online",
  "Spirited Away",
  "Your Name",
  "Cyberpunk: Edgerunners",
  "Cowboy Bebop",
  "Neon Genesis Evangelion",
  "Steins;Gate",
  "Vinland Saga",
  "Frieren: Beyond Journey's End",
  "Black Clover",
  "Mob Psycho 100",
  "One Punch Man",
  "Code Geass",
  "Spy x Family",
  "Bocchi the Rock!",
  "Blue Lock",
  "Haikyuu!!",
  "Mushoku Tensei",
  "Hell's Paradise",
  "Kaiju No. 8",
  "Dandadan",

  // Movies
  "Inception",
  "Interstellar",
  "Oppenheimer",
  "The Dark Knight",
  "The Dark Knight Rises",
  "Batman Begins",
  "Avengers: Endgame",
  "Avengers: Infinity War",
  "Avatar: The Way of Water",
  "Avatar",
  "Titanic",
  "Gladiator",
  "Gladiator II",
  "Dune: Part Two",
  "Dune",
  "Fight Club",
  "The Matrix",
  "Pulp Fiction",
  "Forrest Gump",
  "The Shawshank Redemption",
  "The Godfather",
  "The Lord of the Rings: The Fellowship of the Ring",
  "The Lord of the Rings: The Return of the King",
  "Spider-Man: Across the Spider-Verse",
  "Spider-Man: No Way Home",
  "Deadpool & Wolverine",
  "Joker",
  "Joker: Folie à Deux",
  "Everything Everywhere All at Once",
  "Parasite",
  "Top Gun: Maverick",
  "John Wick: Chapter 4",
  "Guardians of the Galaxy",
  "Transformers",
  "Jurassic World",
  "Fast & Furious",

  // TV Shows
  "Breaking Bad",
  "Better Call Saul",
  "Stranger Things",
  "Game of Thrones",
  "House of the Dragon",
  "The Boys",
  "The Last of Us",
  "Wednesday",
  "Squid Game",
  "Loki",
  "Peaky Blinders",
  "Sherlock",
  "The Mandalorian",
  "The Witcher",
  "Severance",
  "Succession",
  "Dark",
  "Chernobyl",
  "The Crown",
  "Vikings",
  "The Walking Dead",
  "Money Heist",
  "The Bear",
  "Shogun",
  "True Detective",

  // Bollywood
  "RRR",
  "Pathaan",
  "Jawan",
  "Animal",
  "KGF Chapter 2",
  "Dangal",
  "Baahubali: The Beginning",
  "Baahubali: The Conclusion",
  "3 Idiots",
  "Kantara",
  "Stree 2",
  "Brahmastra",
  "Sholay",
  "Gangs of Wasseypur",
  "Dilwale Dulhania Le Jayenge",
  "Kabir Singh",
  "Bajrangi Bhaijaan",
  "PK",
  "Lagaan",
  "Drishyam",
  "Drishyam 2",
  "Pushpa: The Rise",
  "Pushpa 2: The Rule",
  "Singham",
  "Kalki 2898 AD",
];

/**
 * Standard Levenshtein distance metric
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const costs = [];
  for (let i = 0; i <= a.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= b.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (a.charAt(i - 1) !== b.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[b.length] = lastValue;
  }
  return costs[b.length];
}

/**
 * Normalizes string for fuzzy comparison
 */
function cleanString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/**
 * Calculates similarity coefficient between 0 and 1
 */
export function calculateSimilarity(s1: string, s2: string): number {
  const clean1 = cleanString(s1);
  const clean2 = cleanString(s2);
  if (clean1 === clean2) return 1.0;
  if (!clean1 || !clean2) return 0.0;

  // Substring inclusion bonus
  if (clean2.includes(clean1) || clean1.includes(clean2)) {
    const minLen = Math.min(clean1.length, clean2.length);
    const maxLen = Math.max(clean1.length, clean2.length);
    return 0.7 + (minLen / maxLen) * 0.3;
  }

  const dist = levenshteinDistance(clean1, clean2);
  const maxLen = Math.max(clean1.length, clean2.length);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Finds the closest matching title in our dictionary for misspelled inputs
 */
export function getTypoSuggestion(inputQuery: string): {
  suggestion: string | null;
  confidence: number;
} {
  const query = cleanString(inputQuery);
  if (query.length < 3) return { suggestion: null, confidence: 0 };

  let bestMatch: string | null = null;
  let highestScore = 0;

  for (const title of POPULAR_TITLES_DICTIONARY) {
    const cleanTitle = cleanString(title);
    const score = calculateSimilarity(query, cleanTitle);

    if (score > highestScore) {
      highestScore = score;
      bestMatch = title;
    }
  }

  // Threshold: only suggest if similarity >= 0.58
  if (highestScore >= 0.58 && bestMatch && cleanString(bestMatch) !== query) {
    return { suggestion: bestMatch, confidence: highestScore };
  }

  return { suggestion: null, confidence: 0 };
}

export interface SmartSearchResult {
  results: MediaItem[];
  suggestion: string | null;
  searchedTerm: string;
}

/**
 * Smart Typo-Tolerant Search:
 * Queries TMDB and AniList, automatically falls back to typo corrections and token variants
 */
export async function executeSmartSearch(query: string): Promise<SmartSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { results: [], suggestion: null, searchedTerm: query };
  }

  // 1. Direct Search
  const [initialTmdb, initialAnime] = await Promise.all([
    searchTMDB(trimmed).catch(() => []),
    searchAnime(trimmed).catch(() => []),
  ]);

  let combined = deduplicateMedia([...initialTmdb, ...initialAnime]);

  // 2. Check for Typo Suggestion
  const { suggestion } = getTypoSuggestion(trimmed);

  // If initial search yielded few/no results and we have a typo suggestion, query the suggestion!
  if (combined.length < 3 && suggestion && suggestion.toLowerCase() !== trimmed.toLowerCase()) {
    try {
      const [sugTmdb, sugAnime] = await Promise.all([
        searchTMDB(suggestion).catch(() => []),
        searchAnime(suggestion).catch(() => []),
      ]);
      const suggestedResults = deduplicateMedia([...sugTmdb, ...sugAnime]);
      if (suggestedResults.length > 0) {
        combined = deduplicateMedia([...combined, ...suggestedResults]);
      }
    } catch {
      // Ignore suggestion fetch error
    }
  }

  // 3. Fallback to individual word keywords if still empty and multiple words were entered
  if (combined.length === 0 && trimmed.includes(" ")) {
    const words = trimmed
      .split(" ")
      .filter((w) => w.length >= 4)
      .sort((a, b) => b.length - a.length);

    if (words.length > 0) {
      const primaryWord = words[0];
      const [wordTmdb, wordAnime] = await Promise.all([
        searchTMDB(primaryWord).catch(() => []),
        searchAnime(primaryWord).catch(() => []),
      ]);
      combined = deduplicateMedia([...wordTmdb, ...wordAnime]);
    }
  }

  return {
    results: combined,
    suggestion: suggestion && combined.length > 0 && suggestion.toLowerCase() !== trimmed.toLowerCase() ? suggestion : null,
    searchedTerm: trimmed,
  };
}

function deduplicateMedia(items: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  const out: MediaItem[] = [];
  for (const item of items) {
    const key = `${item.mediaType}-${item.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}
