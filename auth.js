// ==============================
// GITHUB
// Firebase Authentication Logic
// Handles Google sign-in, sign-out, and auth state
// ==============================

const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// ✅ Sign in
window.signInWithGoogle = async function () {
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;

    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContent").style.display = "block";
    localStorage.setItem("loggedIn", "true");

    console.log("Logged in as:", user.displayName);
  } catch (error) {
    console.error("Login error:", error);
    document.getElementById("errorMsg").style.display = "block";
  }
};

// ✅ Sign out
window.logout = async function () {
  try {
    await auth.signOut();
    localStorage.removeItem("loggedIn");
    location.reload();
  } catch (err) {
    console.error("Logout error:", err);
  }
};

// ✅ Auto login check
auth.onAuthStateChanged((user) => {
  if (user) {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContent").style.display = "block";
  }
});
