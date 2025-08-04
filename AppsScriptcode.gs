function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'api') {
    const data = getLibraryData();
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*');
  }

  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('My Movie Browser')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setSandboxMode(HtmlService.SandboxMode.NONE);
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
    const sheet = ss.getSheetByName('Wishlist');
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
    sheet.appendRow([title, timestamp, "Requested", poster]);

    return { status: "added", title };
  } catch (error) {
    throw new Error(error.message);
  }
}
function getRequestedWishlist() {
  const ss = SpreadsheetApp.openById('17AAXIsNI2HACunSc1lJ46azCPIqzLwnadnEB2UzFwIM');
  const sheet = ss.getSheetByName('Wishlist');
  if (!sheet) throw new Error("Wishlist sheet not found");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

  return data.filter(row => row[2] === "Wishlist")
    .map(row => ({
      title: row[0],
      poster: row[3]
    }));
}
function getRecentVideos(days = 30) {
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
  const sheet = ss.getSheetByName('Wishlist');
  if (!sheet) throw new Error("Wishlist sheet not found");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

  return data.map(row => ({
    title: row[0],
    status: row[2],
    poster: row[3]
  }));
}

function syncWishlistStatusWithDrive() {
  const ss = SpreadsheetApp.openById('17AAXIsNI2HACunSc1lJ46azCPIqzLwnadnEB2UzFwIM');
  const sheet = ss.getSheetByName('Wishlist');
  if (!sheet) throw new Error("Wishlist sheet not found");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return; // Nothing to update

  // Get wishlist data: [title, timestamp, status, poster]
  const dataRange = sheet.getRange(2, 1, lastRow - 1, 4);
  const data = dataRange.getValues();

  // Get all titles currently in Drive library (movies + tv)
  const libraryData = getLibraryData(); // returns {movies: [], tv: []}
  const driveTitlesSet = new Set();
  libraryData.movies.forEach(item => driveTitlesSet.add(item.title.toLowerCase()));
  libraryData.tv.forEach(item => driveTitlesSet.add(item.title.toLowerCase()));

  // Prepare array for status updates
  const updates = [];

  for (let i = 0; i < data.length; i++) {
    const title = data[i][0];
    const currentStatus = data[i][2];
    const titleLower = title.toLowerCase();

    if (driveTitlesSet.has(titleLower)) {
      // If found in Drive library and status not yet 'Available', update it
      if (currentStatus !== 'Available') {
        updates.push({row: i + 2, status: 'Available'});
      }
    } else {
      // If not found in Drive, ensure status is 'Wishlist'
      if (currentStatus !== 'Wishlist') {
        updates.push({row: i + 2, status: 'Wishlist'});
      }
    }
  }

  // Batch update statuses in the sheet
  updates.forEach(update => {
    sheet.getRange(update.row, 3).setValue(update.status);
  });
}

function getLibraryAndSyncWishlist() {
  const library = getLibraryData();
  syncWishlistStatusWithDrive();
  return library;
}
