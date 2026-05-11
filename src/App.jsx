import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { 
  Calendar, 
  Users, 
  Ticket, 
  CarFront, 
  MapPin, 
  Clock, 
  ChevronLeft,
  Award,
  Heart,
  ExternalLink,
  UserCircle,
  Save,
  Plus,
  Trash2,
  Lock,
  Shield,
  Edit3,
  Menu,
  X,
  LogOut,
  ImageIcon,
  History,
  Home
} from 'lucide-react';

// --- FIREBASE SETUP ---
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
const storage = getStorage(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'daily-ride-south-live';

// --- HELPERS ---
const getOrdinalSuffix = (d) => {
  if (d > 3 && d < 21) return 'th';
  switch (d % 10) {
    case 1:  return "st";
    case 2:  return "nd";
    case 3:  return "rd";
    default: return "th";
  }
};

const formatDate = (date) => {
  const d = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'long' });
  const year = date.getFullYear();
  return `${d}${getOrdinalSuffix(d)} ${month} ${year}`;
};

const parseEventDateStr = (dateStr) => {
  if (!dateStr) return new Date(9999, 0, 1);
  
  // Remove day names and ordinal suffixes
  let cleanStr = dateStr.replace(/^[A-Za-z]+,\s*/, '');
  cleanStr = cleanStr.replace(/(\d+)(st|nd|rd|th)/, '$1');
  
  // Check for DD/MM/YYYY format
  if (cleanStr.includes('/')) {
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const dateObj = new Date(y, m, d);
      if (!isNaN(dateObj.getTime())) return dateObj;
    }
  }

  const parsed = Date.parse(cleanStr);
  if (isNaN(parsed)) return new Date(9999, 0, 1);
  return new Date(parsed);
};

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&q=80&w=200";
const DEFAULT_CAR = "https://images.unsplash.com/photo-1502877338535-494e509f583b?auto=format&fit=crop&q=80&w=800";

// --- SHARED COMPONENTS ---
const FacebookIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
);

const InstagramIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);

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

// --- AUTHENTICATION SPLASH SCREEN ---
const SplashView = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResetMsg('');
    setLoading(true);
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      const message = err.message?.includes('auth/invalid-credential') 
        ? 'Invalid email or password.' 
        : err.message?.includes('auth/email-already-in-use')
        ? 'An account with this email already exists.'
        : err.message?.replace('Firebase: ', '') || 'An authentication error occurred.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setResetMsg('');
    if (!email) {
        setError('Please enter your email address first.');
        return;
    }
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
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden selection:bg-pink-500/30 selection:text-pink-200">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1502877338535-494e509f583b?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center opacity-20 blur-sm scale-105"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-950/40"></div>

      <div className="relative z-10 w-full max-w-md bg-black/80 backdrop-blur-xl p-8 rounded-3xl border border-zinc-800 shadow-2xl shadow-pink-500/5 animate-in zoom-in-95 duration-700">
        <div className="flex flex-col items-center mb-8">
          <img src="https://i.ibb.co/xnqpNZV/Whats-App-Image-2026-05-10-at-4-19-50-PM.jpg" className="h-20 w-20 rounded-2xl object-cover border border-zinc-700 shadow-lg shadow-pink-500/20 mb-4" alt="DRS Logo" />
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Daily Ride <span className="text-pink-600 not-italic">South</span></h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">Petrolhead Community</p>
        </div>

        {isResetMode ? (
          <form onSubmit={handlePasswordReset} className="space-y-5">
            <p className="text-zinc-300 text-sm text-center mb-4">Enter your email address and we will send you a link to reset your password.</p>
            <InputField label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="enter your email" required />
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-lg">
                <p className="text-red-500 text-xs font-bold uppercase tracking-widest text-center">{error}</p>
              </div>
            )}
            {resetMsg && (
              <div className="bg-green-500/10 border border-green-500/50 p-3 rounded-lg">
                <p className="text-green-500 text-xs font-bold uppercase tracking-widest text-center">{resetMsg}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:hover:bg-pink-600 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-pink-500/20 uppercase tracking-widest active:scale-[0.98]">
              {loading ? 'Processing...' : 'Send Reset Link'}
            </button>

            <div className="mt-6 text-center border-t border-zinc-800/50 pt-6">
              <button type="button" onClick={() => { setIsResetMode(false); setError(''); setResetMsg(''); }} className="text-zinc-400 hover:text-white font-bold uppercase text-xs tracking-widest transition-colors">
                Back to Login
              </button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-5">
              <InputField label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="enter your email" required />
              <div className="space-y-1">
                <InputField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                {isLogin && (
                  <div className="flex justify-end">
                    <button type="button" onClick={() => { setIsResetMode(true); setError(''); setResetMsg(''); }} className="text-pink-500 hover:text-pink-400 text-xs font-bold uppercase tracking-widest transition-colors mt-2">
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-lg">
                  <p className="text-red-500 text-xs font-bold uppercase tracking-widest text-center">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:hover:bg-pink-600 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-pink-500/20 uppercase tracking-widest active:scale-[0.98]">
                {loading ? 'Processing...' : (isLogin ? 'Enter Garage' : 'Join Club')}
              </button>
            </form>

            <div className="mt-8 text-center border-t border-zinc-800/50 pt-6">
              <p className="text-zinc-400 text-sm">
                {isLogin ? "Don't have an account yet?" : "Already part of the club?"}
              </p>
              <button onClick={() => { setIsLogin(!isLogin); setError(''); setResetMsg(''); }} className="text-pink-500 hover:text-pink-400 font-bold uppercase text-xs tracking-widest mt-2 transition-colors">
                {isLogin ? 'Sign up here' : 'Log in instead'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// --- MOCK DATA (Static Fallbacks) ---
const STATIC_EVENTS = [
  {
    id: 'static-1',
    title: "Tunerfest South",
    date: "Sunday, 14th June 2026",
    time: "09:00 AM",
    location: "Brands Hatch Circuit, Kent",
    description: "Celebrating the UK's tuning scene with Time Attack, drifting, and massive club displays. An action-packed day out.",
    image: "https://scontent.fltn4-1.fna.fbcdn.net/v/t39.30808-6/615332601_1303146985173729_7017742900608760889_n.jpg?_nc_cat=111&ccb=1-7&_nc_sid=2a1932&_nc_ohc=9lMQN9k9fWwQ7kNvwEUw7bF&_nc_oc=Adrt86yG2RX2lia1fFym533-vAHlszAQe8vVA64q3g8wkzt7Jfx1KDqJcB-lJSwDnykrci9OoljCxIr8bzEGJz-K&_nc_zt=23&_nc_ht=scontent.fltn4-1.fna&_nc_gid=2KM11XS369ylUsSZzTmGew&_nc_ss=7b2a8&oh=00_Af6PNVmhDJzfZrZCfLJXUNXvnrBMD-3wj8UQvYTlsocLqg&oe=6A067D2C",
    link: "https://www.brandshatch.co.uk/2026/june/tunerfest-south",
    isStatic: true
  },
  {
    id: 'static-2',
    title: "Isle of Wight Takeover",
    date: "Saturday, 16th May 2026",
    time: "10:00 AM",
    location: "Isle of Wight",
    description: "The ultimate weekend away for car enthusiasts. Join our club stand as we head over on the ferry for a massive island takeover.",
    image: "https://scontent.fltn4-1.fna.fbcdn.net/v/t39.30808-6/370897411_788936759904376_6556989917387874387_n.jpg?_nc_cat=100&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=BAm1Zb4f-a8Q7kNvwF4HI_P&_nc_oc=AdoHjuaouRTMphGXdxORfQlSFYaOroD7I3nl0lfqQkZpAyG2i1rLmcZEMgm5HRjZLJl3rYRR_4AemK172VSwxXe1&_nc_zt=23&_nc_ht=scontent.fltn4-1.fna&_nc_gid=EmZtuaqTOlSEllcyBAYDPA&_nc_ss=7b2a8&oh=00_Af5oVHzQmfxAuzDJ3SjQBwDnCKIR9t4QvxmZImjX9Z_j3w&oe=6A0678E0",
    link: "https://www.iowtakeover.co.uk/",
    isStatic: true
  },
  {
    id: 'static-3',
    title: "TRAX",
    date: "Sunday, 16th August 2026",
    time: "09:00 AM",
    location: "Silverstone Circuit",
    description: "Britain's biggest performance car show. We will have a dedicated club stand. Features live track time and professional drifting displays.",
    image: "https://scontent.fltn4-1.fna.fbcdn.net/v/t39.30808-6/597894646_1257634839745045_372102352193919714_n.jpg?_nc_cat=100&ccb=1-7&_nc_sid=2a1932&_nc_ohc=35X4SY7dnmkQ7kNvwEwboEG&_nc_oc=Adpg8NNV3a0AdvHzh8yEsEk_Qa3DtyI9a-SuyKblDuqTTqFiV8iWIqHOWc0djpS_gQ6z0ZS327EGchEspfksXzEf&_nc_zt=23&_nc_ht=scontent.fltn4-1.fna&_nc_gid=kofn6rvocXLB_bC8mS405w&_nc_ss=7b2a8&oh=00_Af6xgBQDE6Ks8tXI5Q5WdNok7Nw_o37QF3mqQJXef9ayuA&oe=6A069083",
    link: "https://traxshows.co.uk/",
    isStatic: true
  },
  {
    id: 'static-4',
    title: "Ford Fair",
    date: "Sunday, 23rd August 2026",
    time: "08:30 AM",
    location: "Silverstone Circuit",
    description: "The biggest and best Ford festival in Europe. Expect thousands of club cars, intense track action, and huge retail villages.",
    image: "https://scontent.fltn4-1.fna.fbcdn.net/v/t39.30808-6/597864318_1331850388984316_4749659490145813671_n.jpg?_nc_cat=103&ccb=1-7&_nc_sid=2a1932&_nc_ohc=Eyzst_iXSeEQ7kNvwF165SD&_nc_oc=AdoDsCCTTBzrUNBCRp75jZ0jIv8H2XjTev23iPy3bQNpiE5djXJXpSvQo0oJpyfotxjSytru99gpgebiIDOv8cQJ&_nc_zt=23&_nc_ht=scontent.fltn4-1.fna&_nc_gid=9XwwuzQfNhIwISHL8RR-KA&_nc_ss=7b2a8&oh=00_Af5tVKR_W4mxaLAaIVKvPgimkVJs48pQ6CJ_NztkYJQ3zw&oe=6A068DDB",
    link: "https://fordshows.co.uk/ford-fair",
    isStatic: true
  },
  {
    id: 'static-5',
    title: "Ford Power Live",
    date: "Sunday, 13th September 2026",
    time: "09:00 AM",
    location: "Brands Hatch Circuit, Kent",
    description: "A dedicated celebration of all things Ford, from classic RS models to the latest STs taking to the famous Indy circuit.",
    image: "https://i.ibb.co/Nd6d6L3m/Untitled-design-9.png",
    link: "https://www.fordpowerlive.co.uk/",
    isStatic: true
  },
  {
    id: 'static-6',
    title: "Lancing Motor Show",
    date: "Sunday, 27th September 2026",
    time: "09:00 AM",
    location: "Lancing Beach Green, West Sussex",
    description: "600+ cars on display at Lancing Beach Green. FREE ENTRY to public, with Children's Amusements, Trade Stalls, Hot & Cold Drinks, Food refreshments and much more to see and do on the day. A display of motoring excellence.",
    image: "https://scontent.fltn4-1.fna.fbcdn.net/v/t39.30808-6/673478652_1411226824381514_8742350712894671620_n.png?_nc_cat=108&ccb=1-7&_nc_sid=2a1932&_nc_ohc=HIDGrimsPmAQ7kNvwHOoubY&_nc_oc=AdrAY5sMilU7z84ghmC3VwRtoff35i3jmKvEEdmM2bUFHGBX7AS-wl4iiBmxSBroVyo6SJgOSKceHXnT3-telYcb&_nc_zt=23&_nc_ht=scontent.fltn4-1.fna&_nc_gid=ZjADEz4Aukm54gCOUIAKUw&_nc_ss=7b2a8&oh=00_Af58pi1U-_VlcuRajrZMqDu2Gk0NK83QXmn8qD7jv7Q01g&oe=6A06721B",
    link: "https://lancingmotorshow.onlineticketseller.com/",
    isStatic: true
  }
];

const STATIC_CHARITY = [
  {
    id: 1,
    title: "Coastguard Association 50th Anniversary",
    description: "Daily Ride South is supporting the Coastguard for their 50th year. These dedicated volunteers look after our coastline and are on call day and night. Purchase official merchandise to support them directly.",
    deadline: "31st December 2026",
    image: "https://i.ibb.co/WYSqmxk/Untitled-design-10.png",
    link: "https://coastguardassociation.sumupstore.com/"
  }
];

const STATIC_RAFFLES = [
  {
    id: 'mock-past-raffle',
    title: "Premium Prize Bundle",
    description: "A massive thank you to everyone who entered.",
    drawDate: "20th April 2026",
    ticketPrice: 5,
    totalTickets: 100,
    ticketsSold: 100,
    image: "https://i.ibb.co/fzbH9zQj/Whats-App-Image-2026-05-10-at-10-23-14-PM.jpg",
    isEnded: true,
    winner: "Steve Ronnie"
  }
];

// --- COMPONENTS ---

const HomeView = ({ clubDescription, spotlightMember, isBirthdaySpotlight }) => {
  return (
    <div className="space-y-6">
      <div className="w-full h-64 md:h-96 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 mb-6 relative group flex items-center justify-center">
        <img 
          src="https://i.ibb.co/dwGFSkDT/Whats-App-Image-2026-05-10-at-4.jpg" 
          alt="Daily Ride South Welcome" 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-black/40 to-black/20"></div>
        <img 
          src="https://i.ibb.co/xnqpNZV/Whats-App-Image-2026-05-10-at-4-19-50-PM.jpg" 
          alt="Daily Ride South Logo" 
          className="relative z-10 w-32 h-32 md:w-44 md:h-44 rounded-3xl object-cover border-4 border-black/50 shadow-[0_0_40px_rgba(236,72,153,0.3)] animate-in zoom-in duration-700" 
        />
      </div>

      <div className="bg-zinc-900/60 p-6 md:p-8 rounded-3xl border border-zinc-800/50 shadow-inner mb-10">
        <p className="text-zinc-300 text-sm md:text-base leading-relaxed mb-4 italic whitespace-pre-wrap">
          {clubDescription}
        </p>
        <div className="flex flex-wrap items-center gap-6 mt-6 pt-6 border-t border-zinc-800/50">
          <a href="https://www.facebook.com/daily.ride.south" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-pink-500 transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-widest">
            <FacebookIcon className="w-5 h-5" /> Facebook
          </a>
          <a href="https://www.instagram.com/daily.ride.south/" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-pink-500 transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-widest">
            <InstagramIcon className="w-5 h-5" /> Instagram
          </a>
        </div>
      </div>

      {spotlightMember && (
        <div className="mb-6 relative rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 h-64 md:h-80 cursor-pointer group" onClick={() => window.location.hash = 'members'}>
          <img src={(spotlightMember.cars && spotlightMember.cars[0]?.image) || DEFAULT_CAR} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Spotlight Car" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
          <div className="absolute top-4 right-4 bg-pink-600 text-white text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded shadow-lg backdrop-blur-md">
            {isBirthdaySpotlight ? '🎉 Happy Birthday! 🎉' : 'Member Spotlight'}
          </div>
          <div className="absolute bottom-6 left-6 flex items-center gap-4">
             <div className="relative">
               <img src={spotlightMember.avatar || DEFAULT_AVATAR} className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-black object-cover shadow-xl" alt={spotlightMember.name} />
             </div>
             <div>
                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-none">
                  {spotlightMember.name} {isBirthdaySpotlight && '🎂'}
                </h3>
                {spotlightMember.nickname && <p className="text-pink-500 italic text-lg md:text-xl font-medium leading-none mt-1">"{spotlightMember.nickname}"</p>}
                <p className="text-zinc-300 font-bold text-xs uppercase tracking-widest mt-2">{spotlightMember.role || 'Member'}</p>
                {(spotlightMember.cars && spotlightMember.cars[0]) && <p className="text-zinc-400 text-xs mt-1">{spotlightMember.cars[0].make} {spotlightMember.cars[0].model}</p>}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EventsView = ({ title, events, cloudRsvps, cloudMembers, user, toggleRsvp, isPast }) => {
  const handleRSVP = (event) => {
    const recipient = "Dailyridesouth@gmail.com";
    const subject = encodeURIComponent(`Questions about ${event.title}`);
    const body = encodeURIComponent(`Hi Daily Ride South team,\n\nI have a question regarding the following event:\n\nEvent: ${event.title}\nDate: ${event.date}\nLocation: ${event.location}\n\nThanks!`);
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  };

  const membersById = useMemo(() => {
    return cloudMembers.reduce((acc, member) => {
      acc[member.id] = member;
      return acc;
    }, {});
  }, [cloudMembers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-zinc-800 pb-2">
        <h2 className="text-3xl font-bold text-white">{title}</h2>
        <button 
          onClick={() => window.location.hash = isPast ? 'events' : 'past_events'}
          className="text-pink-500 hover:text-pink-400 flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors"
        >
          {isPast ? <><Calendar className="w-4 h-4" /> View Upcoming Events</> : <><History className="w-4 h-4" /> View Past Events Gallery</>}
        </button>
      </div>
      
      {events.length === 0 && (
        <p className="text-zinc-500 text-center py-12 italic border border-dashed border-zinc-800 rounded-3xl">
          No {isPast ? 'past' : 'upcoming'} events to display.
        </p>
      )}

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {events.map(event => {
          const eventRsvps = cloudRsvps[event.id] || { attending: [], attended: [] };
          const listField = isPast ? 'attended' : 'attending';
          const rsvpList = eventRsvps[listField] || [];
          const isMarked = user && rsvpList.includes(user.uid);
          
          const attendeeMembers = rsvpList.map(uid => 
            membersById[uid] || { id: uid, name: 'Member', avatar: DEFAULT_AVATAR }
          );

          return (
            <div key={event.id} className="bg-zinc-900 rounded-2xl overflow-hidden shadow-xl border border-zinc-800 flex flex-col transition-all hover:shadow-pink-500/5">
              <div className="h-48 overflow-hidden shrink-0 relative group">
                <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent"></div>
              </div>
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tighter leading-tight">{event.title}</h3>
                <div className="space-y-2 text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-pink-500" />
                    <span className="text-zinc-300">{event.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-pink-500" />
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-pink-500" />
                    <span className="truncate">{event.location}</span>
                  </div>
                </div>
                <p className="text-zinc-400 text-sm flex-grow mb-6 leading-relaxed">{event.description}</p>
                
                <div className="mt-auto">
                  <div className="pt-4 border-t border-zinc-800/50 mb-5">
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3">
                      {isPast ? 'Members who attended' : 'Members attending'}
                    </p>
                    <div className="flex -space-x-3 overflow-hidden">
                        {attendeeMembers.slice(0, 6).map(m => (
                          <img key={m.id} src={m.avatar || DEFAULT_AVATAR} title={m.name} className="inline-block h-10 w-10 rounded-full ring-2 ring-zinc-900 object-cover" alt="avatar" />
                        ))}
                        {attendeeMembers.length > 6 && (
                          <div className="flex items-center justify-center h-10 w-10 rounded-full ring-2 ring-zinc-900 bg-zinc-800 text-xs font-bold text-white z-10">
                            +{attendeeMembers.length - 6}
                          </div>
                        )}
                        {attendeeMembers.length === 0 && (
                          <span className="text-xs text-zinc-600 font-medium italic py-2">Be the first to mark your attendance!</span>
                        )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={() => toggleRsvp(event.id, isPast)}
                      className={`w-full font-black py-4 rounded-xl transition-all uppercase tracking-[0.2em] text-[10px] shadow-lg active:scale-[0.98] ${isMarked ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/20' : 'bg-pink-600 hover:bg-pink-700 text-white shadow-pink-500/20'}`}
                    >
                      {isMarked ? (isPast ? 'Attended ✓' : 'Attending ✓') : (isPast ? 'Mark as Attended' : 'Mark as Attending')}
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleRSVP(event)}
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-xl transition-colors border border-zinc-700 text-[10px] uppercase tracking-widest flex items-center justify-center"
                      >
                        Email Organiser
                      </button>
                      {event.link ? (
                        <a 
                          href={event.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-xl transition-colors border border-zinc-700 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                          Details <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <div className="w-full bg-zinc-800/50 text-zinc-600 font-bold py-3 rounded-xl border border-zinc-800/50 text-[10px] uppercase tracking-widest flex items-center justify-center cursor-not-allowed">
                          No Link
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MembersView = ({ members }) => {
  const [selectedMember, setSelectedMember] = useState(null);
  const [viewingCar, setViewingCar] = useState(null);

  useEffect(() => {
    const handlePopState = () => {
      if (viewingCar) {
        setViewingCar(null);
      } else if (selectedMember) {
        setSelectedMember(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [viewingCar, selectedMember]);

  const handleMemberClick = (member) => {
    window.history.pushState({ modal: 'member' }, '');
    setSelectedMember(member);
  };

  const closeMember = () => {
    setSelectedMember(null);
    window.history.back();
  };

  const handleCarClick = (car) => {
    window.history.pushState({ modal: 'car' }, '');
    setViewingCar(car);
  };

  const closeCar = () => {
    setViewingCar(null);
    window.history.back();
  };

  if (selectedMember) {
    const cars = selectedMember.cars || [];
    
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button 
          onClick={closeMember}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          Back to Directory
        </button>

        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 flex flex-col md:flex-row gap-6 items-start">
          <img 
            src={selectedMember.avatar || DEFAULT_AVATAR} 
            alt={selectedMember.name} 
            className="w-32 h-32 rounded-full object-cover border-4 border-zinc-800"
          />
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              {selectedMember.name}
              {selectedMember.nickname && <span className="text-zinc-500 text-xl font-normal italic">"{selectedMember.nickname}"</span>}
              {selectedMember.role === "Admin" && <Shield className="w-6 h-6 text-pink-500" />}
              {selectedMember.role === "Club President" && <Award className="w-6 h-6 text-yellow-500" />}
            </h2>
            <p className="text-pink-500 font-medium text-lg">{selectedMember.role || 'Member'}</p>
            <p className="text-zinc-400 mt-2 max-w-2xl">{selectedMember.bio || 'No bio provided.'}</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-4 flex-wrap">
              <p className="text-zinc-500 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Member since {selectedMember.joinDate}
              </p>
              {selectedMember.location && (
                <p className="text-zinc-500 text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> {selectedMember.location}
                </p>
              )}
              {selectedMember.instagram && (
                <a href={selectedMember.instagram} target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:text-pink-400 text-sm flex items-center gap-2 transition-colors font-bold uppercase tracking-widest">
                  <InstagramIcon className="w-4 h-4" /> Instagram Profile
                </a>
              )}
            </div>
          </div>
        </div>

        <h3 className="text-2xl font-bold text-white mt-8 mb-4 border-b border-zinc-800 pb-2">Garage Gallery</h3>
        <p className="text-sm text-zinc-500 mb-4 uppercase tracking-widest font-bold flex items-center gap-2">
          <ImageIcon className="w-4 h-4" /> Click on a vehicle to open the full gallery
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          {cars.map((car, idx) => (
            <div 
              key={idx} 
              onClick={() => handleCarClick(car)} 
              className="bg-zinc-900 rounded-xl overflow-hidden shadow-lg border border-zinc-800 cursor-pointer hover:border-pink-500 transition-all transform hover:-translate-y-1 group"
            >
              <div className="h-64 overflow-hidden relative">
                <img 
                  src={car.image || DEFAULT_CAR} 
                  alt={`${car.make} ${car.model}`} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80 group-hover:opacity-60 transition-opacity"></div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex justify-between items-end mb-1">
                    <h4 className="text-2xl font-bold text-white">{car.make} {car.model}</h4>
                    {car.reg && <span className="bg-yellow-400 text-black font-bold px-2 py-0.5 rounded text-xs tracking-wider">{car.reg.toUpperCase()}</span>}
                  </div>
                  <p className="text-zinc-300 font-medium">{car.year} • {car.specs}</p>
                  {car.mods && (
                    <p className="text-pink-400 text-sm font-medium mt-2 line-clamp-2">Mods: <span className="text-zinc-300 font-normal">{car.mods}</span></p>
                  )}
                  {car.gallery && car.gallery.length > 0 && (
                     <div className="mt-3 flex items-center gap-1 text-[10px] text-white font-bold uppercase tracking-widest bg-pink-600/80 w-fit px-2 py-1 rounded backdrop-blur-md">
                        <ImageIcon className="w-3 h-3" /> +{car.gallery.length} More Images
                     </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {cars.length === 0 && (
            <p className="text-zinc-500 italic col-span-2 py-10 text-center">No cars added to this garage yet.</p>
          )}
        </div>

        {/* Modal for viewing car gallery */}
        {viewingCar && (
          <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col p-4 md:p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
            <button 
                onClick={closeCar} 
                className="fixed top-6 right-6 bg-zinc-800 hover:bg-pink-600 text-white p-3 rounded-full transition-all z-[110] shadow-lg"
            >
                <X className="w-6 h-6"/>
            </button>
            <div className="w-full max-w-4xl mx-auto mt-10 md:mt-4 mb-20 flex flex-col">
              <div className="mb-8 shrink-0 text-center">
                <h3 className="text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter">
                    {viewingCar.make} <span className="text-pink-600 not-italic">{viewingCar.model}</span>
                </h3>
                {viewingCar.reg && <span className="inline-block mt-4 bg-yellow-400 text-black font-bold px-4 py-1.5 rounded-md text-sm tracking-[0.2em] uppercase">{viewingCar.reg}</span>}
                <p className="text-zinc-400 mt-6 text-sm md:text-base font-medium max-w-2xl mx-auto leading-relaxed">{viewingCar.specs}</p>
                {viewingCar.mods && <p className="text-pink-400 mt-4 text-sm font-medium">Mods: <span className="text-zinc-300 font-normal">{viewingCar.mods}</span></p>}
              </div>
              
              <div className="space-y-8">
                <img src={viewingCar.image || DEFAULT_CAR} className="w-full rounded-2xl object-cover shadow-2xl border border-zinc-800" alt="Main vehicle profile" />
                
                {viewingCar.gallery && viewingCar.gallery.map((img, i) => (
                  <img key={i} src={img} className="w-full rounded-2xl object-cover shadow-2xl border border-zinc-800" alt={`Gallery item ${i+1}`} />
                ))}
                
                {(!viewingCar.gallery || viewingCar.gallery.length === 0) && viewingCar.image && (
                   <p className="text-zinc-600 text-center uppercase tracking-[0.3em] text-xs font-bold py-16">End of Gallery</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-6 border-b border-zinc-800 pb-2">Members Directory</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {members.map(member => (
          <div 
            key={member.id} 
            onClick={() => handleMemberClick(member)}
            className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 hover:border-pink-500 hover:bg-zinc-800 transition-all cursor-pointer flex items-center gap-4"
          >
            <img src={member.avatar || DEFAULT_AVATAR} alt={member.name} className="w-16 h-16 rounded-full object-cover" />
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">
                {member.name || 'Anonymous Clubber'}
              </h3>
              {member.nickname && <p className="text-zinc-500 text-xs italic">"{member.nickname}"</p>}
              <p className="text-pink-500 text-xs font-semibold uppercase tracking-wider mt-1">{member.role || 'Member'}</p>
            </div>
          </div>
        ))}
        {members.length === 0 && <div className="col-span-full py-12 text-center text-zinc-500">No members found.</div>}
      </div>
    </div>
  );
};

const ImageUpload = ({ label, onUploadSuccess, className }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!auth.currentUser) {
        setErrorMsg("Please wait for authentication...");
        return;
    }

    setUploading(true);
    setErrorMsg(null);
    
    const storageRef = ref(storage, `artifacts/${appId}/users/${auth.currentUser.uid}/uploads/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
      (error) => { 
        console.error("Storage Error:", error); 
        setErrorMsg("Upload denied. Ensure your account is ready for user-specific data paths.");
        setUploading(false); 
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          onUploadSuccess(downloadURL);
          setUploading(false);
          setProgress(0);
        } catch (err) {
          setErrorMsg("Failed to generate public URL for image.");
          setUploading(false);
        }
      }
    );
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="block text-sm font-medium text-zinc-400">{label}</label>
      <div className="relative">
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileChange} 
          disabled={uploading} 
          className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-pink-600 file:text-white hover:file:bg-pink-700 bg-black border border-zinc-800 rounded-lg p-1 cursor-pointer" 
        />
        {uploading && (
          <div className="absolute inset-0 bg-black/80 rounded-lg flex items-center justify-center z-10 border border-pink-500">
            <span className="text-pink-500 text-sm font-bold animate-pulse">Uploading... {Math.round(progress)}%</span>
          </div>
        )}
      </div>
      {errorMsg && <p className="text-red-500 text-[10px] mt-1 font-bold uppercase tracking-widest">{errorMsg}</p>}
    </div>
  );
};

const ProfileView = ({ user, userProfile }) => {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [instagram, setInstagram] = useState('');
  const [birthdayDay, setBirthdayDay] = useState('');
  const [birthdayMonth, setBirthdayMonth] = useState('');
  const [avatar, setAvatar] = useState('');
  const [cars, setCars] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setNickname(userProfile.nickname || '');
      setBio(userProfile.bio || '');
      setLocation(userProfile.location || '');
      setInstagram(userProfile.instagram || '');
      setBirthdayDay(userProfile.birthdayDay || '');
      setBirthdayMonth(userProfile.birthdayMonth || '');
      setAvatar(userProfile.avatar || '');
      setCars(userProfile.cars || []);
    }
  }, [userProfile]);

  const handleSave = async () => {
    if (!user) return;
    try {
      const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'members', user.uid);
      await setDoc(profileRef, {
        name, nickname, bio, location, instagram, birthdayDay, birthdayMonth, avatar, cars,
        role: userProfile?.role || 'Member',
        joinDate: userProfile?.joinDate || formatDate(new Date())
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  if (!user) return <div className="text-center py-20 text-zinc-500 font-bold uppercase tracking-widest text-sm animate-pulse">Establishing Secure Connection...</div>;

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-700">
      <h2 className="text-3xl font-bold text-white border-b border-zinc-800 pb-4">My Profile</h2>
      <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-6 shadow-xl">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="shrink-0 flex flex-col items-center gap-4">
             <img src={avatar || DEFAULT_AVATAR} alt="" className="w-32 h-32 rounded-full object-cover border-4 border-zinc-800 bg-black shadow-inner shadow-pink-500/10" />
             <ImageUpload label="Change Avatar" onUploadSuccess={setAvatar} />
          </div>
          <div className="flex-grow grid sm:grid-cols-2 gap-4 h-fit">
            <InputField label="Full Name" value={name} onChange={e => setName(e.target.value)} />
            <InputField label="Nickname" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="E.g. Speedy" />
            <div className="sm:col-span-2 grid sm:grid-cols-2 gap-4">
                <InputField label="Town / City" value={location} onChange={e => setLocation(e.target.value)} />
                <InputField label="Instagram Profile Link" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="https://instagram.com/username" />
                <div className="sm:col-span-2 w-full">
                   <label className="block text-sm font-medium text-zinc-400 mb-1">Birthday (Optional)</label>
                   <div className="flex gap-2">
                     <select value={birthdayDay} onChange={e => setBirthdayDay(e.target.value)} className="w-1/3 bg-black border border-zinc-800 text-white rounded-lg p-3 outline-none focus:border-pink-500 transition-all appearance-none cursor-pointer">
                        <option value="">Day</option>
                        {[...Array(31)].map((_, i) => <option key={i+1} value={(i+1).toString()}>{i+1}{getOrdinalSuffix(i+1)}</option>)}
                     </select>
                     <select value={birthdayMonth} onChange={e => setBirthdayMonth(e.target.value)} className="w-2/3 bg-black border border-zinc-800 text-white rounded-lg p-3 outline-none focus:border-pink-500 transition-all appearance-none cursor-pointer">
                        <option value="">Month</option>
                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => <option key={i+1} value={(i+1).toString()}>{m}</option>)}
                     </select>
                   </div>
                </div>
            </div>
          </div>
        </div>
        <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-400">Short Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full bg-black border border-zinc-800 text-white rounded-lg p-3 outline-none focus:border-pink-500 transition-all" placeholder="Tell the club about yourself and your automotive history..." rows={3} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-12 border-b border-zinc-800 pb-4">
        <h3 className="text-2xl font-bold text-white">My Garage</h3>
        <button onClick={() => setCars(prev => [...prev, { reg: '', make: '', model: '', year: 2026, specs: '', mods: '', image: '', gallery: [] }])} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm border border-zinc-700 transition-colors"><Plus className="w-4 h-4" /> Add Vehicle</button>
      </div>

      <div className="space-y-6">
        {cars.map((car, idx) => (
          <div key={idx} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 relative shadow-lg animate-in slide-in-from-left-4 duration-300">
            <button onClick={() => setCars(prev => prev.filter((_, i) => i !== idx))} className="absolute top-4 right-4 text-zinc-500 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
            <div className="grid md:grid-cols-2 gap-4">
              <InputField label="Registration" value={car.reg} onChange={e => setCars(prev => prev.map((c, i) => i === idx ? { ...c, reg: e.target.value } : c))} />
              <InputField label="Make" value={car.make} onChange={e => setCars(prev => prev.map((c, i) => i === idx ? { ...c, make: e.target.value } : c))} />
              <InputField label="Model" value={car.model} onChange={e => setCars(prev => prev.map((c, i) => i === idx ? { ...c, model: e.target.value } : c))} />
              <InputField label="Year" type="number" value={car.year} onChange={e => setCars(prev => prev.map((c, i) => i === idx ? { ...c, year: e.target.value } : c))} />
              <InputField label="Specs" value={car.specs} onChange={e => setCars(prev => prev.map((c, i) => i === idx ? { ...c, specs: e.target.value } : c))} />
              <InputField label="Mods" value={car.mods} onChange={e => setCars(prev => prev.map((c, i) => i === idx ? { ...c, mods: e.target.value } : c))} />
              
              <div className="md:col-span-2 bg-black/30 p-4 rounded-lg border border-zinc-800/50 mt-2">
                  <ImageUpload label="Upload Main Vehicle Photo (Cover)" onUploadSuccess={url => setCars(prev => prev.map((c, i) => i === idx ? { ...c, image: url } : c))} />
                  {car.image && <p className="text-[10px] text-green-500 mt-2 font-bold uppercase tracking-widest flex items-center gap-1">Cover Photo Uploaded Successfully</p>}
              </div>

              <div className="md:col-span-2 mt-4 pt-4 border-t border-zinc-800/50">
                  <h4 className="text-sm font-medium text-zinc-400 mb-3">Additional Gallery Images</h4>
                  <div className="flex flex-wrap gap-3 mb-4">
                      {car.gallery && car.gallery.map((gImg, gIdx) => (
                          <div key={gIdx} className="relative w-24 h-24 group rounded-xl overflow-hidden border border-zinc-700 shadow-md">
                              <img src={gImg} alt={`Gallery item ${gIdx + 1}`} className="w-full h-full object-cover" />
                              <button 
                                  onClick={() => setCars(prev => prev.map((c, i) => i === idx ? { ...c, gallery: c.gallery.filter((_, deleteIdx) => deleteIdx !== gIdx) } : c))} 
                                  className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Remove image"
                              >
                                  <Trash2 className="w-6 h-6 text-red-500" />
                              </button>
                          </div>
                      ))}
                  </div>
                  <div className="bg-black/30 p-4 rounded-lg border border-zinc-800/50 border-dashed">
                      <ImageUpload 
                          label="Add Another Photo to Gallery" 
                          onUploadSuccess={url => setCars(prev => prev.map((c, i) => i === idx ? { ...c, gallery: [...(c.gallery || []), url] } : c))} 
                      />
                  </div>
              </div>
            </div>
          </div>
        ))}
        {cars.length === 0 && <div className="text-center py-10 text-zinc-600 italic">Your garage is currently empty.</div>}
      </div>

      <button onClick={handleSave} className={`w-full font-black py-4 rounded-xl flex items-center justify-center gap-2 text-lg shadow-lg transition-all transform active:scale-[0.98] ${saved ? 'bg-green-600' : 'bg-pink-600 hover:bg-pink-700 shadow-pink-500/20'}`}>
        <Save className="w-6 h-6" /> {saved ? "Changes Saved Successfully!" : "Save Profile & Garage"}
      </button>
    </div>
  );
};

const RafflesView = ({ raffles }) => {
  const handleReserve = (raffle) => {
    const recipient = "Dailyridesouth@gmail.com";
    const subject = encodeURIComponent(`Raffle Ticket Reservation: ${raffle.title}`);
    const body = encodeURIComponent(`Hi Daily Ride South team,\n\nI would like to reserve a ticket for the following raffle:\n\nPrize: ${raffle.title}\nTicket Cost: £${raffle.ticketPrice}\n\nPlease let me know the payment details.\n\nThanks!`);
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  };

  const activeRaffles = raffles.filter(r => !r.isEnded);
  const pastRaffles = raffles.filter(r => r.isEnded);

  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white border-b border-zinc-800 pb-2">Active Raffles</h2>
        <div className="bg-zinc-900/60 p-6 md:p-8 rounded-3xl border border-zinc-800/50 shadow-inner mb-8">
          <p className="text-zinc-300 text-sm md:text-base leading-relaxed italic">
            Try your luck and win some incredible club prizes whilst raising funds to keep the club going. Once you have reserved your tickets, check the raffle whatsapp group for payment instructions.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {activeRaffles.map(raffle => {
            const progress = (raffle.ticketsSold / raffle.totalTickets) * 100;
            return (
              <div key={raffle.id} className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 flex flex-col md:flex-row hover:border-pink-500 transition-colors shadow-lg">
                <div className="md:w-2/5 h-48 md:h-auto relative">
                  <img src={raffle.image || DEFAULT_CAR} alt="" className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 bg-pink-600 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">£{raffle.ticketPrice} / Ticket</div>
                </div>
                <div className="p-5 md:w-3/5 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{raffle.title}</h3>
                    <p className="text-zinc-400 text-sm mt-1">{raffle.description}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-500 tracking-widest">
                        <span>{raffle.ticketsSold} Tickets Taken</span>
                        <span>{Math.round(progress)}% Full</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2 shadow-inner">
                      <div className="bg-pink-500 h-2 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(236,72,153,0.5)]" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-zinc-400 pt-2">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Draws {raffle.drawDate}</span>
                    <button onClick={() => handleReserve(raffle)} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-3 py-1 rounded border border-zinc-700 text-[10px] transition-colors uppercase tracking-widest">Reserve</button>
                  </div>
                </div>
              </div>
            );
          })}
          {activeRaffles.length === 0 && <p className="text-zinc-500 py-12 text-center col-span-full italic">No active raffles available at the moment. Check back soon!</p>}
        </div>
      </div>

      {pastRaffles.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-white border-b border-zinc-800 pb-2">Past Winners</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pastRaffles.map(raffle => (
              <div key={raffle.id} className="bg-zinc-900/50 rounded-2xl overflow-hidden border border-zinc-800 flex flex-col shadow-lg opacity-90 hover:opacity-100 transition-opacity">
                <div className="h-56 relative group">
                  <img src={raffle.image || DEFAULT_CAR} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                  <div className="absolute inset-0 bg-pink-900/20 mix-blend-multiply"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                     <span className="bg-black/90 text-pink-500 font-black text-xl uppercase tracking-[0.3em] px-6 py-3 border border-pink-500/50 transform -rotate-6 shadow-2xl backdrop-blur-sm">Concluded</span>
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-grow text-center items-center justify-center space-y-3">
                  <h3 className="text-xl font-black text-white truncate w-full uppercase tracking-tight">{raffle.title}</h3>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">Ended: {raffle.drawDate}</p>
                  <div className="mt-4 p-4 bg-zinc-950 rounded-xl w-full border border-zinc-800 shadow-inner">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 font-bold">Winner</p>
                    <p className="text-pink-500 font-black text-xl uppercase tracking-widest">{raffle.winner}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CharityView = () => (
  <div className="space-y-6">
    <h2 className="text-3xl font-bold text-white border-b border-zinc-800 pb-2">Charity Initiatives</h2>
    <div className="grid gap-6 lg:grid-cols-2">
      {STATIC_CHARITY.map(campaign => (
        <div key={campaign.id} className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 flex flex-col shadow-2xl">
          <div className="h-48 w-full overflow-hidden">
             <img src={campaign.image} alt="" className="h-full w-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
          <div className="p-5 space-y-4 flex-grow flex flex-col">
            <h3 className="text-2xl font-bold text-white leading-tight">{campaign.title}</h3>
            <p className="text-zinc-400 text-sm flex-grow">{campaign.description}</p>
            <a href={campaign.link} target="_blank" rel="noopener noreferrer" className="bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-pink-500/10 uppercase tracking-widest mt-auto"><Heart className="w-5 h-5 fill-white" /> Support the Coastguard</a>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AdminView = ({ members, combinedEvents, raffles, clubDescription, userProfile, spotlightMemberId }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(userProfile?.role === 'Admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', description: '', image: '', link: '' });
  const [editingEvent, setEditingEvent] = useState(null);
  const [newRaffle, setNewRaffle] = useState({ title: '', description: '', drawDate: '', ticketPrice: '', totalTickets: 100, ticketsSold: 0, image: '' });
  const [raffleWinners, setRaffleWinners] = useState({});
  const [editDescription, setEditDescription] = useState(clubDescription || '');
  const [editSpotlightId, setEditSpotlightId] = useState(spotlightMemberId || '');
  const [memberRoles, setMemberRoles] = useState({});
  const [memberRanks, setMemberRanks] = useState({});

  useEffect(() => {
    if (clubDescription) setEditDescription(clubDescription);
  }, [clubDescription]);

  useEffect(() => {
    if (spotlightMemberId) setEditSpotlightId(spotlightMemberId);
  }, [spotlightMemberId]);

  useEffect(() => {
    const handlePopState = () => {
      if (editingEvent) setEditingEvent(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [editingEvent]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'dailyride2026' || userProfile?.role === 'Admin') { 
        setIsAuthenticated(true); 
        setError(''); 
    } else { 
        setError('Access Denied: Incorrect credentials.'); 
    }
  };

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const editableUpcoming = useMemo(() => 
    combinedEvents.filter(e => parseEventDateStr(e.date) >= now).sort((a, b) => parseEventDateStr(a.date) - parseEventDateStr(b.date)), 
    [combinedEvents, now]
  );
  
  const editablePast = useMemo(() => 
    combinedEvents.filter(e => parseEventDateStr(e.date) < now).sort((a, b) => parseEventDateStr(b.date) - parseEventDateStr(a.date)), 
    [combinedEvents, now]
  );

  const handleDeployEvent = async () => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'events'), newEvent);
      setNewEvent({ title: '', date: '', time: '', location: '', description: '', image: '', link: '' });
    } catch (err) {
      console.error("Error saving event:", err);
    }
  };

  const handleEditEvent = (event) => {
    window.history.pushState({ modal: 'editEvent' }, '');
    setEditingEvent(event);
  };

  const closeEditEvent = () => {
    setEditingEvent(null);
    window.history.back();
  };

  const handleUpdateEvent = async () => {
    try {
      if (editingEvent.isStatic) {
        const { isStatic, id, ...cleanEvent } = editingEvent;
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'events'), cleanEvent);
      } else {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', editingEvent.id), editingEvent, { merge: true });
      }
      setEditingEvent(null);
      window.history.back();
    } catch (err) {
      console.error("Error updating event:", err);
    }
  };

  const handleDeleteEvent = async () => {
    if (editingEvent.isStatic) {
        setEditingEvent(null);
        window.history.back();
        return;
    }
    if(!window.confirm('Delete this event from the database?')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', editingEvent.id));
      setEditingEvent(null);
      window.history.back();
    } catch (err) {
      console.error("Error deleting event:", err);
    }
  };

  const handlePublishRaffle = async () => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'raffles'), newRaffle);
      setNewRaffle({ title: '', description: '', drawDate: '', ticketPrice: '', totalTickets: 100, ticketsSold: 0, image: '' });
    } catch (err) {
      console.error("Error saving raffle:", err);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'clubInfo'), { 
        description: editDescription,
        spotlightMemberId: editSpotlightId 
      }, { merge: true });
    } catch (err) {
      console.error("Error saving settings:", err);
    }
  };

  const handleUpdateMember = async (memberId, currentData) => {
    try {
      const newRole = memberRoles[memberId] !== undefined ? memberRoles[memberId] : (currentData.role || 'Member');
      const newRank = memberRanks[memberId] !== undefined ? memberRanks[memberId] : (currentData.rank || '');
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', memberId), { 
        role: newRole,
        rank: newRank
      }, { merge: true });
    } catch (err) {
      console.error("Error updating member:", err);
    }
  };

  const handleExpelMember = async (memberId) => {
    if(!window.confirm('EXPEL MEMBER FROM CLUB?')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', memberId));
    } catch (err) {
      console.error("Error removing member:", err);
    }
  };

  if (!isAuthenticated) return (
    <div className="max-w-md mx-auto mt-20 animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-zinc-900 p-10 rounded-2xl border border-zinc-800 shadow-2xl">
        <div className="text-center mb-8">
            <Shield className="w-16 h-16 text-pink-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-white text-center uppercase tracking-tight">Admin Gateway</h2>
            <p className="text-zinc-500 text-xs mt-2 uppercase font-bold tracking-widest">DRS CLUB STAFF ONLY</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black border border-zinc-800 text-white rounded-xl p-4 outline-none focus:border-pink-500 text-center font-bold tracking-widest transition-all" placeholder="MASTER KEY" />
          {error && <p className="text-red-500 text-[10px] text-center font-black uppercase tracking-widest animate-bounce">{error}</p>}
          <button type="submit" className="w-full bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-pink-500/20 uppercase tracking-widest">Authorize Access</button>
        </form>
      </div>
    </div>
  );

  const EventListTile = ({ event }) => (
    <div 
      onClick={() => handleEditEvent(event)} 
      className="bg-black p-5 rounded-xl border border-zinc-800 flex flex-col justify-between group hover:border-pink-500 transition-colors cursor-pointer shadow-lg"
    >
       <div>
         <div className="flex justify-between items-start mb-2">
            <p className="text-white font-bold text-sm truncate uppercase tracking-wider flex-grow">{event.title}</p>
            {event.isStatic && <span className="bg-zinc-800 text-zinc-500 text-[8px] px-1.5 py-0.5 rounded border border-zinc-700 ml-2">Standard</span>}
         </div>
         <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-2"><Calendar className="w-3 h-3"/> {event.date}</p>
       </div>
       <p className="text-pink-600 text-[9px] uppercase font-black tracking-widest mt-4 opacity-0 group-hover:opacity-100 transition-opacity">Edit Details</p>
    </div>
  );

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-24 animate-in fade-in duration-700">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <h2 className="text-3xl font-black text-white flex items-center gap-3 uppercase tracking-tighter"><Shield className="w-8 h-8 text-pink-500" /> Club Control Panel</h2>
        <span className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">Verified Admin</span>
      </div>
      
      <section className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 space-y-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-pink-500"></div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-widest"><Plus className="w-5 h-5 text-pink-500" /> Deploy New Event</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <InputField label="Event Title" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
          <InputField label="Date (e.g. Sunday, 1st Oct)" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
          <InputField label="Start Time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
          <InputField label="Location / Venue" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} />
          <div className="md:col-span-2 bg-black/30 p-4 rounded-lg border border-zinc-800/50">
             <ImageUpload label="Upload Event Poster Image" onUploadSuccess={url => setNewEvent({...newEvent, image: url})} />
             {newEvent.image && <p className="text-[10px] text-green-500 mt-2 font-bold uppercase tracking-widest">Poster Uploaded Successfully</p>}
          </div>
          <InputField label="External Ticket Link" value={newEvent.link} onChange={e => setNewEvent({...newEvent, link: e.target.value})} />
          <div className="md:col-span-2 space-y-1">
             <label className="block text-sm font-medium text-zinc-400">Event Description</label>
             <textarea className="w-full bg-black border border-zinc-800 text-white rounded-xl p-4 outline-none focus:border-pink-500 transition-all" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} placeholder="Detailed brief for club members..." rows={3} />
          </div>
          <button onClick={handleDeployEvent} className="md:col-span-2 bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-xl transition-all uppercase tracking-[0.2em] shadow-lg shadow-pink-500/20">Publish to Public Board</button>
        </div>
      </section>

      <section className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 space-y-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-pink-500"></div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-widest"><Edit3 className="w-5 h-5 text-pink-500" /> Manage Existing Events</h3>
        
        {editingEvent ? (
          <div className="grid md:grid-cols-2 gap-6 bg-black/50 p-6 rounded-2xl border border-pink-500/50 animate-in zoom-in-95 duration-300">
            <div className="md:col-span-2 flex justify-between items-center border-b border-zinc-800 pb-4">
               <div>
                  <h4 className="font-bold text-white uppercase tracking-wider">Editing: {editingEvent.title}</h4>
                  {editingEvent.isStatic && <p className="text-zinc-500 text-[10px] mt-1 italic font-bold">Standard event: Saving will create a database copy.</p>}
               </div>
               <button onClick={closeEditEvent} className="text-zinc-400 hover:text-white bg-zinc-900 p-2 rounded-lg transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <InputField label="Event Title" value={editingEvent.title} onChange={e => setEditingEvent({...editingEvent, title: e.target.value})} />
            <InputField label="Date (e.g. Sunday, 1st Oct)" value={editingEvent.date} onChange={e => setEditingEvent({...editingEvent, date: e.target.value})} />
            <InputField label="Start Time" value={editingEvent.time} onChange={e => setEditingEvent({...editingEvent, time: e.target.value})} />
            <InputField label="Location / Venue" value={editingEvent.location} onChange={e => setEditingEvent({...editingEvent, location: e.target.value})} />
            <div className="md:col-span-2 bg-black/50 p-4 rounded-lg border border-zinc-800/50">
               <ImageUpload label="Update Event Poster" onUploadSuccess={url => setEditingEvent({...editingEvent, image: url})} />
               {editingEvent.image && <img src={editingEvent.image} alt="preview" className="mt-4 h-24 rounded-lg border border-zinc-700 object-cover" />}
            </div>
            <InputField label="External Ticket Link" value={editingEvent.link || ''} onChange={e => setEditingEvent({...editingEvent, link: e.target.value})} />
            <div className="md:col-span-2 space-y-1">
               <label className="block text-sm font-medium text-zinc-400">Event Description</label>
               <textarea className="w-full bg-black border border-zinc-800 text-white rounded-xl p-4 outline-none focus:border-pink-500 transition-all" value={editingEvent.description} onChange={e => setEditingEvent({...editingEvent, description: e.target.value})} rows={3} />
            </div>
            <div className="md:col-span-2 flex gap-4 mt-2">
              <button onClick={handleUpdateEvent} className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-pink-500/20">Save Changes</button>
              {!editingEvent.isStatic && (
                <button onClick={handleDeleteEvent} className="flex-1 bg-red-900/50 hover:bg-red-600 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest">Delete Event</button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {editableUpcoming.length > 0 && (
              <div>
                <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em] mb-4 border-l-2 border-pink-500 pl-3">Upcoming Events</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {editableUpcoming.map(e => <EventListTile key={e.id} event={e} />)}
                </div>
              </div>
            )}
            
            {editablePast.length > 0 && (
              <div>
                <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em] mb-4 border-l-2 border-zinc-700 pl-3">Past Events</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {editablePast.map(e => <EventListTile key={e.id} event={e} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 space-y-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-pink-500"></div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-widest"><Ticket className="w-5 h-5 text-pink-500" /> Raffle Administration</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <InputField label="Prize Title" value={newRaffle.title} onChange={e => setNewRaffle({...newRaffle, title: e.target.value})} />
          <InputField label="Live Draw Date" value={newRaffle.drawDate} onChange={e => setNewRaffle({...newRaffle, drawDate: e.target.value})} />
          <InputField label="Ticket Cost (£)" value={newRaffle.ticketPrice} onChange={e => setNewRaffle({...newRaffle, ticketPrice: e.target.value})} />
          <InputField label="Maximum Ticket Cap" type="number" value={newRaffle.totalTickets} onChange={e => setNewRaffle({...newRaffle, totalTickets: Number(e.target.value)})} />
          <div className="md:col-span-2 bg-black/30 p-4 rounded-lg border border-zinc-800/50">
             <ImageUpload label="Upload Prize Image" onUploadSuccess={url => setNewRaffle({...newRaffle, image: url})} />
             {newRaffle.image && <p className="text-[10px] text-green-500 mt-2 font-bold uppercase tracking-widest">Prize Photo Uploaded Successfully</p>}
          </div>
          <div className="md:col-span-2 space-y-1">
             <label className="block text-sm font-medium text-zinc-400">Raffle Terms / Details</label>
             <textarea className="w-full bg-black border border-zinc-800 text-white rounded-xl p-4 outline-none focus:border-pink-500 transition-all" value={newRaffle.description} onChange={e => setNewRaffle({...newRaffle, description: e.target.value})} placeholder="What's for grabs?..." rows={3} />
          </div>
          <button onClick={handlePublishRaffle} className="md:col-span-2 bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-xl transition-all uppercase tracking-[0.2em] shadow-lg shadow-pink-500/20">Go Live with Raffle</button>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8 pt-8 border-t border-zinc-800/50">
          {raffles.map(r => (
            <div key={r.id} className="bg-black p-4 rounded-xl border border-zinc-800 flex flex-col justify-between group hover:border-pink-900 transition-colors">
              <div>
                <p className="text-white font-bold text-sm truncate uppercase tracking-wider">{r.title}</p>
                {r.isEnded ? (
                  <div className="mt-4 p-3 bg-pink-900/20 border border-pink-500/30 rounded-lg text-center">
                    <span className="text-pink-500 font-black uppercase text-xs tracking-widest">Winner: {r.winner}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-4 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800/50">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.1em] italic">Tickets Sold:</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={async () => {
                          if (r.id.startsWith('mock-')) return;
                          try {
                            const newVal = Math.max(0, (r.ticketsSold || 0) - 1);
                            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'raffles', r.id), { ticketsSold: newVal }, { merge: true });
                          } catch (err) { console.error(err); }
                        }} 
                        className="text-zinc-400 hover:text-pink-500 font-black px-2 transition-colors text-lg leading-none"
                      >
                        -
                      </button>
                      <span className="text-white font-bold text-sm w-4 text-center">{r.ticketsSold || 0}</span>
                      <button 
                        onClick={async () => {
                          if (r.id.startsWith('mock-')) return;
                          try {
                            const newVal = Math.min(r.totalTickets, (r.ticketsSold || 0) + 1);
                            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'raffles', r.id), { ticketsSold: newVal }, { merge: true });
                          } catch (err) { console.error(err); }
                        }} 
                        className="text-zinc-400 hover:text-pink-500 font-black px-2 transition-colors text-lg leading-none"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {!r.isEnded && !r.id.startsWith('mock-') && (
                <div className="mt-4 pt-4 border-t border-zinc-800/50 space-y-2">
                  <input 
                    type="text" 
                    placeholder="Winner's Name" 
                    value={raffleWinners[r.id] || ''} 
                    onChange={e => setRaffleWinners({...raffleWinners, [r.id]: e.target.value})} 
                    className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg p-2 text-xs outline-none focus:border-pink-500 transition-colors" 
                  />
                  <button 
                    onClick={async () => { 
                      if (!raffleWinners[r.id]) return;
                      try {
                        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'raffles', r.id), { isEnded: true, winner: raffleWinners[r.id] }, { merge: true });
                      } catch (err) { console.error(err); }
                    }} 
                    disabled={!raffleWinners[r.id]}
                    className="w-full bg-zinc-800 hover:bg-pink-600 disabled:opacity-50 disabled:hover:bg-zinc-800 text-white font-bold py-2 rounded-lg text-[10px] transition-all uppercase tracking-widest border border-zinc-700 hover:border-pink-500"
                  >
                    End & Announce
                  </button>
                </div>
              )}

              {!r.id.startsWith('mock-') && (
                <button 
                  onClick={async () => { 
                    if(window.confirm('PERMANENTLY DELETE RAFFLE?')) {
                      try {
                        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'raffles', r.id));
                      } catch (err) { console.error(err); }
                    }
                  }} 
                  className="text-red-900 group-hover:text-red-500 font-bold uppercase text-[9px] mt-4 flex items-center gap-1 transition-colors tracking-widest"
                >
                  <Trash2 className="w-3 h-3" /> Purge Entry
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8">
        <section className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden flex flex-col">
          <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest border-b border-zinc-800 pb-3 mb-4"><Edit3 className="w-4 h-4 text-pink-500" /> Club Homepage Settings</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-widest">Spotlight Member</label>
              <select value={editSpotlightId} onChange={e => setEditSpotlightId(e.target.value)} className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 outline-none focus:border-pink-500 transition-all appearance-none cursor-pointer">
                 <option value="">None</option>
                 {members.map(m => <option key={m.id} value={m.id}>{m.name || 'Anonymous'}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-widest">Club Description</label>
              <textarea 
                value={editDescription} 
                onChange={e => setEditDescription(e.target.value)} 
                className="w-full bg-black border border-zinc-800 text-white rounded-xl p-4 outline-none focus:border-pink-500 transition-all h-32 whitespace-pre-wrap"
              />
            </div>
            <button 
              onClick={handleUpdateSettings}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white font-black py-3 rounded-xl transition-all uppercase tracking-widest text-xs shadow-lg shadow-pink-500/20 active:scale-[0.98]"
            >
              Update Homepage Settings
            </button>
          </div>
        </section>

        <section className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden flex flex-col">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest"><Users className="w-4 h-4 text-pink-500" /> Member Moderation Hub</h3>
              <span className="text-[10px] text-zinc-500 font-bold uppercase italic">Rank members 1-5 to show them first</span>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {members.map(m => (
              <div key={m.id} className="flex flex-col gap-3 bg-black/50 p-4 rounded-xl border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-xs font-bold truncate max-w-[100px]">{m.name}</span>
                        {m.rank && (
                          <span className="bg-pink-600/20 text-pink-500 text-[9px] font-black px-1.5 py-0.5 rounded border border-pink-500/30">#{m.rank}</span>
                        )}
                      </div>
                      <span className="text-zinc-600 text-[9px] uppercase tracking-tighter">{m.nickname || 'NO NICKNAME'}</span>
                  </div>
                  <button onClick={() => handleExpelMember(m.id)} className="text-zinc-700 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2 mt-auto">
                   <div className="flex gap-2">
                     <div className="w-12 shrink-0">
                       <input 
                         type="number" 
                         min="1" 
                         max="5"
                         placeholder="#"
                         value={memberRanks[m.id] !== undefined ? memberRanks[m.id] : (m.rank || '')} 
                         onChange={e => setMemberRanks({...memberRanks, [m.id]: e.target.value})} 
                         className="w-full bg-zinc-900 border border-zinc-800 text-pink-500 rounded p-2 text-[10px] uppercase font-bold text-center outline-none focus:border-pink-500"
                       />
                     </div>
                     <input 
                       type="text" 
                       value={memberRoles[m.id] !== undefined ? memberRoles[m.id] : (m.role || 'Member')} 
                       onChange={e => setMemberRoles({...memberRoles, [m.id]: e.target.value})} 
                       className="flex-grow w-full bg-zinc-900 border border-zinc-800 text-pink-500 rounded p-2 text-[10px] uppercase font-bold tracking-wider outline-none focus:border-pink-500"
                     />
                   </div>
                   <button 
                     onClick={() => handleUpdateMember(m.id, m)}
                     className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded border border-zinc-700 transition-colors text-[10px] uppercase font-bold tracking-widest active:scale-95"
                   >
                     Update Status & Rank
                   </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [activeTab, setActiveTabState] = useState(() => window.location.hash.replace('#', '') || 'home');
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [cloudMembers, setCloudMembers] = useState([]);
  const [cloudEvents, setCloudEvents] = useState([]);
  const [cloudRaffles, setCloudRaffles] = useState([]);
  const [cloudRsvps, setCloudRsvps] = useState({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [clubDescription, setClubDescription] = useState("It started simply enough: just a petrol-head couple bonded by a shared love for burning fuel and draining bank accounts.\n\nToday? We have blossomed into a chaotic, dysfunctional family of high-revving enthusiasts, a collection of soot-belching dirty diesels, and one highly optimistic weirdo who thinks they can finish a 300-mile road trip in a glorified, battery-powered toaster. We are united by the smell of unburnt hydrocarbons (mostly) and a mutual inability to leave anything stock.");
  const [spotlightMemberId, setSpotlightMemberId] = useState(null);

  const setActiveTab = (tab) => {
    window.location.hash = tab;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      setActiveTabState(hash || 'home');
      setIsMenuOpen(false); 
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const sortedMembers = useMemo(() => {
    return [...cloudMembers].sort((a, b) => {
      const rankA = parseInt(a.rank) || 999;
      const rankB = parseInt(b.rank) || 999;
      if (rankA !== rankB) return rankA - rankB;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [cloudMembers]);

  const today = new Date();
  const currentDay = today.getDate().toString();
  const currentMonth = (today.getMonth() + 1).toString();

  const birthdayMember = useMemo(() => {
    return cloudMembers.find(m => m.birthdayDay === currentDay && m.birthdayMonth === currentMonth) || null;
  }, [cloudMembers, currentDay, currentMonth]);

  const isBirthdaySpotlight = !!birthdayMember;

  const spotlightMember = useMemo(() => {
    if (birthdayMember) return birthdayMember;
    return cloudMembers.find(m => m.id === spotlightMemberId) || null;
  }, [cloudMembers, spotlightMemberId, birthdayMember]);

  const combinedEvents = useMemo(() => {
    const cloudTitles = new Set(cloudEvents.map(e => e.title.toLowerCase()));
    const visibleStatic = STATIC_EVENTS.filter(s => !cloudTitles.has(s.title.toLowerCase()));
    return [...visibleStatic, ...cloudEvents];
  }, [cloudEvents]);

  const combinedRaffles = useMemo(() => [...STATIC_RAFFLES, ...cloudRaffles], [cloudRaffles]);

  const now = new Date();
  now.setHours(0, 0, 0, 0); 
  const upcomingEvents = useMemo(() => 
    combinedEvents.filter(e => parseEventDateStr(e.date) >= now).sort((a, b) => parseEventDateStr(a.date) - parseEventDateStr(b.date)), 
    [combinedEvents, now]
  );
  const pastEvents = useMemo(() => 
    combinedEvents.filter(e => parseEventDateStr(e.date) < now).sort((a, b) => parseEventDateStr(b.date) - parseEventDateStr(a.date)), 
    [combinedEvents, now]
  );

  useEffect(() => {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      signInWithCustomToken(auth, __initial_auth_token).catch(console.error);
    }
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const membersRef = collection(db, 'artifacts', appId, 'public', 'data', 'members');
    const unsubMembers = onSnapshot(membersRef, snapshot => {
      const f = []; snapshot.forEach(d => f.push({ id: d.id, ...d.data() })); setCloudMembers(f);
    }, (err) => console.error("Members error:", err));

    const eventsRef = collection(db, 'artifacts', appId, 'public', 'data', 'events');
    const unsubEvents = onSnapshot(eventsRef, snapshot => {
      const f = []; snapshot.forEach(d => f.push({ id: d.id, ...d.data() })); setCloudEvents(f);
    }, (err) => console.error("Events error:", err));

    const rafflesRef = collection(db, 'artifacts', appId, 'public', 'data', 'raffles');
    const unsubRaffles = onSnapshot(rafflesRef, snapshot => {
      const f = []; snapshot.forEach(d => f.push({ id: d.id, ...d.data() })); setCloudRaffles(f);
    }, (err) => console.error("Raffles error:", err));

    const rsvpsRef = collection(db, 'artifacts', appId, 'public', 'data', 'rsvps');
    const unsubRsvps = onSnapshot(rsvpsRef, snapshot => {
      const f = {}; snapshot.forEach(d => f[d.id] = d.data()); setCloudRsvps(f);
    }, (err) => console.error("RSVPs error:", err));
    
    const infoRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'clubInfo');
    const unsubInfo = onSnapshot(infoRef, d => {
      if (d.exists()) {
        if (d.data().description) setClubDescription(d.data().description);
        if (d.data().spotlightMemberId) setSpotlightMemberId(d.data().spotlightMemberId);
      }
    });

    return () => { unsubMembers(); unsubEvents(); unsubRaffles(); unsubRsvps(); unsubInfo(); };
  }, [user]);

  const toggleRsvp = async (eventId, isPast) => {
    if (!user) return;
    try {
      const rsvpDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rsvps', String(eventId));
      const currentEventRsvps = cloudRsvps[eventId] || { attending: [], attended: [] };
      const field = isPast ? 'attended' : 'attending';
      const list = currentEventRsvps[field] || [];
      const isMarked = list.includes(user.uid);
      
      const newList = isMarked ? list.filter(id => id !== user.uid) : [...list, user.uid];
      
      await setDoc(rsvpDocRef, {
        [field]: newList
      }, { merge: true });
    } catch (err) {
      console.error("Error saving RSVP:", err);
    }
  };

  if (isLoadingAuth) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-sm animate-pulse">Initialising Framework...</div>;
  }

  if (!user) {
    return <SplashView />;
  }

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'profile', label: 'My Profile', icon: UserCircle },
    { id: 'raffles', label: 'Raffles', icon: Ticket },
    { id: 'charity', label: 'Charity', icon: Heart },
  ];

  const currentUserProfile = cloudMembers.find(m => m.id === user?.uid) || null;

  const renderContent = () => {
    switch (activeTab) {
      case 'home': 
        return <HomeView clubDescription={clubDescription} spotlightMember={spotlightMember} isBirthdaySpotlight={isBirthdaySpotlight} />;
      case 'events': 
        return <EventsView title="Upcoming Events" events={upcomingEvents} cloudRsvps={cloudRsvps} cloudMembers={cloudMembers} user={user} toggleRsvp={toggleRsvp} isPast={false} />;
      case 'past_events': 
        return <EventsView title="Past Events Gallery" events={pastEvents} cloudRsvps={cloudRsvps} cloudMembers={cloudMembers} user={user} toggleRsvp={toggleRsvp} isPast={true} />;
      case 'members': return <MembersView members={sortedMembers} />;
      case 'profile': return <ProfileView user={user} userProfile={currentUserProfile} />;
      case 'raffles': return <RafflesView raffles={combinedRaffles} />;
      case 'charity': return <CharityView />;
      case 'admin': return <AdminView members={sortedMembers} combinedEvents={combinedEvents} raffles={combinedRaffles} clubDescription={clubDescription} userProfile={currentUserProfile} spotlightMemberId={spotlightMemberId} />;
      default: return <HomeView clubDescription={clubDescription} spotlightMember={spotlightMember} isBirthdaySpotlight={isBirthdaySpotlight} />;
    }
  };

  const NavLink = ({ item, mobile = false }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id || (activeTab === 'past_events' && item.id === 'events');
    return (
      <button onClick={() => setActiveTab(item.id)} className={`flex items-center gap-3 px-6 py-4 rounded-2xl transition-all ${isActive ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/20' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'} ${mobile ? 'w-full' : ''}`}>
        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-pink-500'}`} />
        <span className="font-black uppercase tracking-widest text-xs">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 font-sans pb-32 text-zinc-200 selection:bg-pink-500/30 selection:text-pink-200">
      <header className="bg-black/90 backdrop-blur-xl border-b border-zinc-900 sticky top-0 z-50 h-20 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 h-full flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('home')}>
            <div className="relative">
                <img src="https://i.ibb.co/xnqpNZV/Whats-App-Image-2026-05-10-at-4-19-50-PM.jpg" className="h-10 w-10 rounded-xl object-cover border border-zinc-800 transition-all group-hover:border-pink-500 shadow-lg shadow-pink-500/5" alt="" />
                <div className="absolute inset-0 bg-pink-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
            <h1 className="text-xl font-black text-white uppercase tracking-tighter italic h-fit">Daily Ride <span className="text-pink-600 not-italic">South</span></h1>
          </div>
          <button onClick={() => setIsMenuOpen(true)} className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-pink-500 hover:text-white hover:bg-pink-600 transition-all shadow-xl active:scale-95">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      {isMenuOpen && <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] animate-in fade-in duration-300" onClick={() => setIsMenuOpen(false)} />}
      <div className={`fixed top-0 right-0 h-full w-80 bg-zinc-950 z-[70] border-l border-zinc-800 transform transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) p-8 shadow-[0_0_50px_rgba(0,0,0,1)] ${isMenuOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'} overflow-y-auto`}>
        <div className="flex justify-between items-center mb-10">
          <div className="flex flex-col">
              <span className="text-white font-black uppercase text-xl tracking-tighter">DRS <span className="text-pink-600 italic">Menu</span></span>
              <span className="text-zinc-600 font-bold uppercase text-[10px] tracking-[0.3em]">Navigation Board</span>
          </div>
          <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        
        <nav className="space-y-3 mb-10">
          {navItems.map(item => <NavLink key={item.id} item={item} mobile />)}
        </nav>
        
        <div className="pt-8 border-t border-zinc-900 space-y-4">
          <div className="flex justify-center gap-6 mb-2">
            <a href="https://www.facebook.com/daily.ride.south" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-pink-500 transition-colors">
              <FacebookIcon className="w-6 h-6" />
            </a>
            <a href="https://www.instagram.com/daily.ride.south/" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-pink-500 transition-colors">
              <InstagramIcon className="w-6 h-6" />
            </a>
          </div>
          <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors uppercase tracking-widest text-xs font-bold">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
          <div className="p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 text-center mt-6">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2">Member Since 2026</p>
              <p className="text-white text-xs font-bold">Stay Tuned. Drive Hard.</p>
          </div>
          <div className="flex justify-center pt-4">
            <button onClick={() => { setActiveTab('admin'); setIsMenuOpen(false); window.scrollTo(0,0); }} className="text-zinc-700 hover:text-pink-500 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] border border-zinc-900 px-6 py-3 rounded-full hover:border-pink-900/30 transition-all active:scale-95 shadow-inner">
              <Lock className="w-3 h-3" /> Staff Entry
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 pt-10">
        {renderContent()}
      </main>

      <footer className="mt-32 border-t border-zinc-900 py-16 bg-black/40">
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="flex items-center gap-3 grayscale group-hover:grayscale-0 transition-all opacity-40 group-hover:opacity-100">
               <img src="https://i.ibb.co/xnqpNZV/Whats-App-Image-2026-05-10-at-4-19-50-PM.jpg" className="h-8 w-8 rounded-lg shadow-2xl" alt="" />
               <span className="text-zinc-400 font-black text-lg uppercase tracking-tighter italic">Daily Ride <span className="text-pink-600 not-italic">South</span> 2026</span>
            </div>
            <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2 group-hover:text-pink-500 transition-colors">Dailyridesouth@gmail.com</span>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-zinc-700 text-[10px] font-black uppercase tracking-[0.5em]">Webapp Created by Luke Martin</p>
            <div className="h-px w-12 bg-zinc-800 mx-auto"></div>
          </div>
          <div className="flex gap-6 mt-2">
            <a href="https://www.facebook.com/daily.ride.south" target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-pink-500 transition-colors">
              <FacebookIcon className="w-5 h-5" />
            </a>
            <a href="https://www.instagram.com/daily.ride.south/" target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-pink-500 transition-colors">
              <InstagramIcon className="w-5 h-5" />
            </a>
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={() => { setActiveTab('admin'); window.scrollTo(0,0); }} className="text-zinc-700 hover:text-pink-500 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] border border-zinc-900 px-6 py-3 rounded-full hover:border-pink-900/30 transition-all active:scale-95 shadow-inner">
              <Lock className="w-3 h-3" /> Staff Entry
            </button>
          </div>
        </div>
      </footer>

      {/* Bottom Nav Bar (Mobile View) */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/50 h-16 z-50 flex items-center justify-around px-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
         {navItems.slice(0, 4).map(item => {
           const Icon = item.icon;
           const isActive = activeTab === item.id || (activeTab === 'past_events' && item.id === 'events');
           return (
             <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center transition-all ${isActive ? 'text-pink-500 scale-110' : 'text-zinc-600'}`}>
               <Icon className={`w-5 h-5 ${isActive ? 'fill-pink-500/20' : ''}`} />
             </button>
           )
         })}
         <button onClick={() => setIsMenuOpen(true)} className="flex flex-col items-center text-zinc-600 hover:text-pink-500 transition-colors">
           <Menu className="w-5 h-5" />
         </button>
      </nav>
    </div>
  );
}