import { CONFIG } from '../config';

const BASE = CONFIG.APP_URL.replace(/\/$/, '');

export interface MovieCard {
  subject_id: string;
  title: string;
  cover: string;
  rating?: string | number;
  imdb_rating?: string | number;
  type?: string;
  year?: string | number;
  genre?: string;
  quality?: string;
}

export interface Feed {
  trending: MovieCard[];
  cinema: MovieCard[];
  hollywood: MovieCard[];
  bollywood: MovieCard[];
  south_indian?: MovieCard[];
  series?: MovieCard[];
  anime?: MovieCard[];
  asian_drama?: MovieCard[];
}

export interface StreamSource {
  url: string;
  quality: string;
  format: string;
  size_mb?: number;
  codec?: string;
  headers?: Record<string, string>;
}

export interface DetailData {
  subject_id: string;
  title: string;
  description: string;
  cover: string;
  backdrop?: string;
  type?: string;
  genre?: string;
  release_date?: string;
  imdb_rating?: string | number;
  rating?: string | number;
  cast?: string;
  director?: string;
  duration?: string;
  coming_soon?: boolean;
  dubs?: { subject_id: string; lang_name: string }[];
}

export interface StreamData {
  title?: string;
  streams: StreamSource[];
  fallback_servers?: { id: string; name: string; url: string; type: string }[];
  dubs?: { subject_id: string; lang_name: string }[];
}

export interface SearchResult {
  subject_id: string;
  title: string;
  cover: string;
  type?: string;
  year?: string | number;
  imdb_rating?: string | number;
  rating?: string | number;
  genre?: string;
}

const get = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
};

export const api = {
  feed: () => get<Feed>('/api/feed'),

  search: (query: string) =>
    get<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(query)}`),

  detail: (id: string) => get<DetailData>(`/detail/${id}`),

  streams: (id: string, season = 0, ep = 0) =>
    get<StreamData>(`/api/stream/${id}?se=${season}&ep=${ep}`),

  episodes: (id: string) =>
    get<{ subject_id: string; seasons: any[] }>(`/episodes/${id}`),

  proxyUrl: (streamUrl: string, referer?: string) => {
    const ref = referer || 'https://movieboxonline.net/';
    return `${BASE}/api/proxy/stream?url=${encodeURIComponent(streamUrl)}&referer=${encodeURIComponent(ref)}`;
  },
};

