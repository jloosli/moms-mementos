import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyArsjlORQY16tdZO8OaPemCMt5r9o7-r3A",
  authDomain: "moms-mementos.firebaseapp.com",
  projectId: "moms-mementos",
  storageBucket: "moms-mementos.firebasestorage.app",
  messagingSenderId: "713323110976",
  appId: "1:713323110976:web:b9179dc7890b32d23cf5a5",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {}, "default");
export const googleProvider = new GoogleAuthProvider();
