import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  signInAnonymously
} from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';

// -----------------------------------------------------------------------------
// 1. FIREBASE & CONTEXT SETUP (Inlined here so the preview environment compiles)
// -----------------------------------------------------------------------------
const canvasConfig = typeof __firebase_config !== 'undefined' && __firebase_config ? JSON.parse(__firebase_config) : null;
const firebaseConfig = canvasConfig && Object.keys(canvasConfig).length > 0 ? canvasConfig : {
  apiKey: "AIzaSyCZDpOOlu6CcBNG5mNd9qLO0w3UihBB3-g",
  authDomain: "daily-ride-south-v3.firebaseapp.com",
  projectId: "daily-ride-south-v3",
  storageBucket: "daily-ride-south-v3.firebasestorage.app",
  messagingSenderId: "588312048393",
  appId: "1:588312048393:web:94f43a144149d0e87159d8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'daily-ride-south-live';

const AuthContext = createContext();

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    
    const timeout = setTimeout(() => {
        if (!auth.currentUser) initAuth();
    }, 1000);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(timeout);
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

const useAuth = () => useContext(AuthContext);

// -----------------------------------------------------------------------------
// 2. SHARED COMPONENTS & HELPERS
// -----------------------------------------------------------------------------
const formatDate = (date) => {
  const d = date.getDate();
  let suffix = 'th';
  if (d === 1 || d === 21 || d === 31) suffix = 'st';
  else if (d === 2 || d === 22) suffix = 'nd';
  else if (d === 3 || d === 23) suffix = 'rd';
  const month = date.toLocaleDateString('en-GB', { month: 'long' });
  const year = date.getFullYear();
  return `${d}${suffix} ${month} ${year}`;
};

const InputField = ({ label, value, onChange, placeholder, type = "text", required = false }) => (
  <div className="w-full">
    <label className="block text-sm font-medium text-zinc-400 mb-1">{label}</label>
    <input 
      type={type}
      value={value} 
      onChange={onChange} 
      required={required}
      className="w-full bg-black border border-zinc-800 text-white rounded-lg p-3 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition-all" 
      placeholder={placeholder} 
    />
  </div>
);

// -----------------------------------------------------------------------------
// 3. SPLASH VIEW
// -----------------------------------------------------------------------------
function SplashView() {
  const { user } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Directly redirect if logged in (this prevents the "Processing..." hang)
  if (user && !user.isAnonymous) {
    return <Navigate to="/home" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setResetMsg(''); setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', res.user.uid), {
          email: res.user.email,
          name: '',
          joinDate: formatDate(new Date()),
          role: 'Member',
          isHidden: false
        });
      }
    } catch (err) {
      setError(err.message?.replace('Firebase: ', '') || 'An authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError(''); setResetMsg('');
    if (!email) return setError('Please enter your email address first.');
    setLoading(true);
    try {
        await sendPasswordResetEmail(auth, email);
        setResetMsg('Password reset link sent to your email.');
    } catch(err) {
        setError(err.message?.replace('Firebase: ', '') || 'Failed to send reset email.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="relative z-10 w-full max-w-md bg-black/80 backdrop-blur-xl p-8 rounded-3xl border border-zinc-800 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Daily Ride <span className="text-pink-600 not-italic">South</span></h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">Petrolhead Community</p>
        </div>

        {isResetMode ? (
          <form onSubmit={handlePasswordReset} className="space-y-5">
            <InputField label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {error && <p className="text-red-500 text-xs font-bold uppercase text-center">{error}</p>}
            {resetMsg && <p className="text-green-500 text-xs font-bold uppercase text-center">{resetMsg}</p>}
            <button type="submit" disabled={loading} className="w-full bg-pink-600 text-white font-black py-4 rounded-xl uppercase transition-all active:scale-95">{loading ? 'Processing...' : 'Send Reset Link'}</button>
            <button type="button" onClick={() => setIsResetMode(false)} className="text-zinc-400 hover:text-white transition-colors text-xs font-bold uppercase w-full mt-4">Back to Login</button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <InputField label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <InputField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="text-red-500 text-xs font-bold uppercase text-center">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-pink-600 text-white font-black py-4 rounded-xl uppercase transition-all active:scale-95">{loading ? 'Processing...' : (isLogin ? 'Enter Garage' : 'Join Club')}</button>
            <div className="mt-8 text-center">
              <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-pink-500 hover:text-pink-400 transition-colors font-bold uppercase text-xs">
                {isLogin ? 'Sign up here' : 'Log in instead'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 4. PREVIEW WRAPPER
// Note: This exists purely to make the preview function properly. 
// -----------------------------------------------------------------------------
export default function AppPreview() {
  return (
    <AuthProvider>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<SplashView />} />
          <Route 
            path="/home" 
            element={
              <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8">
                <div className="bg-zinc-900 border border-pink-500 p-8 rounded-3xl text-center">
                  <h2 className="text-white text-2xl font-black uppercase mb-2">Login Successful!</h2>
                  <p className="text-zinc-400 text-sm">In your local codebase, this routes to HomeView.jsx</p>
                </div>
              </div>
            } 
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}