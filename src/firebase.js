import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase Configuration
// Environment variables are securely loaded during build time from .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCMDxPSNybc1hXVNyvV0UOMsCwCuV-dLHY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "chai-tracker-50e02.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "chai-tracker-50e02",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "chai-tracker-50e02.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "776314460007",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:776314460007:web:43e89828902f7a928181c2",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-E33SFQ5SLF"
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let app = null;
let db = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

export { db };
