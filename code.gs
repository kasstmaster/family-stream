function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'api') {
    const data = getLibraryData();
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*');
  }

  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('My Movie Browser')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Stream Video with Range Support
function streamVideo(fileId, e) {
  try {
    const file = DriveApp.getFileById(fileId);
    if (!file.getSharingAccess || file.getSharingAccess() === DriveApp.Access.NONE) {
      return ContentService.createTextOutput("Access denied");
    }
    const blob = file.getBlob();
    const size = blob.getBytes().length;
    const rangeHeader = e?.parameter?.range || e?.parameter?.Range;

    let start = 0;
    let end = size - 1;
    let status = 200;

    if (rangeHeader) {
      const matches = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (matches) {
        start = parseInt(matches[1], 10);
        if (matches[2]) end = parseInt(matches[2], 10);
        status = 206; // Partial Content
      }
    }

    const chunk = blob.getBytes().slice(start, end + 1);

    const response = ContentService.createTextOutput(chunk);
    response.setMimeType(blob.getContentType());
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    response.setHeader('Content-Length', chunk.length);
    response.setHeader('Cache-Control', 'no-cache');

    return response;
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.message);
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
          url: `https://script.google.com/macros/s/AKfycbxWJoC3T9cQchL62dJNv3-A-xSu0lHmmKe4091wR9MkifkfoTw074s5JG3vME_XwZ9mhg/exec?action=stream&id=${file.getId()}`
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
function getPopularMovies() {
  const apiKey = '48f719a14913f9d4ee92c684c2187625';
  const url = `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=en-US&page=1`;
  const response = UrlFetchApp.fetch(url);
  const data = JSON.parse(response.getContentText());
  return addPosterBasePath(data.results);
}
function getPopularTVShows() {
  const apiKey = '48f719a14913f9d4ee92c684c2187625';
  const url = `https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&language=en-US&page=1`;
  const response = UrlFetchApp.fetch(url);
  const data = JSON.parse(response.getContentText());
  return addPosterBasePath(data.results);
}
function getCombinedPopular() {
  return {
    movies: getPopularMovies(),
    tv: getPopularTVShows()
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
        if (status === "Requested") {
          return { status: "requested", title };
        } else if (status === "Added") {
          return { status: "available", title };
        }
        // If other statuses exist, treat as requested for simplicity
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

  return data.filter(row => row[2] === "Requested")
    .map(row => ({
      title: row[0],
      poster: row[3]
    }));
}
function getRecentVideos(days = 30) {
  const rootFolderId = '1fX26oP26OtJ0aO_q3wl3u1CYrR4t6JO1';
  const rootFolder = DriveApp.getFolderById(rootFolderId);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const categories = ['Movies', 'TV Shows'];
  const recentVideosMap = {}; // Use object to group by folder title

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

      // Find poster image in folder files (png, jpg, jpeg)
      while (files.hasNext()) {
        const file = files.next();

        // Set poster if image file found
        const name = file.getName().toLowerCase();
        if (!poster && (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg'))) {
          poster = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w300';
        }
      }

      // Reset files iterator to check video files for date
      const filesForDateCheck = folder.getFiles();
      while (filesForDateCheck.hasNext()) {
        const file = filesForDateCheck.next();
        if (file.getLastUpdated() >= cutoffDate) {
          hasRecentFile = true;
          break; // no need to check more files in this folder
        }
      }

      if (hasRecentFile) {
        recentVideosMap[folder.getName()] = {
          title: folder.getName(),
          poster: poster || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(folder.getName()),
          // You can add URL or other props if needed
        };
      }
    }
  });

  // Convert map to array of unique folders
  return Object.values(recentVideosMap);
}
