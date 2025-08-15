// !DOCTYPE Code.gs

// ---- TMDB KEY (single source of truth)
const TMDB_API_KEY = '48f719a14913f9d4ee92c684c2187625';

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
  const rootFolderId = '1fX26oP26OtJ0aO_q3wl3u1CYrR4t6JO1'; // your root
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
  const rootFolderId = '1fX26oP26OtJ0aO_q3wl3u1CYrR4t6JO1'; // Replace with your Drive root folder ID
  const rootFolder = DriveApp.getFolderById(rootFolderId);

  // Assuming folders named 'Movies' and 'TV' inside root folder
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
  const apiKey = PropertiesService.getScriptProperties().getProperty('TMDB_API_KEY');
  const cache  = CacheService.getScriptCache();
  const key    = `wp:${type}:${region}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const url = `https://api.themoviedb.org/3/watch/providers/${type}` +
              `?api_key=${encodeURIComponent(apiKey)}` +
              `&watch_region=${encodeURIComponent(region)}`;

  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) return '';

  const data = JSON.parse(resp.getContentText() || '{}');
  const results = Array.isArray(data.results) ? data.results : [];

  const ids = results
  .filter(r => _wantedProviderPred(r.provider_name))
  .map(r => String(r.provider_id))
  .filter(Boolean);

  const pipe = ids.join('|');          // e.g. "8|9|15"
  if (pipe) cache.put(key, pipe, 3600); // cache 1 hour
  return pipe;
}

function _wantedProviderPred(name) {
  const n = _normalizeProviderNameForMatch(name);
  return WANTED_PROVIDER_NAMES.some(w => n === _normalizeProviderNameForMatch(w));
}

function getTrendingNow(mediaType = "all", timeWindow = "day", page = 1) {
  const type = encodeURIComponent(mediaType);
  const window = encodeURIComponent(timeWindow);
  const pg = Math.max(1, Math.min(Number(page) || 1, 500));
  const url = `https://api.themoviedb.org/3/trending/${type}/${window}?api_key=${encodeURIComponent(TMDB_API_KEY)}&language=en-US&page=${pg}&include_adult=false`;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error(`TMDb Trending error: ${code}`);
  const data = JSON.parse(response.getContentText());
  return addPosterBasePath(filterOutAsian(data.results || []));
}

function getTMDbDetails(id, isTV) {
  const type = isTV ? 'tv' : 'movie';
  const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${encodeURIComponent(TMDB_API_KEY)}&language=en-US&append_to_response=videos,keywords`;
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) return { error: true, status: code };
  return JSON.parse(resp.getContentText());
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
  // use the constant
  const q = Object.entries(params)
    .filter(([,v]) => v !== undefined && v !== null && v !== '')
    .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `https://api.themoviedb.org/3/discover/${params.__type}?api_key=${encodeURIComponent(TMDB_API_KEY)}&${q}`;
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) throw new Error(`TMDb discover ${params.__type} ${code}`);
  return JSON.parse(resp.getContentText());
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

  const apiKey = PropertiesService.getScriptProperties().getProperty('TMDB_API_KEY');
  if (!apiKey) throw new Error('TMDB_API_KEY missing');

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
    const ss = SpreadsheetApp.openById('17AAXIsNI2HACunSc1lJ46azCPIqzLwnadnEB2UzFwIM');
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
  // Reads headers to find: Title / Status / Poster (order doesn’t matter)
  const SPREADSHEET_ID = '17AAXIsNI2HACunSc1lJ46azCPIqzLwnadnEB2UzFwIM';
  const SHEET_NAME = 'Titles';

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
function getRecentVideos(days = 14) { // <-- changed default to 14
  const rootFolderId = '1fX26oP26OtJ0aO_q3wl3u1CYrR4t6JO1';
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
  const ss = SpreadsheetApp.openById('17AAXIsNI2HACunSc1lJ46azCPIqzLwnadnEB2UzFwIM');
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
  const ss = SpreadsheetApp.openById('17AAXIsNI2HACunSc1lJ46azCPIqzLwnadnEB2UzFwIM');
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
  const driveTitles = [...libraryData.movies, ...libraryData.tv];

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

function getContinueWatching(profileName) {
  const ss = SpreadsheetApp.openById('17AAXIsNI2HACunSc1lJ46azCPIqzLwnadnEB2UzFwIM');
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
  const SPREADSHEET_ID = '17AAXIsNI2HACunSc1lJ46azCPIqzLwnadnEB2UzFwIM';
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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

  const ss = SpreadsheetApp.openById('17AAXIsNI2HACunSc1lJ46azCPIqzLwnadnEB2UzFwIM');
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
