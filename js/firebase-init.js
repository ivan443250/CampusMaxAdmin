// js/firebase-init.js

const firebaseConfig = {
  apiKey: "AIzaSyDVYf1_aFb57GN5y_stmeo6MdSBVPPN1yQ",
  authDomain: "campusmax-21caf.firebaseapp.com",
  projectId: "campusmax-21caf",
  storageBucket: "campusmax-21caf.firebasestorage.app",
  messagingSenderId: "538462229438",
  appId: "1:538462229438:web:bafac684355a3b25bedfef",
  measurementId: "G-2B9RQX0QCR"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);

// Удобные глобальные ссылки
window.auth = firebase.auth();
window.db = firebase.firestore();
