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
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>RDMN+</title>

  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<style>
  body {
  font-family: Arial, sans-serif;
  background: #141414;
  color: #fff;
  margin: 0;
  font-size: 30px;
}

#appContent {
  padding-bottom: 120px;
}

/* HEADER */
header {
  background: #000;
  text-align: center;
  padding: 25px 0;
}
header img {
  max-width: 300px;
  height: auto;
}

/* SEARCH BAR */
.search-bar {
  text-align: center;
  padding: 30px;
}
.search-bar input {
  padding: 20px;
  width: 95%;
  max-width: 750px;
  font-size: 30px;
  border-radius: 12px;
  border: none;
}

/* SECTION TITLE */
.section-title {
  font-size: 55px;
  margin-left: 30px;
  font-family: 'Bebas Neue', sans-serif;
}

/* SCROLL CONTAINER */
.scroll-container {
  display: flex;
  gap: 20px;
  padding: 20px;
  overflow-x: auto;
}
.scroll-container::-webkit-scrollbar {
  display: none;
}

/* MOVIE CARDS */
.movie-card {
  background: #1f1f1f;
  border-radius: 12px;
  overflow: hidden;
  width: 250px;
  flex: 0 0 auto;
  cursor: pointer;
}
.movie-card img {
  width: 100%;
  display: block;
  border-radius: 12px;
}
.movie-title {
  padding: 12px;
  text-align: center;
  font-size: 30px;
}

/* SKELETON LOADER */
.skeleton-card {
  width: 250px;
  height: 350px;
  background: #2c2c2c;
  border-radius: 12px;
  animation: pulse 1.2s infinite;
}
@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
  100% {
    opacity: 1;
  }
}

/* LOADING SCREEN */
#loadingScreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #141414;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 40px;
  z-index: 9999;
}
.loader {
  border: 8px solid #333;
  border-top: 8px solid #e50914;
  border-radius: 50%;
  width: 70px;
  height: 70px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% {
    transform: rotate(0);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* NAV BAR */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background: #000;
  display: flex;
  justify-content: space-around;
  padding: 10px 0;
  border-top: 1px solid #222;
}
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff;
  font-size: 30px;
  cursor: pointer;
}
.nav-item i {
  font-size: 40px;
  margin-bottom: 4px;
}
.nav-item:hover {
  color: #aaa;
}

/* Hover effect */
.movie-card:hover {
  transform: scale(1.08);
  transition: 0.3s ease;
}

/* MODAL */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.95);
  justify-content: center;
  align-items: center;
  z-index: 1000;
  flex-direction: column;
  padding: 0;
}
.modal.active {
  display: flex !important;
}
.modal-content {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1200px;
  height: 100%; /* Full height */
  background: #1f1f1f;
  overflow: hidden;
  border-radius: 0;
}
#videoFrame {
  width: 100%;
  height: 50%; /* Top half for video */
  border: none;
}
.movie-info-scroll {
  height: 50%; /* Bottom half scrollable */
  overflow-y: auto;
  padding: 20px;
}
.movie-info-scroll::-webkit-scrollbar {
  width: 8px;
}
.movie-info-scroll::-webkit-scrollbar-thumb {
  background: #e50914;
  border-radius: 4px;
}

/* Modal Close Button */
#closeBtn {
  position: fixed;
  top: 20px;
  right: 25px;
  font-size: 70px;
  cursor: pointer;
  color: #fff;
  z-index: 2000;
  transition: transform 0.2s ease, color 0.2s ease;
}
#closeBtn:hover {
  color: #e50914;
  transform: scale(1.2);
}

/* Text Styling in Modal */
.movie-title-text {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 48px;
  margin-bottom: 15px;
  color: #fff;
}
.movie-rating {
  font-size: 30px;
  color: #ccc;
  margin-bottom: 10px;
}
.movie-overview {
  font-size: 30px !important;
  line-height: 1.6;
  color: #aaa;
  margin-bottom: 20px;
}
.loading-text {
  font-size: 30px;
  color: #e50914;
}
</style>
</head>
<body>
  <!-- Loading Screen -->
  <div id="loadingScreen">
    <p>Loading...</p>
    <div class="loader"></div>
  </div>

  <!-- Login Screen -->
  <div id="loginScreen" style="display:flex;justify-content:center;align-items:center;height:100vh;background:#141414;flex-direction:column;">
    <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;">Enter Password</h2>
    <input type="password" id="passwordInput" placeholder="Password" style="padding:10px;font-size:16px;border-radius:5px;border:none;margin-top:10px;">
    <button onclick="checkPassword()" style="margin-top:10px;padding:10px 20px;font-size:18px;background:#e50914;color:white;border:none;border-radius:5px;cursor:pointer;">Login</button>
    <p id="errorMsg" style="color:#e50914;margin-top:10px;display:none;">Incorrect password</p>
  </div>

  <!-- App Content -->
  <div id="appContent" style="display:none;">
    <header><img src="https://i.postimg.cc/jjFhf2Mc/RDMN.png" alt="RDMN+ Logo"></header>
    <div class="search-bar"><input type="text" id="searchInput" placeholder="Search movies or shows..."></div>

  <!-- Movies Section -->
  <div id="moviesSection">
    <h2 class="section-title">Movies</h2>
    <div class="scroll-container" id="moviesRow">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  </div>
  
  <!-- TV Shows Section -->
  <div id="tvSection">
    <h2 class="section-title">TV Shows</h2>
    <div class="scroll-container" id="tvRow">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  </div>
  
  <!-- Netflix Section -->
  <div id="netflixSection">
    <h2 class="section-title">Currently on Netflix</h2>
    <div class="scroll-container" id="netflixRow">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  </div>


    <!-- Search Results -->
    <div id="searchResultsSection" style="display:none;">
      <h2 class="section-title">Search Results</h2>
      <div class="scroll-container" id="searchResultsGrid"></div>
    </div>

    <!-- Episodes -->
  <div id="episodesSection" style="display:none; padding:20px;">
    <h2 class="section-title" id="episodesTitle"></h2>
    <div class="scroll-container" id="episodesGrid"></div>
  </div>
  
  <!-- Modal -->
  <div class="modal" id="videoModal">
    <span id="closeBtn">&times;</span>
    <div class="modal-content">
      <div id="videoFrameContainer" style="width:100%;height:50%;"></div>
      <div class="movie-info-scroll" id="movieDetails"></div>
    </div>
  </div>

  <!-- Bottom Navigation Bar -->
  <div class="bottom-bar">
    <div class="nav-item" onclick="scrollToTop()"><i class="fa-solid fa-house"></i><span>Home</span></div>
    <div class="nav-item" onclick="loadNetflixContent()"><i class="fa-solid fa-rotate-right"></i><span>Refresh</span></div>
    <div class="nav-item" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i><span>Logout</span></div>
  </div>

<script>
const API_URL = "https://script.google.com/macros/s/AKfycbxWJoC3T9cQchL62dJNv3-A-xSu0lHmmKe4091wR9MkifkfoTw074s5JG3vME_XwZ9mhg/exec";
let fullLibrary = [];

// Scroll to top
function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

// Create card
function createCard(item) {
  const card = document.createElement("div");
  card.classList.add("movie-card");
  card.innerHTML = `
    <img src="${item.poster}" alt="${item.title}" loading="lazy">
    <div class="movie-title">${item.title}</div>
  `;
  
  // Add click behavior
  card.addEventListener("click", () => {
    if (item.type === "movie") {
      // Movies: Open first episode (or video)
      openVideo(item.episodes[0].url, item.title);
    } else {
      // TV Shows: Show episodes
      showEpisodes(item);
    }
  });
  
  return card;
}

function openVideo(url, title) {
  document.getElementById("videoModal").classList.add("active");
  
  // Replace iframe with <video>
  const videoContainer = document.getElementById("videoFrameContainer");
  videoContainer.innerHTML = `
    <video id="videoPlayer" controls autoplay style="width:100%;height:100%;border-radius:12px;">
      <source src="${url}" type="video/mp4">
      Your browser does not support the video tag.
    </video>
  `;

  document.getElementById("movieDetails").innerHTML = `
    <h2 class="movie-title-text">${title}</h2>
  `;
}

function showEpisodes(show) {
  // Hide Movies & TV sections
  document.getElementById("moviesRow").parentElement.style.display = "none";
  document.getElementById("tvRow").parentElement.style.display = "none";
  
  // ✅ Hide Netflix section too
  document.getElementById("netflixSection").style.display = "none";

  // Show Episodes section
  document.getElementById("episodesSection").style.display = "block";
  document.getElementById("episodesTitle").textContent = show.title;

  const episodesGrid = document.getElementById("episodesGrid");
  episodesGrid.innerHTML = "";

  show.episodes.forEach(ep => {
    const epCard = document.createElement("div");
    epCard.classList.add("movie-card");
    epCard.innerHTML = `
      <img src="${show.poster}" alt="${ep.title}">
      <div class="movie-title">${ep.title}</div>
    `;
    epCard.addEventListener("click", () => {
      openVideo(ep.url, `${show.title} - ${ep.title}`);
    });
    episodesGrid.appendChild(epCard);
  });

  // Show Back button
  const backBtn = document.createElement("button");
  backBtn.textContent = "⬅ Back";
  backBtn.style.cssText = `
    margin: 20px; padding: 12px 24px; font-size: 20px;
    background: #e50914; color: #fff; border: none; border-radius: 8px;
    cursor: pointer;
  `;
  backBtn.addEventListener("click", () => {
    document.getElementById("episodesSection").style.display = "none";
    document.getElementById("moviesRow").parentElement.style.display = "block";
    document.getElementById("tvRow").parentElement.style.display = "block";

    // ✅ Show Netflix section again
    document.getElementById("netflixSection").style.display = "block";

    backBtn.remove();
  });

  document.getElementById("episodesSection").prepend(backBtn);
}


// Render Movies
function renderMovies(movies) {
  const moviesRow = document.getElementById("moviesRow");
  moviesRow.innerHTML = "";
  movies.forEach(item => moviesRow.appendChild(createCard(item)));
}

// Render TV
function renderTV(tvShows) {
  const tvRow = document.getElementById("tvRow");
  tvRow.innerHTML = "";
  tvShows.forEach(item => tvRow.appendChild(createCard(item)));
}

// Load Library
async function loadLibrary() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    // Save full library for search
    fullLibrary = [...data.movies, ...data.tv];

    // Show first batch
    renderMovies(data.movies.slice(0, 20));
    renderTV(data.tv.slice(0, 20));

    // Hide loader after initial render
    document.getElementById("loadingScreen").style.display = "none";

    // Lazy load the rest
    setTimeout(() => {
      renderMovies(data.movies);
      renderTV(data.tv);
    }, 1500);
  } catch (error) {
    console.error("Error loading library:", error);
    document.getElementById("moviesRow").innerHTML = `<p style="color:red;text-align:center;">Failed to load movies.</p>`;
    document.getElementById("tvRow").innerHTML = `<p style="color:red;text-align:center;">Failed to load TV shows.</p>`;
  }
}

async function loadNetflixContent() {
  const API_KEY = "48f719a14913f9d4ee92c684c2187625"; // Your real API key
  const netflixRow = document.getElementById("netflixRow");
  netflixRow.innerHTML = "";

  const randomPage = Math.floor(Math.random() * 20) + 1;
  const url = `https://api.themoviedb.org/3/discover/movie?with_watch_providers=8&watch_region=US&sort_by=popularity.desc&page=${randomPage}&api_key=${API_KEY}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    const movies = data.results.slice(0, 5); // Show 5 movies like before

    movies.forEach(item => {
      const poster = item.poster_path
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : "https://via.placeholder.com/250x350";

      const card = document.createElement("div");
      card.classList.add("movie-card");
      card.innerHTML = `
        <img src="${poster}" loading="lazy">
        <div class="movie-title">${item.title}</div>
        <p style="font-size:16px;color:#ccc;margin:0;">⭐ ${item.vote_average}/10</p>
        <p style="font-size:14px;color:#aaa;margin:0;">${item.release_date}</p>
      `;

      // On click → open modal with description & trailer
      card.addEventListener("click", () => openNetflixModal(item));

      netflixRow.appendChild(card);
    });
  } catch (error) {
    console.error("Netflix load error:", error);
    netflixRow.innerHTML = `<p style="color:red;text-align:center;">Failed to load Netflix content.</p>`;
  }
}

async function openNetflixModal(item) {
  document.getElementById("videoModal").classList.add("active");
  const modalFrame = document.getElementById("videoFrame");
  const details = document.getElementById("movieDetails");

  // Reset modal content
  modalFrame.style.display = "none";
  details.innerHTML = `
    <h2 class="movie-title-text">${item.title}</h2>
    <p class="movie-rating">⭐ ${item.vote_average}/10 | ${item.release_date}</p>
    <p class="movie-overview">${item.overview || "No description available."}</p>
    <p class="loading-text">Loading trailer...</p>
  `;

  const API_KEY = "48f719a14913f9d4ee92c684c2187625"; // Same API key
  const videoURL = `https://api.themoviedb.org/3/movie/${item.id}/videos?api_key=${API_KEY}`;

  try {
    const res = await fetch(videoURL);
    const videoData = await res.json();
    const trailer = videoData.results.find(v => v.type === "Trailer" && v.site === "YouTube");

    if (trailer) {
      modalFrame.style.display = "block";
      modalFrame.src = `https://www.youtube.com/embed/${trailer.key}`;
    } else {
      details.innerHTML += `<p style="color:#888;">No trailer available.</p>`;
    }
  } catch (err) {
    console.error("Trailer fetch error:", err);
    details.innerHTML += `<p style="color:#888;">Could not load trailer.</p>`;
  }
}

// Login System
function checkPassword() {
  const input = document.getElementById("passwordInput").value;
  if (input === "YourSecretPassword") {
    localStorage.setItem("loggedIn", "true");
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContent").style.display = "block";
    loadLibrary();
    loadNetflixContent();
  } else {
    document.getElementById("errorMsg").style.display = "block";
  }
}

function logout() {
  localStorage.removeItem("loggedIn");
  location.reload();
}

document.getElementById("closeBtn").addEventListener("click", () => {
  document.getElementById("videoModal").classList.remove("active");
  document.getElementById("videoFrame").src = "";
});

// Auto-login if already logged in
if (true) {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appContent").style.display = "block";
  loadLibrary();
  loadNetflixContent();
}

// Search Feature
document.getElementById("searchInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const searchResults = document.getElementById("searchResultsSection");
  const searchGrid = document.getElementById("searchResultsGrid");

  if (query === "") {
    // Restore original sections when input is cleared
    document.getElementById("moviesSection").style.display = "block";
    document.getElementById("tvSection").style.display = "block";
    document.getElementById("netflixSection").style.display = "block";
    document.getElementById("episodesSection").style.display = "none"; // Hide episodes if open
    searchResults.style.display = "none";
    return;
  }

  // Hide everything except header and search bar
  document.getElementById("moviesSection").style.display = "none";
  document.getElementById("tvSection").style.display = "none";
  document.getElementById("netflixSection").style.display = "none";
  document.getElementById("episodesSection").style.display = "none";

  // Show search results container
  searchResults.style.display = "block";
  searchGrid.innerHTML = "";

  // Filter full library
  const filtered = fullLibrary.filter(item =>
    item.title.toLowerCase().includes(query)
  );

  if (filtered.length > 0) {
    filtered.forEach(item => searchGrid.appendChild(createCard(item)));
  } else {
    searchGrid.innerHTML = `<p style="text-align:center;color:#aaa;font-size:24px;">No results found.</p>`;
  }
});

</script>
</body>
</html>
