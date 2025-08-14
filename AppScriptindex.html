// !DOCTYPE Code.gs

function doGet(e) {
  // Optional: Serve JSON data via API if action=api
  if (e && e.parameter && e.parameter.action === 'api') {
    const data = getLibraryData();
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*'); // Allow external API calls if needed
  }

  // Default: Serve the frontend HTML (index.html)
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('My Movie Browser')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) // Embed in iframe if needed
    .setSandboxMode(HtmlService.SandboxMode.IFRAME); // Recommended for google.script.run to work
}

function pingWishlistVersion() {
  // Bump this string anytime you redeploy to confirm it’s the version you expect.
  return 'wishlist-ping v1 ' + new Date().toISOString();
}
function debugWishlistSnapshot() {
  const SPREADSHEET_ID = '17AAXIsNI2HACunSc1lJ46azCPIqzLwnadnEB2UzFwIM';
  const SHEET_NAME = 'Titles';

  const out = { sheetFound: false, lastRow: 0, lastCol: 0, headers: [], preview: [] };
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) return out;

    out.sheetFound = true;
    out.lastRow = sh.getLastRow();
    out.lastCol = sh.getLastColumn();

    if (out.lastRow >= 1 && out.lastCol >= 1) {
      out.headers = sh.getRange(1, 1, 1, out.lastCol).getValues()[0].map(String);
    }
    if (out.lastRow > 1) {
      const rowsToShow = Math.min(out.lastRow - 1, 5);
      out.preview = sh.getRange(2, 1, rowsToShow, out.lastCol).getValues();
    }
  } catch (e) {
    out.error = String(e);
  }
  return out;
}
// Stream Video with Range Support
function streamVideo(fileId, e) {
  try {
    const file = DriveApp.getFileById(fileId);
    if (!file.getSharingAccess || file.getSharingAccess() === DriveApp.Access.NONE) {
      return HtmlService.createHtmlOutput("Access denied");
    }
    const blob = file.getBlob();

    return HtmlService.createHtmlOutput(blob)
      .setMimeType(blob.getContentType())
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput("Error: " + err.message);
  }
}

// Build Movie/TV JSON by processing Drive folders
function processCategory(categoryFolder) {
  const results = [];

  const isPoster = n =>
    n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.webp');

  const getPosterFromFolder = (folder) => {
    const files = folder.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      if (isPoster(f.getName().toLowerCase())) {
        return 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w300';
      }
    }
    return '';
  };

  const getVideosFromFolder = (folder) => {
    const out = [];
    const files = folder.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      const n = f.getName().toLowerCase();
      if (/\.(mp4|mov|mkv)$/i.test(n)) {
        out.push({
          title: f.getName().replace(/\.(mp4|mov|mkv)$/i, ''),
          url: `https://drive.google.com/file/d/${f.getId()}/preview`
        });
      }
    }
    return out;
  };

  const subfolders = categoryFolder.getFolders();
  while (subfolders.hasNext()) {
    const titleFolder = subfolders.next();   // e.g. "The Lord of the Rings"
    const title = titleFolder.getName();

    // 1) Always scan CHILD FOLDERS first (episodes-as-folders)
    const childEpisodes = [];
    const children = titleFolder.getFolders();
    while (children.hasNext()) {
      const epFolder = children.next();      // e.g. "The Two Towers"
      const vids = getVideosFromFolder(epFolder);
      if (vids.length > 0) {
        const epPoster = getPosterFromFolder(epFolder);
        childEpisodes.push({
          title: epFolder.getName(),
          url: vids[0].url, // first playable
          poster: epPoster || ''  // leave empty; frontend will fall back to parent
        });
      }
    }

    const parentPoster = getPosterFromFolder(titleFolder);

    if (childEpisodes.length > 0) {
      // Prefer series/collection if any child folder has a video — regardless of parent poster/files
      results.push({
        title,
        poster: parentPoster || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(title),
        type: 'movie-series',
        episodes: childEpisodes
      });
      continue;
    }

    // 2) Otherwise, fall back to videos directly in the title folder
    const directVideos = getVideosFromFolder(titleFolder);
    results.push({
      title,
      poster: parentPoster || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(title),
      type: directVideos.length > 1 ? 'tv' : 'movie',
      episodes: directVideos
    });
  }

  return results;
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

function getLibrary() {
  return getLibraryData();
}

// TMDB
function addPosterBasePath(items) {
  return items.map(item => {
    item.poster = item.poster_path
      ? 'https://image.tmdb.org/t/p/w300' + item.poster_path
      : 'https://via.placeholder.com/300x450?text=No+Image';
    return item;
  });
}
function getPopularMovies(page = 1) {
  const apiKey = '48f719a14913f9d4ee92c684c2187625';
  const url = `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=en-US&page=${page}`;
  const response = UrlFetchApp.fetch(url);
  const data = JSON.parse(response.getContentText());
  return addPosterBasePath(data.results);
}
function getPopularTVShows(page = 1) {
  const apiKey = '48f719a14913f9d4ee92c684c2187625';
  const url = `https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&language=en-US&page=${page}`;
  const response = UrlFetchApp.fetch(url);
  const data = JSON.parse(response.getContentText());
  return addPosterBasePath(data.results);
}
function getCombinedPopular(page = 1) {
  return {
    movies: getPopularMovies(page),
    tv: getPopularTVShows(page)
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
function getRecentVideos(days = 7) {
  const deploymentId = 'AKfycbyBnamMid90A6xc7rvm47w9R4NF5SYpBOdreX6gCs9A4xcXtVUNYmZ14lqGA2h8Jp4zxw';

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
      const files = folder.getFiles();

      let hasRecentFile = false;
      let poster = '';
      let videos = [];

      while (files.hasNext()) {
        const file = files.next();
        const name = file.getName().toLowerCase();

        if (!poster && (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg'))) {
          poster = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w300';
        } else if (/\.(mp4|mov|mkv)$/i.test(name)) {
          videos.push({
            title: file.getName().replace(/\.(mp4|mov|mkv)$/i, ''),
            url: `https://drive.google.com/file/d/${file.getId()}/preview`
          });
        }
      }

      const filesForDateCheck = folder.getFiles();
      while (filesForDateCheck.hasNext()) {
        const file = filesForDateCheck.next();
        if (file.getLastUpdated() >= cutoffDate) {
          hasRecentFile = true;
          break;
        }
      }

      if (hasRecentFile) {
        recentVideosMap[folder.getName()] = {
          title: folder.getName(),
          poster: poster || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(folder.getName()),
          episodes: videos  // Always assign videos array here
        };
      }
    }
  });

  return Object.values(recentVideosMap);
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

  if (!profileCol || !titleCol) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return rows
    .filter(r => String(r[profileCol - 1]).trim().toLowerCase() === String(profileName).trim().toLowerCase())
    .map(r => ({
      profile: r[profileCol - 1],
      title:   r[titleCol   - 1],
      episode: episodeCol ? (r[episodeCol - 1] || '') : ''
    }));
}

function saveProfileProgress(profile, fullTitle, episode /* , time */) {
  const SPREADSHEET_ID = '17AAXIsNI2HACunSc1lJ46azCPIqzLwnadnEB2UzFwIM';
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Profiles');
  if (!sheet) throw new Error("'Profiles' sheet not found");

  // Normalize
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

  // Require Profile & Title; Episode optional (we'll append if missing)
  let profileCol = findCol(['profile']);
  let titleCol   = findCol(['title']);
  let episodeCol = findCol(['episode', 'episode title', 'episodetitle']);

  // If headers missing, create them in order A:Profile B:Title C:Episode
  if (!profileCol || !titleCol) {
    if (lastRow === 0) sheet.insertRowBefore(1);
    sheet.getRange(1, 1).setValue('Profile');
    sheet.getRange(1, 2).setValue('Title');
    sheet.getRange(1, 3).setValue('Episode');
    profileCol = 1; titleCol = 2; episodeCol = 3;
  } else if (!episodeCol) {
    // Add an Episode header if not present
    episodeCol = lastCol + 1;
    sheet.getRange(1, episodeCol).setValue('Episode');
  }

  const data = (lastRow >= 2) ? sheet.getRange(2, 1, lastRow - 1, Math.max(lastCol, episodeCol)).getValues() : [];

  const rowIndex = data.findIndex(r =>
    String(r[profileCol - 1] || '').trim().toLowerCase() === profKey &&
    String(r[titleCol   - 1] || '').trim().toLowerCase() === baseTitle.toLowerCase()
  );

  if (rowIndex >= 0) {
    const updateRow = rowIndex + 2;
    sheet.getRange(updateRow, episodeCol).setValue(epTitle);
  } else {
    const newRow = Array(Math.max(lastCol, episodeCol)).fill('');
    newRow[profileCol - 1] = profile;
    newRow[titleCol   - 1] = baseTitle;
    newRow[episodeCol - 1] = epTitle;
    sheet.appendRow(newRow);
  }
}

function testSave() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ss.getSheets().map(s => s.getName());
  Logger.log("Sheet names: " + sheetNames.join(", "));

  // Try exact match
  const exact = ss.getSheetByName("Profiles");
  Logger.log("Exact match for 'Profiles': " + (exact ? "✅ FOUND" : "❌ NOT FOUND"));

  // Try fuzzy match
  const fuzzy = sheetNames.find(n => n.toLowerCase().includes("profile"));
  Logger.log("Fuzzy match: " + fuzzy);
}

function testBound() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("ss is null: " + (ss === null));
  const names = ss.getSheets().map(s => s.getName());
  Logger.log("Sheet names: " + names.join(", "));
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
