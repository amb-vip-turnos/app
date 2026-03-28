import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCnLrgvEc8P-7B-aPCeitVgjNriVHqtg5Y",
    authDomain: "amb-barbers.firebaseapp.com",
    projectId: "amb-barbers",
    storageBucket: "amb-barbers.firebasestorage.app",
    messagingSenderId: "759416482970",
    appId: "1:759416482970:web:4a4d6e694958147811c323"
  };
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);