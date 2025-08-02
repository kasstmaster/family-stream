import { signInWithGoogle } from './firebase.js';

const APPROVED_EMAILS = ["raudmanstream@gmail.com"];

document.getElementById("google-signin").addEventListener("click", () => {
  signInWithGoogle()
    .then((result) => {
      const email = result.user.email;
      if (APPROVED_EMAILS.includes(email)) {
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("appContent").style.display = "block";
        document.getElementById("loadingScreen").style.display = "none";
        localStorage.setItem("loggedIn", "true");
        // loadLibrary();
        // loadNetflixContent();
      } else {
        document.getElementById("errorMsg").style.display = "block";
      }
    })
    .catch((err) => {
      console.error("Login error:", err.message);
    });
});

// Optional: Auto-login
if (localStorage.getItem("loggedIn") === "true") {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appContent").style.display = "block";
  document.getElementById("loadingScreen").style.display = "none";
  // loadLibrary();
  // loadNetflixContent();
}
