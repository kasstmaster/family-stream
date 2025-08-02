import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";
import { app } from "./firebase.js"; // import the initialized app

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Handle login
window.signInWithGoogle = async function () {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContent").style.display = "block";
    localStorage.setItem("loggedIn", "true");

    // You can use user.displayName, user.email, etc. if needed
    console.log("Logged in as:", user.displayName);
  } catch (error) {
    console.error("Login error:", error);
    document.getElementById("errorMsg").style.display = "block";
  }
};

// Handle logout
window.logout = async function () {
  try {
    await signOut(auth);
    localStorage.removeItem("loggedIn");
    location.reload();
  } catch (err) {
    console.error("Logout error:", err);
  }
};

// Auto-login if session exists
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContent").style.display = "block";
  }
});
