import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, appId } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { InputField } from '../components/Shared';
import { formatDate } from '../utils/helpers';

export default function SplashView() {
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