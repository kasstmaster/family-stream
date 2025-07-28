const SPREADSHEET_ID = '17AAXIsNI2HACunSc1lJ46azCPIqzLwnadnEB2UzFwIM'; // Google Sheet ID
const WISHLIST_SHEET_NAME = 'Wishlist';

// ✅ Main doGet - Handles Library + Wishlist
function doGet(e) {
  if (e && e.parameter.action === 'getWishlist') {
    return ContentService.createTextOutput(JSON.stringify(getWishlist()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Default: Return Movies & TV Library
  const parentFolderId = '1fX26oP26OtJ0aO_q3wl3u1CYrR4t6JO1'; // Your RDMN Library Folder ID
  const parentFolder = DriveApp.getFolderById(parentFolderId);
  const moviesFolder = parentFolder.getFoldersByName('Movies').next();
  const tvFolder = parentFolder.getFoldersByName('TV Shows').next();

  const data = {
    movies: processCategory(moviesFolder),
    tv: processCategory(tvFolder)
  };

  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ✅ Process Movie & TV Folders
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
          url: 'https://drive.google.com/file/d/' + file.getId() + '/preview'
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

// ✅ Wishlist View Only
function getWishlistSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(WISHLIST_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(WISHLIST_SHEET_NAME);
    sheet.appendRow(['Title', 'Poster', 'Timestamp']);
  }
  return sheet;
}

function getWishlist() {
  const sheet = getWishlistSheet();
  const rows = sheet.getDataRange().getValues();
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    data.push({
      title: rows[i][0],
      poster: rows[i][1],
      timestamp: rows[i][2]
    });
  }
  return data;
}
