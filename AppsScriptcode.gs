// !DOCTYPE Code.gs

/* Rules for ChatGPT chat:
Show before and after snippets for replacement codes
Specify the function a new code should go directly under
Give only one step at a time, confirming the change hasnt broken any codes for the app
*/

function testKey() {
  return PropertiesService.getScriptProperties().getProperty('TMDB_API_KEY');
}


// ---- TMDB KEY (single source of truth)
const TMDB_API_KEY = (function () {
  const k = PropertiesService.getScriptProperties().getProperty('TMDB_API_KEY');
  if (!k) {
    throw new Error('TMDB_API_KEY is missing. In the Apps Script editor, open Project Settings → Script properties and add TMDB_API_KEY.');
  }
  return k;
})();

function getScriptPropertyOrThrow(key) {
  const val = PropertiesService.getScriptProperties().getProperty(key);
  if (!val) throw new Error(`Missing ${key} in Script Properties`);
  return val;
}

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('My Movie Browser')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function pingWishlistVersion() {
  // Bump this string anytime you redeploy to confirm it’s the version you expect.
  return 'wishlist-ping v1 ' + new Date().toISOString();
}

function collectRecentVideosFromFolder(folder, cutoffDate) {
  const videos = [];
  const files = folder.getFiles();
  let poster = '';

  while (files.hasNext()) {
    const f = files.next();
    const name = String(f.getName() || '').toLowerCase();

    if (!poster && isPosterName(name)) {
      poster = 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w300';
    }

    if (/\.(mp4|mov|mkv)$/i.test(name)) {
      const created = (typeof f.getDateCreated === 'function') ? f.getDateCreated() : f.getLastUpdated();
      if (created >= cutoffDate) {
        videos.push({
          title: f.getName().replace(/\.(mp4|mov|mkv)$/i, ''),
          url: `https://drive.google.com/file/d/${f.getId()}/preview`,
          poster: poster || ''
        });
      }
    }
  }
  return videos;
}

// Build Movie/TV JSON by processing Drive folders
// Build Movie/TV JSON by processing Drive folders
function processCategory(categoryFolder) {
  const results = [];
  const DEBUG = false; // set false after testing

  // ---- SNAPSHOT title folders as IDs, then re-fetch handles
  const titleFolderInfos = [];
  {
    const it = categoryFolder.getFolders();
    while (it.hasNext()) {
      const tf = it.next();
      titleFolderInfos.push({ id: tf.getId(), name: tf.getName() });
    }
  }
  if (DEBUG) Logger.log(`processCategory: found ${titleFolderInfos.length} title folders under "${categoryFolder.getName()}"`);

  for (const info of titleFolderInfos) {
    const titleFolder = DriveApp.getFolderById(info.id); // fresh handle
    const title = titleFolder.getName();

    // Snapshot child folders by ID (fresh handles later)
    const childInfos = [];
    {
      const it = titleFolder.getFolders();
      while (it.hasNext()) {
        const cf = it.next();
        childInfos.push({ id: cf.getId(), name: cf.getName() });
      }
    }
    if (DEBUG) Logger.log(`  • "${title}" -> ${childInfos.length} child folders: ${JSON.stringify(childInfos.map(x => x.name))}`);

    // Build episodes from child folders (re-fetch)
    const childEpisodes = [];
    for (const ci of childInfos) {
      const epFolder = DriveApp.getFolderById(ci.id);
      const vids = getVideosFromDriveFolder(epFolder);
      if (vids.length > 0) {
        const epPoster = getPosterFromDriveFolder(epFolder);
        childEpisodes.push({
          title: epFolder.getName(),
          url: vids[0].url,
          poster: epPoster || ''
        });
      }
    }

    // Only now touch files on the parent
    const parentPoster = getPosterFromDriveFolder(titleFolder);

    if (childEpisodes.length > 0) {
      results.push({
        title,
        poster: parentPoster || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(title),
        type: 'movie-series',
        episodes: childEpisodes
      });
      if (DEBUG) Logger.log(`    -> SERIES with ${childEpisodes.length} episodes`);
      continue;
    }

    // Fallback: direct videos on the title folder
    const directVideos = getVideosFromDriveFolder(titleFolder);
    results.push({
      title,
      poster: parentPoster || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(title),
      type: directVideos.length > 1 ? 'tv' : 'movie',
      episodes: directVideos
    });
    if (DEBUG) Logger.log(`    -> DIRECT videos: ${directVideos.length}`);
  }

  return results;
}

// --- Shared Drive helpers (used by processCategory & getEpisodesByTitle) ---
function isPosterName(name) {
  const n = String(name || '').toLowerCase();
  return /\.(png|jpe?g|webp)$/i.test(n);
}

function getPosterFromDriveFolder(folder) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (isPosterName(f.getName())) {
      return 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w300';
    }
  }
  return '';
}

function getVideosFromDriveFolder(folder) {
  const out = [];
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    const n = String(f.getName() || '').toLowerCase();
    if (/\.(mp4|mov|mkv)$/i.test(n)) {
      out.push({
        title: f.getName().replace(/\.(mp4|mov|mkv)$/i, ''),
        url: `https://drive.google.com/file/d/${f.getId()}/preview`
      });
    }
  }
  return out;
}

function normTitle(s) {
  return String(s || '').replace(/\u00A0/g, ' ').trim().toLowerCase();
}

function getEpisodesByTitle(title) {
  const rootFolderId = getScriptPropertyOrThrow('ROOT_FOLDER_ID');
  const root = DriveApp.getFolderById(rootFolderId);
  const categories = ['Movies', 'TV Shows'];

  for (const cat of categories) {
    const it = root.getFoldersByName(cat);
    if (!it.hasNext()) continue;
    const catFolder = it.next();

    // find the title folder
    const tfIt = catFolder.getFolders();
    while (tfIt.hasNext()) {
      const titleFolder = tfIt.next();
      if (normTitle(titleFolder.getName()) !== normTitle(title)) continue;

      // children as episodes
      const childEpisodes = [];
      const childIt = titleFolder.getFolders();
      while (childIt.hasNext()) {
        const epFolder = childIt.next();
        const vids = getVideosFromDriveFolder(epFolder);
        if (vids.length) {
          childEpisodes.push({
            title: epFolder.getName(),
            url: vids[0].url,
            poster: getPosterFromDriveFolder(epFolder) || ''
          });
        }
      }

      const parentPoster = getPosterFromDriveFolder(titleFolder);
      if (childEpisodes.length) {
        return { title: titleFolder.getName(), poster: parentPoster, episodes: childEpisodes };
      }

      // fallback: direct videos
      const direct = getVideosFromDriveFolder(titleFolder);
      return { title: titleFolder.getName(), poster: parentPoster, episodes: direct };
    }
  }
  return { title, poster: '', episodes: [] };
}

// New function: Build and return your entire library JSON
function getLibraryData() {
  const rootFolderId = getScriptPropertyOrThrow('ROOT_FOLDER_ID');
  const rootFolder = DriveApp.getFolderById(rootFolderId);

  const moviesFolder = rootFolder.getFoldersByName('Movies').hasNext()
    ? rootFolder.getFoldersByName('Movies').next()
    : null;
  const tvFolder = rootFolder.getFoldersByName('TV Shows').hasNext()
    ? rootFolder.getFoldersByName('TV Shows').next()
    : null;

  const movies = moviesFolder ? processCategory(moviesFolder) : [];
  const tv = tvFolder ? processCategory(tvFolder) : [];

  return { movies, tv };
}

// TMDB
function tmdbFetch(path, params = {}, opts = {}) {
  const apiKey = getScriptPropertyOrThrow('TMDB_API_KEY');

  const base = 'https://api.themoviedb.org/3';
  const q = Object.entries(params || {})
    .filter(([,v]) => v !== undefined && v !== null && v !== '')
    .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const url = `${base}${path}?api_key=${encodeURIComponent(apiKey)}${q ? '&' + q : ''}`;

  const fetchOpts = Object.assign({ muteHttpExceptions: true }, opts || {});
  const maxAttempts = 4; // 1 try + up to 3 retries
  let attempt = 0, lastErr;

  while (attempt < maxAttempts) {
    try {
      const resp = UrlFetchApp.fetch(url, fetchOpts);
      const code = resp.getResponseCode();
      if (code >= 200 && code < 300) {
        const text = resp.getContentText() || '{}';
        // TMDb can occasionally return HTML for errors; guard parse
        try { return JSON.parse(text); }
        catch (e) { throw new Error(`TMDb parse error for ${path}`); }
      }

      // Retry on 429 and 5xx
      if (code === 429 || (code >= 500 && code <= 599)) {
        lastErr = new Error(`TMDb retryable error ${code} for ${path}`);
      } else {
        throw new Error(`TMDb error ${code} for ${path}`);
      }
    } catch (err) {
      lastErr = err;
    }

    attempt++;
    if (attempt < maxAttempts) {
      // Exponential backoff with jitter: 500ms, 1s, 2s (+random up to 250ms)
      const baseMs = Math.pow(2, attempt - 1) * 500;
      const jitter = Math.floor(Math.random() * 250);
      Utilities.sleep(baseMs + jitter);
      continue;
    }
    break;
  }

  throw lastErr || new Error(`TMDb unknown error for ${path}`);
}

// Place directly under function tmdbFetch(...) { ... } in code.gs
function testTmdbKey() {
  const key = PropertiesService.getScriptProperties().getProperty('TMDB_API_KEY') || '';
  const looksV4 = key.startsWith('eyJ');
  try {
    const ok = tmdbFetch('/configuration'); // simple, lightweight endpoint
    return {
      ok: !!ok && !!ok.images,
      looksV4,
      hint: looksV4 ? 'You saved the v4 token. Use the v3 API Key instead.' : 'Key format looks fine.',
    };
  } catch (e) {
    return { ok: false, looksV4, error: String(e) };
  }
}

// ---- Caching helpers for TMDb
function _tmdbDigestHex_(str) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, str);
  return bytes.map(b => (b + 256 & 255).toString(16).padStart(2, '0')).join('');
}
function _tmdbStableParams_(params) {
  const entries = Object.entries(params || {})
    .filter(([,v]) => v !== undefined && v !== null && v !== '');
  entries.sort(([a],[b]) => a.localeCompare(b));
  return entries;
}
function _tmdbCacheVersion_() {
  // Read from Script Properties so a single bump invalidates all keys.
  var p = PropertiesService.getScriptProperties().getProperty('TMDB_CACHE_VERSION');
  return String(p || '1'); // default "1"
}
/**
 * Cached wrapper around tmdbFetch, namespaced by a cache version.
 * Bump TMDB_CACHE_VERSION in Script Properties (or call bumpTmdbCacheVersion)
 * to “flush” old cached entries.
 */
function tmdbCachedFetch(path, params = {}, opts = {}, ttlSeconds = 21600) { // default 6h
  const ver = _tmdbCacheVersion_();
  const stable = _tmdbStableParams_(params);
  const keyRaw = `tmdb:v${ver}:${path}?${JSON.stringify(stable)}`;
  const key = _tmdbDigestHex_(keyRaw);
  const cache = CacheService.getScriptCache();

  // Try cache
  const cached = cache.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch (_) { /* ignore & refetch */ }
  }

  const data = tmdbFetch(path, params, opts);
  const payload = JSON.stringify(data);
  if (payload.length < 95000) {
    cache.put(key, payload, Math.max(5, Math.min(21600, Math.floor(ttlSeconds)))); // 5s..6h
  }
  return data;
}

/** ====== TMDb Daily Cache (Sheet-backed, single-cell JSON per list) ====== **/
function _tmdbDailyCacheSheet_() {
  const ss = SpreadsheetApp.getActive();
  const name = 'TMDbDailyCache';
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/** Store JSON into a named list row (A=listKey, B=json, C=updatedAt) */
function _writeTmdbDaily_(listKey, arr) {
  const sh = _tmdbDailyCacheSheet_();
  // ensure header
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,3).setValues([['list','json','updatedAt']]);
  }
  const vals = sh.getDataRange().getValues();
  const now  = new Date().toISOString();
  const json = JSON.stringify({ items: arr || [], updatedAt: now });

  // find existing row
  let row = 0;
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === listKey) { row = i + 1; break; }
  }
  if (row) {
    sh.getRange(row, 2).setValue(json);
    sh.getRange(row, 3).setValue(now);
  } else {
    sh.appendRow([listKey, json, now]);
  }
}

/** Read JSON blob for a named list; returns {items:[], updatedAt} */
function _readTmdbDaily_(listKey) {
  const sh = _tmdbDailyCacheSheet_();
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === listKey) {
      try { return JSON.parse(String(vals[i][1] || '{}')) || { items:[], updatedAt:null }; }
      catch (_) { return { items:[], updatedAt:null }; }
    }
  }
  return { items:[], updatedAt:null };
}

/**
 * Nightly job: fetch several pages for movies & TV and cache them.
 * Tweak pagesPerType/maxItems to fit your taste & quotas.
 */
function refreshTmdbDailyCache(pagesPerType = 6, maxItemsPerList = 900) {
  bumpTmdbCacheVersion();
  // Helper to fetch N pages for one type using your existing discover wrapper
  function _fetchPages(type, pages) {
    const all = [];
    // Use popularity-desc discover (broadest catalog browse)
    for (let p = 1; p <= pages; p++) {
      try {
        const data = tmdbDiscover({
          __type: type, language: 'en-US', include_adult: 'false',
          sort_by: 'popularity.desc', page: p, 'vote_count.gte': (type === 'tv') ? 50 : 100
        });
        const rows = Array.isArray(data.results) ? data.results : [];
        rows.forEach(r => r.media_type = type);
        all.push(...rows);
      } catch (e) {
        // swallow and continue; we’ll still cache what we have
      }
    }
    // Normalize posters + apply your regional filter
    const items = addPosterBasePath(filterOutAsian(all));
    // Deduplicate by id+type
    const seen = new Set();
    const dedup = [];
    for (const it of items) {
      const key = (it.media_type || '') + ':' + (it.id || '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      dedup.push(it);
      if (dedup.length >= maxItemsPerList) break;
    }
    return dedup;
  }

  // Build lists
  const movies = _fetchPages('movie', Math.max(1, pagesPerType|0));
  const tv     = _fetchPages('tv',    Math.max(1, pagesPerType|0));

  // Write to cache rows (single cell JSON each)
  _writeTmdbDaily_('browse_movie_popular', movies);
  _writeTmdbDaily_('browse_tv_popular',    tv);

  // Optional: trending snapshots (one page each) – cheap and nice to have
  try { _writeTmdbDaily_('trending_movie_day', getTrendingByType('movie', 1, 'day')); } catch(_) {}
  try { _writeTmdbDaily_('trending_tv_day',    getTrendingByType('tv',    1, 'day')); } catch(_) {}

  return {
    ok: true,
    counts: { movies: movies.length, tv: tv.length }
  };
}

/** Read slices for the UI (shuffle-friendly client will call this) */
function getTmdbDailySlice(listKey, offset, limit) {
  const data = _readTmdbDaily_(listKey);
  const items = Array.isArray(data.items) ? data.items : [];
  const start = Math.max(0, Math.min(Number(offset)||0, Math.max(0, items.length - 1)));
  const end   = Math.max(start, Math.min(start + Math.max(1, Math.min(Number(limit)||20, 50)), items.length));
  return {
    updatedAt: data.updatedAt || null,
    total: items.length,
    items: items.slice(start, end)
  };
}

/**
 * Seed the TMDbDailyCache sheet with a tiny mock dataset so the client
 * can render Explore from cache without doing any UrlFetch calls.
 * Safe to run anytime; nightly refreshTmdbDailyCache() will overwrite later.
 */
function seedTmdbDailyCacheMock() {
  const makeItems = (type, titles) => titles.map((t, i) => ({
    id: 100000 + i,
    media_type: type,              // 'movie' or 'tv'
    title: type === 'movie' ? t : undefined,
    name:  type === 'tv'    ? t : undefined,
    poster: 'https://via.placeholder.com/185x278?text=' + encodeURIComponent(t),
    vote_average: 7.8,
    overview: 'Mock item for wiring test only.',
    original_language: 'en',
    origin_country: ['US']
  }));

  const movies = makeItems('movie', [
    'Mock Movie One', 'Mock Movie Two', 'Mock Movie Three',
    'Mock Movie Four', 'Mock Movie Five', 'Mock Movie Six'
  ]);
  const tv = makeItems('tv', [
    'Mock Show One', 'Mock Show Two', 'Mock Show Three',
    'Mock Show Four', 'Mock Show Five', 'Mock Show Six'
  ]);

  // Write to the same keys your client reads
  _writeTmdbDaily_('browse_movie_popular', movies);
  _writeTmdbDaily_('browse_tv_popular',    tv);
  _writeTmdbDaily_('trending_movie_day',   movies.slice(0, 4));
  _writeTmdbDaily_('trending_tv_day',      tv.slice(0, 4));

  return { ok: true, movies: movies.length, tv: tv.length };
}

function bumpTmdbCacheVersion() {
  const props = PropertiesService.getScriptProperties();
  let cur = parseInt(props.getProperty('TMDB_CACHE_VERSION') || '1', 10);
  if (isNaN(cur)) cur = 1;
  cur += 1;
  props.setProperty('TMDB_CACHE_VERSION', String(cur));
  return 'TMDB_CACHE_VERSION bumped to ' + cur;
}

// ---- Provider filtering (US) ----
function _normalizeProviderNameForMatch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\+/g, 'plus')  // "AMC+" → "amcplus"
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Names we accept (include common variants)
const WANTED_PROVIDER_NAMES = [
  'netflix',
  'amazon prime video', 'prime video',
  'hulu',
  'disney plus', 'disney+',
  'max', 'hbo max',
  'amc+', 'amc plus', 'amcplus',
  'starz'
];

function _getProviderIdsPipe(type /* 'movie' | 'tv' */, region /* 'US' */) {
  const cache  = CacheService.getScriptCache();
  const key    = `wp:${type}:${region}`;
  const cached = cache.get(key);
  if (cached) return cached;

  // Use the centralized fetcher (handles api_key, retries, errors)
  try {
    const data = tmdbFetch(`/watch/providers/${type}`, { watch_region: region });
    const results = Array.isArray(data.results) ? data.results : [];

    const ids = results
      .filter(r => _wantedProviderPred(r.provider_name))
      .map(r => String(r.provider_id))
      .filter(Boolean);

    const pipe = ids.join('|'); // e.g. "8|9|15"
    if (pipe) cache.put(key, pipe, 3600); // cache 1 hour
    return pipe;
  } catch (_) {
    return '';
  }
}

function _wantedProviderPred(name) {
  const n = _normalizeProviderNameForMatch(name);
  return WANTED_PROVIDER_NAMES.some(w => n === _normalizeProviderNameForMatch(w));
}

/*** === TMDb Genres Cache (Apps Script) === ***/

/** Sheet: GenresCache
 *  Cols: [A] key  [B] genres_json  [C] updatedAt ISO
 *  key = lower(title) + '|' + (type: 'movie'|'tv') + '|' + (year||'')
 */
function _genresCacheSheet_() {
  const ss = SpreadsheetApp.getActive();
  const name = 'GenresCache';
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function _genresCacheGet_(key) {
  const sh = _genresCacheSheet_();
  const values = sh.getDataRange().getValues(); // small sheet expected
  for (let i = 1; i < values.length; i++) {
    if ((values[i][0] || '') === key) {
      try { return JSON.parse(values[i][1] || '[]'); } catch (_) { return []; }
    }
  }
  return null;
}

function _genresCacheSet_(key, genresArray) {
  const sh = _genresCacheSheet_();
  const rng = sh.getDataRange();
  const lastRow = rng.getNumRows();
  const now = new Date().toISOString();

  // try update existing
  const values = rng.getValues();
  for (let i = 1; i < values.length; i++) {
    if ((values[i][0] || '') === key) {
      sh.getRange(i + 1, 2).setValue(JSON.stringify(genresArray || []));
      sh.getRange(i + 1, 3).setValue(now);
      return;
    }
  }
  // append new (ensure header)
  if (lastRow === 1 && !values[0][0]) {
    sh.getRange(1,1,1,3).setValues([['key','genres_json','updatedAt']]);
  }
  sh.appendRow([key, JSON.stringify(genresArray || []), now]);
}

/** Search TMDb for title → get details → return [{id,name}, ...] */
function fetchTMDbGenres(title, type, year) {
  const normTitle = String(title || '').trim();
  if (!normTitle) return [];

  const key = (normTitle.toLowerCase()) + '|' + (type || '') + '|' + (year || '');
  const cached = _genresCacheGet_(key);
  if (cached) return cached;

  try {
    // 1) search (via tmdbFetch)
    const params = { query: normTitle };
    if (year) params[type === 'tv' ? 'first_air_date_year' : 'year'] = year;
    const searchData = tmdbFetch(`/search/${type === 'tv' ? 'tv' : 'movie'}`, params);
    const first = (searchData && searchData.results && searchData.results[0]) || null;
    if (!first) { _genresCacheSet_(key, []); return []; }

    // 2) details (via tmdbFetch)
    const det = tmdbFetch(`/${type === 'tv' ? 'tv' : 'movie'}/${first.id}`);
    const genres = Array.isArray(det.genres)
      ? det.genres.map(g => ({ id: g.id, name: g.name }))
      : [];

    _genresCacheSet_(key, genres);
    return genres;
  } catch (e) {
    _genresCacheSet_(key, []);
    return [];
  }
}

/** Batch: input = [{title, type:'movie'|'tv', year?}] → returns map { idx: {genres:[{id,name}]}} */
function fetchGenresBatch(items) {
  items = Array.isArray(items) ? items : [];
  const out = {};
  items.forEach((it, idx) => {
    const genres = fetchTMDbGenres(it.title, it.type, it.year);
    out[idx] = { genres: genres || [] };
  });
  return out;
}

/** Convenience for client: from your library shape {movies:[], tv:[]} → returns {titleKey:{genres}} */
function getGenresForLibrary(library) {
  const map = {};
  if (!library) return map;
  const pack = (arr, type) => (Array.isArray(arr)?arr:[]).map(x => ({
    title: x.title || x.name || '',
    type,
    year: (x.year || x.releaseYear || '') // if you store it
  }));
  const batch = [...pack(library.movies,'movie'), ...pack(library.tv,'tv')];
  const res = fetchGenresBatch(batch);
  batch.forEach((it, i) => {
    const key = (String(it.title).trim().toLowerCase());
    map[key] = { genres: (res[i]?.genres)||[], type: it.type };
  });
  return map;
}

function getTrendingByType(type /* 'movie' | 'tv' */, page = 1, timeWindow = 'day') {
  type = (type === 'tv') ? 'tv' : 'movie';
  const pg = Math.max(1, Math.min(Number(page) || 1, 500));
  const win = (timeWindow === 'week') ? 'week' : 'day';

  const data = tmdbCachedFetch(`/trending/${type}/${win}`, {
    language: 'en-US',
    include_adult: 'false',
    page: pg
  }, {}, 600); // cache for 10 minutes

  const rows = Array.isArray(data.results) ? data.results : [];
  rows.forEach(r => r.media_type = type);
  return addPosterBasePath(filterOutAsian(rows));
}

function getTMDbDetails(id, isTV) {
  const type = isTV ? 'tv' : 'movie';
  const DETAILS_TTL = 21600; // 6 hours
  try {
    const data = tmdbCachedFetch(`/${type}/${id}`, {
      language: 'en-US',
      append_to_response: 'videos,keywords'
    }, {}, DETAILS_TTL);
    return data;
  } catch (err) {
    const m = String(err).match(/\b(\d{3})\b/);
    return { error: true, status: m ? Number(m[1]) : 500 };
  }
}

/** Lookup TMDb by title → return details with videos (tries movie, then TV) */
function getTMDbDetailsByTitle(title, year) {
  const q = String(title || '').trim();
  const yr = String(year || '').trim();
  if (!q) return { error: true, message: 'Title is required' };

  // cache ~6h to slash UrlFetchApp calls during active use
  var SEARCH_TTL = 21600; // seconds (6 hours)
  var DETAILS_TTL = 21600;

  function searchOnce(type) {
    const params = { language: 'en-US', query: q };
    if (yr) params[type === 'tv' ? 'first_air_date_year' : 'year'] = yr;
    try {
      const data = tmdbCachedFetch(`/search/${type}`, params, {}, SEARCH_TTL);
      const first = Array.isArray(data.results) && data.results.length ? data.results[0] : null;
      return first;
    } catch (err) {
      return null;
    }
  }

  // Try movie first, then TV (both cached)
  let hit = searchOnce('movie');
  let isTV = false;
  if (!hit) { hit = searchOnce('tv'); isTV = !!hit; }
  if (!hit) return { error: true, message: 'No TMDb match' };

  // Fetch details + videos for the match (cached)
  const type = isTV ? 'tv' : 'movie';
  try {
    const det = tmdbCachedFetch(`/${type}/${hit.id}`, {
      language: 'en-US',
      append_to_response: 'videos'
    }, {}, DETAILS_TTL);
    det.media_type = type;
    return det;
  } catch (err) {
    const m = String(err).match(/\b(\d{3})\b/);
    return { error: true, status: m ? Number(m[1]) : 500 };
  }
}

function addPosterBasePath(items) {
  return items.map(item => {
    item.poster = item.poster_path
    ? 'https://image.tmdb.org/t/p/w185' + item.poster_path
    : 'https://via.placeholder.com/300x450?text=No+Image';
    return item;
  });
}
function filterOutAsian(items) {
  const excludedLangs = ['zh', 'ko', 'ja', 'hi', 'ta', 'te', 'th']; 
  const excludedCountries = ['CN', 'KR', 'JP', 'IN', 'TH', 'HK', 'SG', 'TW'];

  return items.filter(item => {
    const lang = (item.original_language || '').toLowerCase();
    const countries = (item.origin_country || []).map(c => c.toUpperCase());
    return !excludedLangs.includes(lang) && countries.every(c => !excludedCountries.includes(c));
  });
}
// ----- Watch provider helpers (US region, subscription only) -----
function _normalizeProviderName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s+]+/g, ' ')   // collapse spaces
    .replace(/[^\w ]/g, '')    // drop punctuation
    .trim();
}

function tmdbDiscover(params) {
  const { __type, ...rest } = (params || {});
  if (!__type) throw new Error('tmdbDiscover: params.__type is required');

  // Cached ~15 minutes to reduce API load
  return tmdbCachedFetch(`/discover/${__type}`, rest, {}, 900);
}

// Genre-aware, provider-filtered discover
function getProviderDiscoverByGenre(page, region, genreId) {
  const pg  = Math.max(1, Math.min(Number(page) || 1, 500));
  const gid = String(genreId || '').trim();

  const common = {
    language: 'en-US',
    sort_by: 'popularity.desc',
    include_adult: 'false',
    page: pg
  };

  const MOVIE_GENRES_ONLY = new Set(['36']); // keep your existing rule if desired
  const TV_GENRES_ONLY    = new Set([]);

  const results = [];

  if (!gid || MOVIE_GENRES_ONLY.has(gid)) {
    const movieData = tmdbDiscover({ __type: 'movie', ...common, with_genres: gid || undefined });
    results.push(...(movieData.results || []));
  }
  if (!gid || TV_GENRES_ONLY.has(gid)) {
    const tvData = tmdbDiscover({ __type: 'tv', ...common, with_genres: gid || undefined });
    results.push(...(tvData.results || []));
  }

  const items = addPosterBasePath(filterOutAsian(results || []));
  return items;
}

function getPopularByProviders(type /* 'movie' | 'tv' */, page, region) {
  type   = (type === 'tv') ? 'tv' : 'movie';
  page   = page   || 1;
  region = region || 'US';

  const providersPipe = _getProviderIdsPipe(type, region);
  const STEPS = (type === 'tv') ? [200, 100, 50, 25] : [350, 200, 100, 50];

  for (const minVotes of STEPS) {
    const params = {
      __type: type,
      language: 'en-US',
      include_adult: 'false',
      sort_by: 'vote_average.desc',
      page: Math.max(1, Math.min(Number(page) || 1, 500)),
      'vote_count.gte': minVotes,
      watch_region: region,
      with_watch_monetization_types: 'flatrate',
      with_watch_providers: providersPipe || undefined
    };
    try {
      const data = tmdbDiscover(params);
      const rows = Array.isArray(data.results) ? data.results : [];
      if (rows.length) {
        rows.forEach(r => r.media_type = type);
        return addPosterBasePath(filterOutAsian(rows));
      }
    } catch (_) {}
  }
  return [];
}

function getProviderDiscoverByGenreType(type /* 'movie' | 'tv' */, page, region, genreId) {
  type   = (type === 'tv') ? 'tv' : 'movie';
  page   = page   || 1;
  region = region || 'US';
  const gid = String(genreId || '').trim();

  const apiKey = getScriptPropertyOrThrow('TMDB_API_KEY');

  // start stricter, then loosen to avoid empty lists
  const STEPS = (type === 'tv')
    ? [200, 100, 50, 25]
    : [350, 200, 100, 50];

  const providersPipe = _getProviderIdsPipe(type, region); // may be ''
  const common = {
    __type: type,
    language: 'en-US',
    include_adult: 'false',
    include_video: 'false',
    sort_by: 'vote_average.desc',
    page: Math.max(1, Math.min(Number(page) || 1, 500)),
    with_genres: gid || undefined,
    watch_region: region,
    with_watch_monetization_types: 'flatrate'
  };
  if (providersPipe) common.with_watch_providers = providersPipe;

  for (const minVotes of STEPS) {
    const params = { ...common, 'vote_count.gte': minVotes };
    try {
      const data = tmdbDiscover(params);
      const rows = Array.isArray(data.results) ? data.results : [];
      if (rows.length) {
        rows.forEach(r => r.media_type = type);
        return addPosterBasePath(filterOutAsian(rows));
      }
    } catch (_) {}
  }

  // final fallback (very loose)
  try {
    const params = { ...common, 'vote_count.gte': 0 };
    const data = tmdbDiscover(params);
    const rows = Array.isArray(data.results) ? data.results : [];
    rows.forEach(r => r.media_type = type);
    return addPosterBasePath(filterOutAsian(rows));
  } catch (e) {
    return [];
  }
}

function getCombinedPopular(page = 1) {
  const pg = Math.max(1, Math.min(Number(page) || 1, 500));
  return {
    movies: getPopularMovies(pg),
    tv: getPopularTVShows(pg)
  };
}
function addToWishlistSheet(title, poster) {
  try {
    const sheetId = getScriptPropertyOrThrow('WISHLIST_SHEET_ID');
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Titles');
    if (!sheet) throw new Error("Wishlist sheet not found");

    const lastRow = sheet.getLastRow();
    let data = [];
    if (lastRow > 1) {
      // Title (col A), Status (col B), Poster (col C)
      data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    }

    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === title.toLowerCase()) {
        // ✅ status is in column B (index 1), not column C (index 2)
        const status = String(data[i][1]);
        if (status === "Wishlist") {
          return { status: "requested", title };
        } else if (status === "Available") {
          return { status: "added", title };
        }
        return { status: "requested", title };
      }
    }

    // ✅ write "Wishlist" so the reader can find it
    sheet.appendRow([title, "Wishlist", poster]);

    return { status: "added", title };
  } catch (error) {
    throw new Error(error.message);
  }
}
function getRequestedWishlist() {
  const sheetId = getScriptPropertyOrThrow('WISHLIST_SHEET_ID');
  const SHEET_NAME = 'Titles';

  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) return [];

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(h => String(h).trim().toLowerCase());

  const titleCol  = headers.indexOf('title') + 1;
  const statusCol = headers.indexOf('status') + 1;
  const posterCol = headers.indexOf('poster') + 1; // optional

  if (!titleCol || !statusCol) {
    return [];
  }

  const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues().map(r => {
    const title  = String(r[titleCol - 1] || '').trim();
    const status = String(r[statusCol - 1] || '').trim().toLowerCase();
    const poster = posterCol ? String(r[posterCol - 1] || '').trim() : '';
    return { title, status, poster };
  });

  // Accept both "wishlist" and legacy "requested"
  const wanted = new Set(['wishlist', 'requested']);

  return rows
    .filter(r => r.title && wanted.has(r.status))
    .map(({ title, poster }) => ({ title, poster }));
}
function getRecentVideos(days = 14) {
  const rootFolderId = getScriptPropertyOrThrow('ROOT_FOLDER_ID');
  const rootFolder = DriveApp.getFolderById(rootFolderId);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const categories = ['Movies', 'TV Shows'];
  const recentVideosMap = {};

  categories.forEach(cat => {
    const folderIterator = rootFolder.getFoldersByName(cat);
    if (!folderIterator.hasNext()) return;
    const categoryFolder = folderIterator.next();
    const subfolders = categoryFolder.getFolders();

    while (subfolders.hasNext()) {
      const folder = subfolders.next();

      let hasRecentFile = false;
      let poster = '';
      const videos = [];
      let newestTime = 0;

      const files = folder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        const name = String(file.getName() || '').toLowerCase();

        if (!poster && isPosterName(name)) {
          poster = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w300';
        }

        if (/\.(mp4|mov|mkv)$/i.test(name)) {
          videos.push({
            title: file.getName().replace(/\.(mp4|mov|mkv)$/i, ''),
            url: `https://drive.google.com/file/d/${file.getId()}/preview`
          });
        }

        const updated = file.getLastUpdated();
        if (!hasRecentFile && updated >= cutoffDate) {
          hasRecentFile = true;
        }

        // track newest file timestamp for sorting
        if (updated.getTime() > newestTime) {
          newestTime = updated.getTime();
        }
      }

      if (hasRecentFile) {
        recentVideosMap[folder.getName()] = {
          title: folder.getName(),
          poster: poster || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(folder.getName()),
          episodes: videos,
          newestTime // store for sorting
        };
      }
    }
  });

  // sort newest first
  return Object.values(recentVideosMap).sort((a, b) => b.newestTime - a.newestTime);
}

function getWishlistAllWithStatus() {
  const sheetId = getScriptPropertyOrThrow('WISHLIST_SHEET_ID');
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName('Titles');
  if (!sheet) throw new Error("Wishlist sheet not found");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

  return data.map(row => ({
    title: row[0],
    status: row[1],
    poster: row[2]
  }));
}

function syncWishlistStatusWithDrive() {
  const sheetId = getScriptPropertyOrThrow('WISHLIST_SHEET_ID');
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName('Titles');
  if (!sheet) throw new Error("Titles sheet not found");

  const lastRow = sheet.getLastRow();
  const data = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, 3).getValues();

  // Build a map of existing titles in the sheet (lowercased)
  const sheetMap = new Map();
  data.forEach((row, i) => {
    const title = row[0]?.toLowerCase().trim();
    if (title) {
      sheetMap.set(title, {
        row: i + 2,
        status: row[1],
        poster: row[2]
      });
    }
  });

  // Get titles from Drive (both Movies and TV)
  const libraryData = getLibraryData(); // returns { movies: [], tv: [] }
  // merge both arrays into one list
  const driveTitles = [...(libraryData.movies || []), ...(libraryData.tv || [])];

  // Track updates
  const statusUpdates = [];
  const posterUpdates = [];

  driveTitles.forEach(item => {
    const titleKey = item.title.toLowerCase().trim();
    const poster = item.poster;

    if (sheetMap.has(titleKey)) {
      const existing = sheetMap.get(titleKey);

      // Update status if needed
      if (existing.status !== "Available") {
        statusUpdates.push({ row: existing.row, status: "Available" });
      }

      // Update poster if different
      if (existing.poster !== poster) {
        posterUpdates.push({ row: existing.row, poster });
      }
    } else {
      // Not in sheet — add it
      sheet.appendRow([item.title, "Available", poster]);
    }
  });

  // Apply status updates
  statusUpdates.forEach(update => {
    sheet.getRange(update.row, 2).setValue(update.status);
  });

  // Apply poster updates
  posterUpdates.forEach(update => {
    sheet.getRange(update.row, 3).setValue(update.poster);
  });
}

function getDiscoverByGenreTypeProviders(type, page, region, genreId) {
  type   = (type === 'tv') ? 'tv' : 'movie';
  page   = Math.max(1, Math.min(Number(page) || 1, 500));
  region = region || 'US';
  const gid = String(genreId || '').trim();

  const providersPipe = _getProviderIdsPipe(type, region); // may be ''

  // start stricter, then loosen to avoid empty lists
  const STEPS = (type === 'tv') ? [200, 100, 50, 25] : [350, 200, 100, 50];

  const common = {
    __type: type,
    language: 'en-US',
    include_adult: 'false',
    include_video: 'false',
    sort_by: 'vote_average.desc',
    page,
    with_genres: gid || undefined,
    watch_region: region,
    with_watch_monetization_types: 'flatrate'
  };
  if (providersPipe) common.with_watch_providers = providersPipe;

  for (const minVotes of STEPS) {
    const params = { ...common, 'vote_count.gte': minVotes };
    try {
      const data = tmdbDiscover(params);
      const rows = Array.isArray(data.results) ? data.results : [];
      if (rows.length) {
        rows.forEach(r => r.media_type = type);
        return addPosterBasePath(filterOutAsian(rows));
      }
    } catch (_) {}
  }

  // last, very loose pass
  try {
    const params = { ...common, 'vote_count.gte': 0 };
    const data = tmdbDiscover(params);
    const rows = Array.isArray(data.results) ? data.results : [];
    rows.forEach(r => r.media_type = type);
    return addPosterBasePath(filterOutAsian(rows));
  } catch (e) {
    return [];
  }
}

function getDiscoverByGenreType(type, page, region, genreId) {
  type   = (type === 'tv') ? 'tv' : 'movie';
  page   = Math.max(1, Math.min(Number(page) || 1, 500));
  region = region || 'US';
  const gid = String(genreId || '').trim();

  const params = {
    __type: type,
    language: 'en-US',
    include_adult: 'false',
    include_video: 'false',
    sort_by: 'vote_average.desc',
    page,
    with_genres: gid || undefined,
    'vote_count.gte': (type === 'tv') ? 150 : 250
  };

  const data = tmdbDiscover(params);
  const rows = Array.isArray(data.results) ? data.results : [];
  rows.forEach(r => r.media_type = type);
  return addPosterBasePath(filterOutAsian(rows));
}

// Super-simple fallback
function getProviderPopular(type, page, region) {
  type = (type === 'tv') ? 'tv' : 'movie';
  const pg  = Math.max(1, Math.min(Number(page) || 1, 500));
  const reg = region || 'US';
  const providersPipe = _getProviderIdsPipe(type, reg);

  const params = {
    __type: type,
    language: 'en-US',
    include_adult: 'false',
    page: pg,
    sort_by: 'popularity.desc',
    'vote_count.gte': (type === 'tv') ? 100 : 200,
    watch_region: reg,
    with_watch_monetization_types: 'flatrate',
    with_watch_providers: providersPipe || undefined
  };

  const data = tmdbDiscover(params);
  const rows = Array.isArray(data.results) ? data.results : [];
  rows.forEach(r => r.media_type = type);
  return addPosterBasePath(filterOutAsian(rows));
}

function getLibraryAndSyncWishlist() {
  const library = getLibraryData();
  syncWishlistStatusWithDrive();
  return library;
}

/**
 * Return a random sample from a cached library snapshot (fast).
 * Cache TTL: 10 minutes (tune as needed).
 */
function getRandomLibrarySample(limit) {
  limit = Math.max(1, Math.min(Number(limit) || 10, 50));

  var cache = CacheService.getScriptCache();
  var ver = PropertiesService.getScriptProperties().getProperty('LIBRARY_CACHE_VERSION') || '1';
  var cacheKey = 'LIBRARY_SNAPSHOT_v' + ver;
  var raw = cache.get(cacheKey);

  if (!raw) {
    var lib = getLibraryAndSyncWishlist(); // heavy once if cache cold
    raw = JSON.stringify(lib || { movies:[], tv:[] });
    cache.put(cacheKey, raw, 600);
  }

  var libObj = JSON.parse(raw);
  var merged = [].concat(libObj.movies || [], libObj.tv || []);
  if (!merged.length) return [];

  // Fisher-Yates
  for (var i = merged.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = merged[i]; merged[i] = merged[j]; merged[j] = tmp;
  }
  return merged.slice(0, limit);
}

/**
 * Optional: rebuild and warm the cache now.
 */
function warmLibraryCacheNow() {
  var lib = getLibraryAndSyncWishlist(); // heavy once
  var cache = CacheService.getScriptCache();
  cache.put('LIBRARY_SNAPSHOT_V1', JSON.stringify(lib || { movies:[], tv:[] }), 600);
  return { ok: true, count: (lib.movies||[]).length + (lib.tv||[]).length };
}

function bumpLibraryCacheVersion() {
  const props = PropertiesService.getScriptProperties();
  let cur = parseInt(props.getProperty('LIBRARY_CACHE_VERSION') || '1', 10);
  if (isNaN(cur)) cur = 1;
  cur += 1;
  props.setProperty('LIBRARY_CACHE_VERSION', String(cur));
  return 'LIBRARY_CACHE_VERSION bumped to ' + cur;
}

function getContinueWatching(profileName) {
  const sheetId = getScriptPropertyOrThrow('WISHLIST_SHEET_ID');
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName('Profiles');
  if (!sheet) throw new Error("Profiles sheet not found");

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(h => String(h).trim().toLowerCase());

  const findCol = (names) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i !== -1) return i + 1;
    }
    return 0;
  };

  const profileCol = findCol(['profile']);
  const titleCol   = findCol(['title']);
  const episodeCol = findCol(['episode', 'episode title', 'episodetitle']);
  const updatedCol = findCol(['updatedat', 'updated', 'updated_at']); // may be 0 if legacy

  if (!profileCol || !titleCol) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const items = rows
    .filter(r => String(r[profileCol - 1]).trim().toLowerCase() === String(profileName).trim().toLowerCase())
    .map(r => ({
      profile: r[profileCol - 1],
      title:   r[titleCol   - 1],
      episode: episodeCol ? (r[episodeCol - 1] || '') : '',
      updatedAt: updatedCol ? String(r[updatedCol - 1] || '') : '' // ISO string if present
    }));

  // Sort newest first (fallback to 0 when missing)
  items.sort((a, b) => {
    const ta = Date.parse(a.updatedAt || '') || 0;
    const tb = Date.parse(b.updatedAt || '') || 0;
    return tb - ta;
  });

  return items;
}

function saveProfileProgress(profile, fullTitle, episode /* , time */) {
  const sheetId = getScriptPropertyOrThrow('WISHLIST_SHEET_ID');
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName('Profiles');
  if (!sheet) throw new Error("'Profiles' sheet not found");

  const baseTitle = String(fullTitle || '').split(/\s*-\s*/)[0].trim();
  const epTitle   = String(episode || '').trim();
  const profKey   = String(profile || '').trim().toLowerCase();

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const headers = (lastCol > 0)
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim().toLowerCase())
    : [];

  const findCol = (names) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i !== -1) return i + 1;
    }
    return 0;
  };

  // Ensure headers: A=Profile, B=Title, C=Episode, D=UpdatedAt
  let profileCol = findCol(['profile']) || 1;
  let titleCol   = findCol(['title'])   || 2;
  let episodeCol = findCol(['episode','episode title','episodetitle']) || 3;
  let updatedCol = findCol(['updatedat','updated','updated_at']) || 4;

  if (lastRow === 0) sheet.insertRowBefore(1);
  // Write headers if missing
  if (!headers.length) {
    sheet.getRange(1, 1, 1, 4).setValues([['Profile','Title','Episode','UpdatedAt']]);
  } else {
    if (!findCol(['profile']))    sheet.getRange(1, profileCol).setValue('Profile');
    if (!findCol(['title']))      sheet.getRange(1, titleCol).setValue('Title');
    if (!findCol(['episode','episode title','episodetitle'])) sheet.getRange(1, episodeCol).setValue('Episode');
    if (!findCol(['updatedat','updated','updated_at'])) {
      updatedCol = Math.max(lastCol, 4);
      sheet.getRange(1, updatedCol).setValue('UpdatedAt');
    }
  }

  const widest = Math.max(profileCol, titleCol, episodeCol, updatedCol);
  const data = (sheet.getLastRow() >= 2)
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, widest).getValues()
    : [];

  const rowIndex = data.findIndex(r =>
    String(r[profileCol - 1] || '').trim().toLowerCase() === profKey &&
    String(r[titleCol   - 1] || '').trim().toLowerCase() === baseTitle.toLowerCase()
  );

  const nowIso = new Date().toISOString();

  if (rowIndex >= 0) {
    const updateRow = rowIndex + 2;
    sheet.getRange(updateRow, episodeCol).setValue(epTitle);
    sheet.getRange(updateRow, updatedCol).setValue(nowIso);
  } else {
    const newRow = Array(widest).fill('');
    newRow[profileCol - 1] = profile;
    newRow[titleCol   - 1] = baseTitle;
    newRow[episodeCol - 1] = epTitle;
    newRow[updatedCol - 1] = nowIso;
    sheet.appendRow(newRow);
  }
}

/**
 * Deletes all "Continue Watching" rows matching a profile + title.
 * Assumes sheet columns: A=Profile, B=Title, C=Episode (optional)
 * Returns {deleted: number}
 */
function clearProfileProgress(profile, title) {
  if (!profile || !title) throw new Error('Missing profile or title');

  const sheetId = getScriptPropertyOrThrow('WISHLIST_SHEET_ID');
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName('Profiles');
  if (!sh) throw new Error('Sheet "Profiles" not found');

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { deleted: 0 };

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(h => String(h).trim().toLowerCase());

  const findCol = (names) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i !== -1) return i + 1; // 1-based
    }
    return 0;
  };

  const profileCol = findCol(['profile']);
  const titleCol   = findCol(['title']);

  if (!profileCol || !titleCol) return { deleted: 0 };

  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // collect 1-based row numbers to delete
  const toDelete = [];
  const pKey = String(profile).trim().toLowerCase();
  const tKey = String(title).trim().toLowerCase();

  values.forEach((row, idx) => {
    const p = String(row[profileCol - 1] || '').trim().toLowerCase();
    const t = String(row[titleCol   - 1] || '').trim().toLowerCase();
    if (p === pKey && t === tKey) toDelete.push(idx + 2);
  });

  for (let i = toDelete.length - 1; i >= 0; i--) {
    sh.deleteRow(toDelete[i]);
  }

  return { deleted: toDelete.length };
}
