// ==============================
// GITHUB
// Main Application Logic
// Handles page behavior, DOM manipulation, and events
// ==============================

const API_URL = "https://script.google.com/macros/s/AKfycbxWJoC3T9cQchL62dJNv3-A-xSu0lHmmKe4091wR9MkifkfoTw074s5JG3vME_XwZ9mhg/exec";

// ✅ Firebase Login
window.signInWithGoogle = async function () {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;

    if (user.email === "raudmanstream@gmail.com") {
      localStorage.setItem("loggedIn", "true");
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("appContent").style.display = "block";
      document.getElementById("loadingScreen").style.display = "none";
      loadLibrary();
      loadNetflixContent();
    } else {
      await firebase.auth().signOut();
      document.getElementById("errorMsg").style.display = "block";
      document.getElementById("loadingScreen").style.display = "none";
    }
  } catch (error) {
    console.error("Login error:", error);
    document.getElementById("errorMsg").style.display = "block";
    document.getElementById("loadingScreen").style.display = "none";
  }
};

// ✅ Firebase Logout
window.logout = async function () {
  try {
    await firebase.auth().signOut();
    localStorage.removeItem("loggedIn");
    location.reload();
  } catch (err) {
    console.error("Logout error:", err);
  }
};

// ✅ Auto-login
firebase.auth().onAuthStateChanged((user) => {
  if (user && user.email === "raudmanstream@gmail.com") {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContent").style.display = "block";
    loadLibrary();
    loadNetflixContent();
  }
document.getElementById("loadingScreen").style.display = "none";
});

function loadLibrary() {
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      renderSection("moviesRow", data.movies);
      renderSection("tvRow", data.tv);
    })
    .catch(err => console.error("Failed to load library:", err));
}

function renderSection(sectionId, items) {
  const container = document.getElementById(sectionId);
  container.innerHTML = ""; // Clear skeletons
  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.innerHTML = `
      <img src="${item.poster}" alt="${item.title}">
      <div class="movie-title">${item.title}</div>
    `;
    card.onclick = () => openModal(item);
    container.appendChild(card);
  });
}

function openModal(item) {
  const modal = document.getElementById("videoModal");
  const container = document.getElementById("videoFrameContainer");
  const details = document.getElementById("movieDetails");

  container.innerHTML = `<video id="videoFrame" controls autoplay style="width:100%;height:100%;">
    <source src="${item.episodes[0].url}" type="video/mp4">
    Your browser does not support the video tag.
  </video>`;

  details.innerHTML = `
    <div class="movie-title-text">${item.title}</div>
    <div class="movie-rating">Type: ${item.type}</div>
    <div class="movie-overview">${item.episodes.length} episode(s)</div>
  `;

  modal.classList.add("active");
}

document.getElementById("closeBtn").onclick = function () {
  document.getElementById("videoModal").classList.remove("active");
  document.getElementById("videoFrameContainer").innerHTML = ""; // Stop playback
};

async function loadNetflixContent() {
  const API_KEY = "48f719a14913f9d4ee92c684c2187625"; // Your TMDb API key
  const netflixRow = document.getElementById("netflixRow");
  netflixRow.innerHTML = "";

  const randomPage = Math.floor(Math.random() * 20) + 1;
  const url = `https://api.themoviedb.org/3/discover/movie?with_watch_providers=8&watch_region=US&sort_by=popularity.desc&page=${randomPage}&api_key=${API_KEY}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    const movies = data.results.slice(0, 5); // Show 5 movies

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

      card.addEventListener("click", () => openNetflixModal(item));
      netflixRow.appendChild(card);
    });
  } catch (error) {
    console.error("Netflix load error:", error);
    netflixRow.innerHTML = `<p style="color:red;text-align:center;">Failed to load Netflix content.</p>`;
  }
}

async function openNetflixModal(item) {
  const modal = document.getElementById("videoModal");
  const container = document.getElementById("videoFrameContainer");
  const details = document.getElementById("movieDetails");

  modal.classList.add("active");
  container.innerHTML = ""; // clear video area

  details.innerHTML = `
    <div class="movie-title-text">${item.title}</div>
    <div class="movie-rating">⭐ ${item.vote_average}/10 | ${item.release_date}</div>
    <div class="movie-overview">${item.overview || "No description available."}</div>
    <div class="loading-text">Loading trailer...</div>
  `;

  const API_KEY = "48f719a14913f9d4ee92c684c2187625";
  const videoURL = `https://api.themoviedb.org/3/movie/${item.id}/videos?api_key=${API_KEY}`;

  try {
    const res = await fetch(videoURL);
    const videoData = await res.json();
    const trailer = videoData.results.find(v => v.type === "Trailer" && v.site === "YouTube");

    if (trailer) {
      container.innerHTML = `<iframe id="videoFrame" width="100%" height="100%" src="https://www.youtube.com/embed/${trailer.key}" frameborder="0" allowfullscreen></iframe>`;
    } else {
      details.innerHTML += `<p style="color:#888;">No trailer available.</p>`;
    }
  } catch (err) {
    console.error("Trailer fetch error:", err);
    details.innerHTML += `<p style="color:#888;">Could not load trailer.</p>`;
  }
}
