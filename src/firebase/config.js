import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCZDpOOlu6CcBNG5mNd9qLO0w3UihBB3-g",
  authDomain: "daily-ride-south-v3.firebaseapp.com",
  projectId: "daily-ride-south-v3",
  storageBucket: "daily-ride-south-v3.firebasestorage.app",
  messagingSenderId: "588312048393",
  appId: "1:588312048393:web:94f43a144149d0e87159d8"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const appId = 'daily-ride-south-live';