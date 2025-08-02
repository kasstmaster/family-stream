import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAEd0LK81ubRrEn9vyg75nDFhb9MdcWnjw",
  authDomain: "rdmn-stream.firebaseapp.com",
  projectId: "rdmn-stream",
  storageBucket: "rdmn-stream.firebasestorage.app",
  messagingSenderId: "748872080882",
  appId: "1:748872080882:web:ad167a25ebca9131025f6b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Attempt sign-in when login screen is clicked
document.getElementById("loginScreen").addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // You can restrict access to certain emails if needed:
    const allowedEmails = ["you@example.com", "family@example.com"];
    if (!allowedEmails.includes(user.email)) {
      alert("Unauthorized user");
      await signOut(auth);
      return;
    }

    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContent").style.display = "block";
  } catch (error) {
    console.error("Login failed:", error);
    alert("Login failed. Check the console for more info.");
  }
});

// Keep user logged in across refreshes
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContent").style.display = "block";
  }
});

// Logout function (optional)
window.logout = async function () {
  await signOut(auth);
  location.reload();
};
