import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEd0LK81ubRrEn9vyg75nDFhb9MdcWnjw",
  authDomain: "rdmn-stream.firebaseapp.com",
  projectId: "rdmn-stream",
  storageBucket: "rdmn-stream.appspot.com",
  messagingSenderId: "748872080882",
  appId: "1:748872080882:web:ad167a25ebca9131025f6b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}
