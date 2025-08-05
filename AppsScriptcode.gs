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
  const subfolders = categoryFolder.getFolders();

  while (subfolders.hasNext()) {
    const folder = subfolders.next();
    const title = folder.getName();
    const files = folder.getFiles();
    let poster = '';
    const videos = [];

    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName().toLowerCase();

      if ((name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) && !poster) {
        poster = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w300';
      } else if (/\.(mp4|mov|mkv)$/i.test(name)) {
        videos.push({
          title: file.getName().replace(/\.(mp4|mov|mkv)$/i, ''),
          url: `https://drive.google.com/file/d/${file.getId()}/preview`
        });
      }
    }

    results.push({
      title: title,
      poster: poster || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(title),
      type: videos.length > 1 ? 'tv' : 'movie',
      episodes: videos
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
      data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    }

    for (let i = 0; i < data.length; i++) {
      if (data[i][0].toString().toLowerCase() === title.toLowerCase()) {
        const status = data[i][2];
        if (status === "Wishlist") {
          return { status: "requested", title };
        } else if (status === "Available") {
          return { status: "added", title };
        }
        return { status: "requested", title };
      }
    }

    const timestamp = new Date();
    sheet.appendRow([title, "Requested", poster]);

    return { status: "added", title };
  } catch (error) {
    throw new Error(error.message);
  }
}
function getRequestedWishlist() {
  const ss = SpreadsheetApp.openById('17AAXIsNI2HACunSc1lJ46azCPIqzLwnadnEB2UzFwIM');
  const sheet = ss.getSheetByName('Titles');
  if (!sheet) throw new Error("Wishlist sheet not found");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

  return data.filter(row => row[2] === "Wishlist")
    .map(row => ({
      title: row[0],
      poster: row[3]
    }));
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
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues(); // [Profile, Title, Episode, Time]

  const filtered = data.filter(row => {
    return String(row[0]).toLowerCase().trim() === profileName.toLowerCase().trim();
  });

  if (!filtered.length) return [];

  return filtered.map(row => ({
    profile: row[0],
    title: row[1],
    episode: row[2] || '',
    time: parseFloat(row[3]) || 0
  }));
}

function saveProfileProgress(profile, fullTitle, episode, time) {
  const SPREADSHEET_ID = '17AAXIsNI2HACunSc1lJ46azCPIqzLwnadnEB2UzFwIM';
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Profiles");
  if (!sheet) throw new Error("'Profiles' sheet not found");

  const lastWatched = new Date();
  const lastRow = sheet.getLastRow();
  let existing = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 4).getValues() : [];

  const titleParts = fullTitle.split(/\s*-\s*/);
  const baseTitle = titleParts[0].trim();
  const epTitle = titleParts[1] ? titleParts[1].trim() : "";

  const rowIndex = existing.findIndex(row =>
    (row[0] || '').toLowerCase().trim() === profile.toLowerCase().trim() &&
    (row[1] || '').toLowerCase().trim() === baseTitle.toLowerCase()
  );

  if (rowIndex >= 0) {
    const updateRow = rowIndex + 2;
    sheet.getRange(updateRow, 3, 1, 2).setValues([[epTitle, lastWatched]]);
  } else {
    sheet.appendRow([profile, baseTitle, epTitle, lastWatched]);
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
