// firebase-config.js - Client-side Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, updateEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// TODO: Replace with your actual Firebase config from .env or Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyDnlbcK0BhysjzDrMes1VJ8zwczdhcuhA0",
  authDomain: "skinderm-ai-auth.firebaseapp.com",
  projectId: "skinderm-ai-auth",
  storageBucket: "skinderm-ai-auth.firebasestorage.app",
  messagingSenderId: "1083502945287",
  appId: "1:1083502945287:web:72f5f07d3f6eae8639f6a2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, updateEmail };
