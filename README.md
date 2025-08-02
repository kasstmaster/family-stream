# family-stream


Backup Apps Script:
// ✅ Main doGet - Handles Library & Streaming
function doGet(e) {
  if (e && e.parameter.action === 'stream' && e.parameter.id) {
    return streamVideo(e.parameter.id, e);
  }

  // ✅ Default: Return Movies & TV Library
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

// ✅ Stream Video with Range Support
function streamVideo(fileId, e) {
  try {
    const file = DriveApp.getFileById(fileId);
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

// ✅ Build Movie/TV JSON
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






Backup index.html
