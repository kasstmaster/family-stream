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
    }
  } catch (error) {
    console.error("Login error:", error);
    document.getElementById("errorMsg").style.display = "block";
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
