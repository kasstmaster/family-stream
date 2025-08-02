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
