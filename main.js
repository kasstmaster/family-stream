const API_URL = "https://script.google.com/macros/s/AKfycbxWJoC3T9cQchL62dJNv3-A-xSu0lHmmKe4091wR9MkifkfoTw074s5JG3vME_XwZ9mhg/exec";
  const APPROVED_EMAILS = ["raudmanstream@gmail.com"]; // Add your real family emails here

function handleCredentialResponse(response) {
  const data = parseJwt(response.credential);
  const userEmail = data.email;

  if (APPROVED_EMAILS.includes(userEmail)) {
    localStorage.setItem("loggedIn", "true");
    document.getElementById("loadingScreen").style.display = "none";  // <- THIS LINE
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContent").style.display = "block";
    loadLibrary();
    loadNetflixContent();
  } else {
    document.getElementById("errorMsg").style.display = "block";
  }
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );

  return JSON.parse(jsonPayload);
}
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

function logout() {
  localStorage.removeItem("loggedIn");
  location.reload();
}

document.getElementById("closeBtn").addEventListener("click", () => {
  document.getElementById("videoModal").classList.remove("active");
  document.getElementById("videoFrame").src = "";
});

// Auto-login if already logged in
if (localStorage.getItem("loggedIn") === "true") {
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

window.onload = () => {
  google.accounts.id.prompt();
};

import { signInWithGoogle } from "./auth.js";

// When the page is ready, attach the click handler
window.addEventListener("DOMContentLoaded", () => {
  const loginButton = document.querySelector(".g_id_signin");
  if (loginButton) {
    loginButton.addEventListener("click", (e) => {
      e.preventDefault();
      signInWithGoogle();
    });
  }
});
