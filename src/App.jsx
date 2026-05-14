import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInAnonymously
} from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, deleteField, updateDoc } from 'firebase/firestore';
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
  Home,
  Eye,
  EyeOff,
  UserCog,
  Download,
  ChevronRight,
  CheckCircle2,
  Grid,
  Trophy,
  Video
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
  let cleanStr = dateStr.replace(/^[A-Za-z]+,\s*/, '').replace(/(\d+)(st|nd|rd|th)/, '$1');
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
  return isNaN(parsed) ? new Date(9999, 0, 1) : new Date(parsed);
};

const compressImage = (file, maxWidth = 1080, maxHeight = 1080, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".webp"), {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Canvas to Blob failed'));
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const compressImageFromUrl = async (url, maxWidth = 1080, maxHeight = 1080, quality = 0.8) => {
  try {
    const response = await fetch(url);
    const blobData = await response.blob();
    const localUrl = URL.createObjectURL(blobData);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(localUrl);
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], `compressed_${Date.now()}.webp`, {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Canvas to Blob failed'));
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = (error) => {
        URL.revokeObjectURL(localUrl);
        reject(error);
      };
      img.src = localUrl;
    });
  } catch (err) {
    throw err;
  }
};

const DEFAULT_AVATAR = "https://i.ibb.co/RTHHJ3JW/PROFILE-PIC.png";
const DEFAULT_CAR = "https://images.unsplash.com/photo-1502877338535-494e509f583b?auto=format&fit=crop&q=80&w=800";

// --- SHARED COMPONENTS ---
const FacebookIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
);

const InstagramIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);

const TikTokIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
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

const navItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'gallery', label: 'Gallery', icon: Grid },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'profile', label: 'My Profile', icon: UserCircle },
  { id: 'raffles', label: 'Raffles', icon: Ticket },
  { id: 'charity', label: 'Charity', icon: Heart },
];

const NavLink = ({ item, mobile = false, isActive, onClick }) => {
  const Icon = item.icon;
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-6 py-4 rounded-2xl transition-all ${isActive ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/20' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'} ${mobile ? 'w-full' : ''}`}>
      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-pink-500'}`} />
      <span className="font-black uppercase tracking-widest text-xs">{item.label}</span>
    </button>
  );
};

const EventListTile = ({ event, onEdit }) => (
  <div 
    onClick={() => onEdit(event)} 
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

const ImageUpload = ({ label, onUploadSuccess, className }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!auth.currentUser) {
        setErrorMsg("Please wait for authentication...");
        return;
    }

    setUploading(true);
    setErrorMsg(null);
    setProgress(0);
    setStatusText('Compressing...');
    
    try {
      const compressedFile = await compressImage(file, 1080, 1080, 0.8);
      setStatusText('Uploading...');
      
      const storageRef = ref(storage, `artifacts/${appId}/users/${auth.currentUser.uid}/uploads/${Date.now()}_${compressedFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`);
      const uploadTask = uploadBytesResumable(storageRef, compressedFile);

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
            setStatusText('');
          } catch (err) {
            setErrorMsg("Failed to generate public URL for image.");
            setUploading(false);
          }
        }
      );
    } catch (err) {
      console.error("Compression Error:", err);
      setErrorMsg("Failed to process image.");
      setUploading(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className || ''}`}>
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
            <span className="text-pink-500 text-sm font-bold animate-pulse">
              {statusText} {progress > 0 && statusText === 'Uploading...' ? `${Math.round(progress)}%` : ''}
            </span>
          </div>
        )}
      </div>
      {errorMsg && <p className="text-red-500 text-[10px] mt-1 font-bold uppercase tracking-widest">{errorMsg}</p>}
    </div>
  );
};

// --- MOCK DATA ---
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
    reservations: {},
    image: "https://i.ibb.co/fzbH9zQj/Whats-App-Image-2026-05-10-at-10-23-14-PM.jpg",
    isEnded: true,
    winner: "Steve Ronnie"
  }
];

const guideSections = [
  {
    id: '1',
    title: 'Managing Members',
    icon: Users,
    steps: [
      { title: 'View Profiles', content: 'Click on any member in the moderation hub to edit their profile details or update their status.' },
      { title: 'Ban/Hide', content: 'Use the eye icon to hide a member from the public directory. They will not know they are hidden.' },
      { title: 'Member Roles', content: 'Type a custom role (e.g. "Club President") and a rank (1-5) to pin them to the top of the directory.' }
    ]
  },
  {
    id: '2',
    title: 'Event Operations',
    icon: Calendar,
    steps: [
      { title: 'Deploy Events', content: 'Fill out the new event form. Include a what3words link for precise meeting points.' },
      { title: 'Guest Lists', content: 'Download a PDF roster of all attendees directly from the event card.' }
    ]
  },
  {
    id: '3',
    title: 'Raffle System',
    icon: Trophy,
    steps: [
      { title: 'Offline Tickets', content: 'If someone pays you in cash, use the "Add Manual Reservation" tool to insert their name into the drum.' },
      { title: 'The Draw Machine', content: 'Click "Launch Draw Machine" to record the winner selection. The system automatically weights the odds based on tickets held.' }
    ]
  }
];

// --- VIEWS ---

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

const AdminGuideView = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState(guideSections[0]);
  const [completedSteps, setCompletedSteps] = useState([]);

  const toggleStepCompletion = (stepTitle) => {
    if (completedSteps.includes(stepTitle)) {
      setCompletedSteps(completedSteps.filter(t => t !== stepTitle));
    } else {
      setCompletedSteps([...completedSteps, stepTitle]);
    }
  };

  const progressPercentage = Math.round(
    (completedSteps.length / guideSections.reduce((acc, curr) => acc + curr.steps.length, 0)) * 100
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group mb-4">
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        Back to Admin Panel
      </button>
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <Shield className="w-8 h-8 text-pink-500" />
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              Daily Ride <span className="text-pink-600 not-italic">South</span>
            </h1>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em]">Interactive Admin Manual</p>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex-1 md:w-48 bg-black border border-zinc-800 rounded-full h-3 p-0.5">
            <div className="bg-pink-500 h-full rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
          </div>
          <span className="text-xs font-bold text-pink-500 w-24 text-right">{progressPercentage}% Mastered</span>
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-8">
        <aside className="space-y-2">
          {guideSections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s)} className={`w-full text-left p-4 rounded-2xl border transition-all ${activeSection.id === s.id ? 'bg-zinc-900 border-pink-500 shadow-lg' : 'bg-black border-zinc-800'}`}>
              <h3 className="font-bold text-white">{s.title}</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{s.steps.length} Steps</p>
            </button>
          ))}
        </aside>
        <section className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-pink-500"></div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
             <activeSection.icon className="w-8 h-8 text-pink-500" /> {activeSection.title}
          </h2>
          <div className="space-y-4">
            {activeSection.steps.map((step, i) => {
              const isCompleted = completedSteps.includes(step.title);
              return (
                <div key={i} className={`p-6 rounded-xl border transition-all ${isCompleted ? 'border-pink-500/30 bg-black/50' : 'border-zinc-800 bg-black'}`}>
                  <div className="flex justify-between gap-4">
                    <div className="flex items-start gap-4">
                       <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 font-black text-xs border ${isCompleted ? 'bg-pink-600 border-pink-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400'}`}>{i + 1}</div>
                       <div>
                         <h4 className={`font-bold ${isCompleted ? 'text-pink-500' : 'text-white'}`}>{step.title}</h4>
                         <p className="text-zinc-400 text-sm mt-1">{step.content}</p>
                       </div>
                    </div>
                    <button onClick={() => toggleStepCompletion(step.title)} className={`p-2 rounded-full ${isCompleted ? 'text-pink-500' : 'text-zinc-600'}`}>
                       <CheckCircle2 className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

const MemberProfileModal = ({ member, onClose, onCarClick }) => {
  const cars = member.cars || [];
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-[40]">
      <button 
        onClick={onClose}
        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        Back
      </button>

      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 flex flex-col md:flex-row gap-6 items-start shadow-2xl">
        <img 
          src={member.avatar || DEFAULT_AVATAR} 
          alt={member.name} 
          className="w-32 h-32 rounded-full object-cover border-4 border-zinc-800"
        />
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            {member.name || 'Pending Setup'}
            {member.nickname && <span className="text-zinc-500 text-xl font-normal italic">"{member.nickname}"</span>}
            {member.role === "Admin" && <Shield className="w-6 h-6 text-pink-500" />}
            {member.role === "Club President" && <Award className="w-6 h-6 text-yellow-500" />}
          </h2>
          <p className="text-pink-500 font-medium text-lg">{member.role || 'Member'}</p>
          <p className="text-zinc-400 mt-2 max-w-2xl">{member.bio || 'No bio provided.'}</p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-4 flex-wrap">
            <p className="text-zinc-500 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Member since {member.joinDate}
            </p>
            {member.location && (
              <p className="text-zinc-500 text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4" /> {member.location}
              </p>
            )}
            {member.instagram && (
              <a href={member.instagram} target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:text-pink-400 text-sm flex items-center gap-2 transition-colors font-bold uppercase tracking-widest">
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
            onClick={() => onCarClick(car)} 
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
    </div>
  );
};

const CarGalleryModal = ({ viewingCar, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col p-4 md:p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
      <button 
          onClick={onClose} 
          className="fixed top-6 right-6 bg-zinc-800 hover:bg-pink-600 text-white p-3 rounded-full transition-all z-[110] shadow-lg"
      >
          <X className="w-6 h-6"/>
      </button>
      <div className="w-full max-w-4xl mx-auto mt-10 md:mt-4 mb-20 flex flex-col">
        <div className="mb-8 shrink-0 text-center">
          <h3 className="text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter">
              {viewingCar.make} <span className="text-pink-600 not-italic">{viewingCar.model}</span>
          </h3>
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
  );
};

const EnlargedImageModal = ({ imageObj, onClose, onMemberClick }) => {
  if (!imageObj) return null;
  return (
    <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
      <button onClick={onClose} className="fixed top-6 right-6 bg-zinc-800 hover:bg-pink-600 text-white p-3 rounded-full transition-all z-[120] shadow-lg">
        <X className="w-6 h-6" />
      </button>
      <div className="relative max-w-full max-h-full flex flex-col items-center">
        <div className="relative group overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl">
          <img src={imageObj.url} alt={imageObj.carName} className="max-w-full max-h-[85vh] object-contain rounded-2xl" />
          
          <div 
            onClick={() => { onClose(); onMemberClick(imageObj.member); }}
            className="absolute top-4 left-4 flex items-center gap-3 bg-black/40 backdrop-blur-md p-2 pr-5 rounded-full border border-white/10 hover:bg-pink-600 transition-all cursor-pointer group/member z-[130] shadow-2xl"
          >
            <img src={imageObj.member.avatar || DEFAULT_AVATAR} className="w-12 h-12 rounded-full border-2 border-white/20 object-cover" alt="" />
            <div className="flex flex-col">
              <span className="text-white font-black text-xs uppercase tracking-tighter leading-none">{imageObj.member.name || 'Pending Setup'}</span>
              <span className="text-white/60 group-hover/member:text-white/80 text-[8px] uppercase font-bold tracking-widest mt-1">View Garage</span>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pointer-events-none">
             <p className="text-white font-black text-xl md:text-2xl uppercase italic tracking-tighter">{imageObj.carName}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const GalleryView = ({ members, onImageClick }) => {
  const allImages = useMemo(() => {
    const images = [];
    members.forEach(member => {
      (member.cars || []).forEach(car => {
        if (car.image) images.push({ url: car.image, member, carName: `${car.make} ${car.model}` });
        (car.gallery || []).forEach(url => {
          if (url) images.push({ url, member, carName: `${car.make} ${car.model}` });
        });
      });
    });
    return images;
  }, [members]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-3xl font-bold text-white">Club Garage Gallery</h2>
        <p className="text-zinc-500 text-sm mt-1 uppercase tracking-widest font-bold">Every vehicle, every angle. Click to enlarge.</p>
      </div>
      <div className="columns-2 md:col-span-3 lg:columns-4 gap-4 space-y-4">
        {allImages.map((img, i) => (
          <div 
            key={i} 
            onClick={() => onImageClick(img)}
            className="relative group rounded-2xl overflow-hidden cursor-pointer border border-zinc-800 hover:border-pink-500 transition-all shadow-lg inline-block w-full"
          >
            <img src={img.url} alt="" className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105 block" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
               <p className="text-white font-black text-xs uppercase tracking-tighter">{img.carName}</p>
               <p className="text-pink-500 text-[10px] font-bold uppercase tracking-widest">{img.member.name || 'Pending Setup'}</p>
            </div>
          </div>
        ))}
      </div>
      {allImages.length === 0 && <p className="text-center py-20 text-zinc-600 italic">No garage images found yet.</p>}
    </div>
  );
};

const HomeView = ({ clubDescription, spotlightMember, isBirthdaySpotlight, onMemberClick, members, onImageClick }) => {
  const allImages = useMemo(() => {
    const imgs = [];
    members.forEach(m => {
      (m.cars || []).forEach(c => { 
         if(c.image) imgs.push({url: c.image, member: m, carName: `${c.make} ${c.model}`}); 
         (c.gallery || []).forEach(g => {
            if(g) imgs.push({url: g, member: m, carName: `${c.make} ${c.model}`});
         });
      });
    });
    return imgs;
  }, [members]);

  const [mosaicSlots, setMosaicSlots] = useState([]);
  const cycleRef = useRef({ slotIdx: 0, imgIdx: 8 });

  useEffect(() => {
    if (allImages.length === 0) return;
    const initialSlots = Array(8).fill(null).map((_, i) => ({
      current: allImages[i % allImages.length],
      previous: null,
      fadeKey: i
    }));
    setMosaicSlots(initialSlots);
    cycleRef.current = { slotIdx: 0, imgIdx: 8 % allImages.length };
  }, [allImages]);

  useEffect(() => {
    if (allImages.length <= 1) return;

    const interval = setInterval(() => {
      setMosaicSlots(prevSlots => {
        if (prevSlots.length < 8) return prevSlots;

        const { slotIdx, imgIdx } = cycleRef.current;
        const newSlots = [...prevSlots];

        newSlots[slotIdx] = {
          previous: newSlots[slotIdx].current,
          current: allImages[imgIdx],
          fadeKey: Date.now()
        };

        cycleRef.current = {
          slotIdx: (slotIdx + 1) % 8,
          imgIdx: (imgIdx + 1) % allImages.length
        };

        return newSlots;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [allImages]);

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes mosaicFade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .mosaic-fade-in {
          animation: mosaicFade 1.5s ease-in-out forwards;
        }
      `}</style>
      
      <div className="w-full h-64 md:h-96 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 mb-6 relative group flex items-center justify-center">
        <img src="https://i.ibb.co/dwGFSkDT/Whats-App-Image-2026-05-10-at-4.jpg" alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-black/40 to-black/20"></div>
        <img src="https://i.ibb.co/xnqpNZV/Whats-App-Image-2026-05-10-at-4-19-50-PM.jpg" className="relative z-10 w-32 h-32 md:w-44 md:h-44 rounded-3xl object-cover border-4 border-black/50 shadow-2xl" alt="" />
      </div>

      <div className="bg-zinc-900/60 p-6 md:p-8 rounded-3xl border border-zinc-800/50 shadow-inner mb-10">
        <p className="text-zinc-300 text-sm md:text-base leading-relaxed mb-4 italic whitespace-pre-wrap">{clubDescription}</p>
        <div className="flex flex-wrap items-center gap-6 mt-6 pt-6 border-t border-zinc-800/50">
          <a href="https://www.facebook.com/daily.ride.south" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-pink-500 transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-widest"><FacebookIcon className="w-5 h-5" /> Facebook</a>
          <a href="https://www.instagram.com/daily.ride.south/" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-pink-500 transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-widest"><InstagramIcon className="w-5 h-5" /> Instagram</a>
          <a href="https://www.tiktok.com/@dailyridesouth?_r=1&_t=ZN-96GvaNt02b9" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-pink-500 transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-widest"><TikTokIcon className="w-5 h-5" /> TikTok</a>
        </div>
      </div>

      <div 
        onClick={() => window.location.hash = 'raffles'}
        className="bg-gradient-to-r from-pink-600 to-pink-900 rounded-3xl p-6 md:p-8 flex items-center justify-between cursor-pointer hover:scale-[1.02] transition-transform shadow-xl shadow-pink-500/20 mb-10 group border border-pink-500/50"
      >
        <div className="flex items-center gap-4 md:gap-6">
          <div className="bg-white/20 p-3 md:p-4 rounded-full shadow-inner">
            <Ticket className="w-8 h-8 md:w-10 md:h-10 text-white" />
          </div>
          <div>
            <h3 className="text-xl md:text-3xl font-black text-white uppercase tracking-tighter">Live Club Raffles</h3>
            <p className="text-pink-200 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">Win premium prizes & support the club</p>
          </div>
        </div>
        <ChevronRight className="w-8 h-8 md:w-10 md:h-10 text-white group-hover:translate-x-2 transition-transform shrink-0" />
      </div>

      {spotlightMember && (
        <div className="mb-6 relative rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 h-64 md:h-80 cursor-pointer group" onClick={() => onMemberClick(spotlightMember)}>
          <img src={(spotlightMember.cars && spotlightMember.cars[0]?.image) || DEFAULT_CAR} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
          <div className="absolute top-4 right-4 bg-pink-600 text-white text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded shadow-lg backdrop-blur-md">{isBirthdaySpotlight ? '🎉 Happy Birthday! 🎉' : 'Member Spotlight'}</div>
          <div className="absolute bottom-6 left-6 flex items-center gap-4">
             <img src={spotlightMember.avatar || DEFAULT_AVATAR} className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-black object-cover shadow-xl" alt="" />
             <div>
                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-none">{spotlightMember.name || 'Pending Setup'} {isBirthdaySpotlight && '🎂'}</h3>
                {spotlightMember.nickname && <p className="text-pink-500 italic text-lg md:text-xl font-medium mt-1">"{spotlightMember.nickname}"</p>}
                <p className="text-zinc-300 font-bold text-xs uppercase tracking-widest mt-2">{spotlightMember.role || 'Member'}</p>
             </div>
          </div>
        </div>
      )}

      <div className="mt-12 space-y-4">
        <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2"><Grid className="w-5 h-5 text-pink-500" /> Live Club Mosaic</h3>
            <button onClick={() => window.location.hash = 'gallery'} className="text-pink-500 hover:text-pink-400 text-xs font-bold uppercase tracking-widest">View Full Gallery</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {mosaicSlots.map((slot, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden border border-zinc-800 cursor-pointer hover:border-pink-500 transition-colors group relative bg-zinc-900 shadow-inner">
                {slot.previous && (
                  <img src={slot.previous.url} className="absolute inset-0 w-full h-full object-cover" alt="" />
                )}
                {slot.current && (
                  <div 
                    key={slot.fadeKey} 
                    onClick={() => onImageClick(slot.current)} 
                    className="absolute inset-0 w-full h-full mosaic-fade-in z-10"
                  >
                    <img src={slot.current.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                  </div>
                )}
              </div>
            ))}
            {allImages.length === 0 && <p className="col-span-full py-10 text-center text-zinc-600 text-sm italic">Gallery mosaic is building...</p>}
        </div>
      </div>
    </div>
  );
};

const EventsView = ({ title, events, cloudRsvps, cloudMembers, user, userProfile, toggleRsvp, isPast, onMemberClick }) => {
  const isAdmin = userProfile?.role === 'Admin';
  
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

  const downloadGuestList = async (event, attendees) => {
    try {
      const { jsPDF } = await import('https://esm.sh/jspdf@2.5.1');
      const autoTableModule = await import('https://esm.sh/jspdf-autotable@3.8.2');
      const autoTable = autoTableModule.default;
      
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Guest List: ${event.title}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Date: ${event.date} | Time: ${event.time}`, 14, 22);
      
      autoTable(doc, {
        startY: 30,
        head: [['#', 'Name', 'Nickname', 'Vehicle']],
        body: attendees.map((m, i) => [
          i + 1,
          m.name || 'Pending Setup',
          m.nickname || '-',
          m.cars && m.cars[0] ? `${m.cars[0].make} ${m.cars[0].model}` : '-'
        ])
      });
      
      doc.save(`${event.title.replace(/\s+/g, '_')}_GuestList.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF", err);
      alert("Failed to download PDF. Please try again later.");
    }
  };

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
            membersById[uid] || { id: uid, name: 'Guest (In-App Browser)', avatar: DEFAULT_AVATAR }
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

                {(event.meetingPoint || event.meetingTime || event.w3w) && (
                  <div className="mt-2 mb-4 p-3 bg-zinc-950 rounded-xl border border-zinc-800/50 space-y-2">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Pre-Meet Details</p>
                    {event.meetingTime && (
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="w-3 h-3 text-pink-500" />
                        <span className="text-zinc-300">Meet at {event.meetingTime}</span>
                      </div>
                    )}
                    {event.meetingPoint && (
                      <div className="flex items-center gap-2 text-xs">
                        <MapPin className="w-3 h-3 text-pink-500" />
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.meetingPoint)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pink-500 hover:text-pink-400 transition-colors underline decoration-pink-500/30 underline-offset-2 truncate"
                        >
                          {event.meetingPoint}
                        </a>
                      </div>
                    )}
                    {event.w3w && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-pink-500 font-bold">///</span>
                        <a 
                          href={`https://what3words.com/${event.w3w.replace('///', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pink-500 hover:text-pink-400 transition-colors truncate"
                        >
                          {event.w3w.replace('///', '')}
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-zinc-400 text-sm flex-grow mb-6 leading-relaxed">{event.description}</p>
                
                <div className="mt-auto">
                  <div className="pt-4 border-t border-zinc-800/50 mb-5">
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3">
                      {isPast ? 'Members who attended' : 'Members attending'}
                    </p>
                    <div className="flex -space-x-3 overflow-hidden p-1">
                        {attendeeMembers.slice(0, 6).map(m => (
                          <img 
                            key={m.id} 
                            src={m.avatar || DEFAULT_AVATAR} 
                            title={m.name || 'Pending Setup'} 
                            onClick={(e) => { e.stopPropagation(); onMemberClick(m); }}
                            className="inline-block h-10 w-10 rounded-full ring-2 ring-zinc-900 object-cover cursor-pointer hover:scale-110 transition-transform relative z-10 hover:z-20 shadow-lg" 
                            alt="avatar" 
                          />
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
                    {isAdmin && (
                      <button 
                        onClick={() => downloadGuestList(event, attendeeMembers)}
                        className="w-full bg-zinc-950 hover:bg-black text-pink-500 font-bold py-2 rounded-xl transition-colors border border-zinc-800 hover:border-pink-500/50 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <Download className="w-3 h-3" /> Download Guest List
                      </button>
                    )}
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

const MembersView = ({ members, onMemberClick }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-6 border-b border-zinc-800 pb-2">Members Directory</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {members.map(member => (
          <div 
            key={member.id} 
            onClick={() => onMemberClick(member)}
            className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 hover:border-pink-500 hover:bg-zinc-800 transition-all cursor-pointer flex items-center gap-4"
          >
            <img src={member.avatar || DEFAULT_AVATAR} alt={member.name} className="w-16 h-16 rounded-full object-cover" />
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">
                {member.name || 'Pending Setup'}
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

const ProfileView = ({ user, userProfile, isForcedSetup }) => {
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
        joinDate: userProfile?.joinDate || formatDate(new Date()),
        email: user.email || '' 
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
      
      {isForcedSetup && (
        <div className="bg-orange-500/20 border border-orange-500/50 p-6 rounded-2xl mb-8 flex items-center gap-4">
          <Lock className="w-8 h-8 text-orange-500 shrink-0" />
          <div>
            <h3 className="text-orange-500 font-black uppercase tracking-widest">Club Access Locked</h3>
            <p className="text-zinc-300 text-sm mt-1">Welcome to Daily Ride South! Please complete your profile details below (at least your Full Name) and save to unlock the rest of the application.</p>
          </div>
        </div>
      )}

      <h2 className="text-3xl font-bold text-white border-b border-zinc-800 pb-4">My Profile</h2>
      <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-6 shadow-xl">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="shrink-0 flex flex-col items-center gap-4">
             <img src={avatar || DEFAULT_AVATAR} alt="" className="w-32 h-32 rounded-full object-cover border-4 border-zinc-800 bg-black shadow-inner shadow-pink-500/10" />
             <ImageUpload label="Change Avatar" onUploadSuccess={setAvatar} />
          </div>
          <div className="flex-grow grid sm:grid-cols-2 gap-4 h-fit">
            <InputField label="Full Name (Required)" value={name} onChange={e => setName(e.target.value)} required={true} />
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
        <button onClick={() => setCars(prev => [...prev, { make: '', model: '', year: 2026, specs: '', mods: '', image: '', gallery: [] }])} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm border border-zinc-700 transition-colors"><Plus className="w-4 h-4" /> Add Vehicle</button>
      </div>

      <div className="space-y-6">
        {cars.map((car, idx) => (
          <div key={idx} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 relative shadow-lg animate-in slide-in-from-left-4 duration-300">
            <button onClick={() => setCars(prev => prev.filter((_, i) => i !== idx))} className="absolute top-4 right-4 text-zinc-500 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
            <div className="grid md:grid-cols-2 gap-4">
              <InputField label="Make" value={car.make} onChange={e => setCars(prev => prev.map((c, i) => i === idx ? { ...c, make: e.target.value } : c))} />
              <InputField label="Model" value={car.model} onChange={e => setCars(prev => prev.map((c, i) => i === idx ? { ...c, model: e.target.value } : c))} />
              <InputField label="Year" type="number" value={car.year} onChange={e => setCars(prev => prev.map((c, i) => i === idx ? { ...c, year: e.target.value } : c))} />
              <InputField label="Specs" value={car.specs} onChange={e => setCars(prev => prev.map((c, i) => i === idx ? { ...c, specs: e.target.value } : c))} />
              <div className="md:col-span-2">
                <InputField label="Mods" value={car.mods} onChange={e => setCars(prev => prev.map((c, i) => i === idx ? { ...c, mods: e.target.value } : c))} />
              </div>
              
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

      <button onClick={handleSave} disabled={!name.trim()} className={`w-full font-black py-4 rounded-xl flex items-center justify-center gap-2 text-lg shadow-lg transition-all transform active:scale-[0.98] ${saved ? 'bg-green-600' : 'bg-pink-600 hover:bg-pink-700 shadow-pink-500/20'} disabled:opacity-50 disabled:hover:bg-pink-600`}>
        <Save className="w-6 h-6" /> {saved ? "Changes Saved Successfully!" : "Save Profile & Garage"}
      </button>
    </div>
  );
};

const RaffleDrawModal = ({ raffle, members, onClose, onSetWinner }) => {
  const [pool, setPool] = useState([]);
  const [currentName, setCurrentName] = useState('READY TO SPIN');
  const [isDrawing, setIsDrawing] = useState(false);
  const [winner, setWinner] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const currentNameRef = useRef('READY TO SPIN');
  const isWinnerRef = useRef(false);

  useEffect(() => {
    const newPool = [];
    const appRes = raffle.reservations || {};
    const offRes = raffle.offlineReservations || {};

    const membersById = members.reduce((acc, m) => { acc[m.id] = m; return acc; }, {});

    Object.keys(appRes).forEach(uid => {
      const m = membersById[uid] || { name: 'Guest (In-App Browser)' };
      for (let i=0; i<appRes[uid]; i++) newPool.push(m.name);
    });

    Object.keys(offRes).forEach(gid => {
      for (let i=0; i<offRes[gid].count; i++) newPool.push(offRes[gid].name);
    });

    setPool(newPool.sort(() => 0.5 - Math.random()));
  }, [raffle, members]);

  const drawFrame = (name, isWinnerStatus) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const w = 800;
    const h = 600;

    // Background
    ctx.fillStyle = '#09090b'; 
    ctx.fillRect(0, 0, w, h);

    // Main Headers
    ctx.fillStyle = '#ec4899';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DAILY RIDE SOUTH OFFICIAL DRAW', w / 2, 100);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(raffle.title.toUpperCase(), w / 2, 150);

    // Box Background
    ctx.fillStyle = isWinnerStatus ? '#422006' : '#18181b';
    ctx.fillRect(50, 220, 700, 160);
    
    // Box Border (with Glow)
    ctx.shadowColor = isWinnerStatus ? '#eab308' : '#ec4899';
    ctx.shadowBlur = isWinnerStatus ? 30 : 10;
    ctx.strokeStyle = isWinnerStatus ? '#eab308' : '#27272a';
    ctx.lineWidth = 4;
    ctx.strokeRect(50, 220, 700, 160);
    ctx.shadowBlur = 0; // Reset blur for text

    // Name Text
    ctx.fillStyle = isWinnerStatus ? '#ffffff' : '#d4d4d8';
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText(name.toUpperCase(), w / 2, 320);

    // Winner Banner
    if (isWinnerStatus) {
      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 40px sans-serif';
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 20;
      ctx.fillText('WINNER WINNER!', w / 2, 460);
      ctx.shadowBlur = 0;
    }
  };

  const startDraw = () => {
    if (pool.length === 0) {
      setCurrentName('NO TICKETS SOLD');
      return;
    }
    
    setIsDrawing(true);
    setWinner(null);
    setVideoUrl(null);
    isWinnerRef.current = false;
    chunksRef.current = [];

    // Attempt to start Video Recording via hidden canvas
    try {
      const stream = canvasRef.current.captureStream(30); // 30 FPS
      let options = {};
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        options = { mimeType: 'video/mp4' };
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options = { mimeType: 'video/webm' };
      }
      
      const recorder = new MediaRecorder(stream, options);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: options.mimeType || 'video/webm' });
        setVideoUrl(URL.createObjectURL(blob));
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn('Video Recording not supported on this browser', err);
    }

    let animationFrameId;
    const renderLoop = () => {
       drawFrame(currentNameRef.current, isWinnerRef.current);
       if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          animationFrameId = requestAnimationFrame(renderLoop);
       }
    };
    renderLoop();

    const chosenWinner = pool[Math.floor(Math.random() * pool.length)];
    let speed = 30;
    let ticks = 0;
    const maxTicks = 50; 
    
    const spin = () => {
      ticks++;
      if (ticks < maxTicks) {
         const randomIndex = Math.floor(Math.random() * pool.length);
         const name = pool[randomIndex];
         setCurrentName(name);
         currentNameRef.current = name;
         speed += Math.floor(ticks / 3); 
         setTimeout(spin, speed);
      } else {
         setCurrentName(chosenWinner);
         currentNameRef.current = chosenWinner;
         setWinner(chosenWinner);
         isWinnerRef.current = true;
         
         // Record the final winner frame for 2.5 seconds
         setTimeout(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
               mediaRecorderRef.current.stop();
               cancelAnimationFrame(animationFrameId);
            }
            setIsDrawing(false);
         }, 2500);
      }
    };
    
    spin();
  };

  return (
    <div className="fixed inset-0 z-[150] bg-zinc-950 flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-pink-900/20 via-zinc-950 to-zinc-950"></div>
      
      <button onClick={onClose} disabled={isDrawing} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors disabled:opacity-0 z-20"><X className="w-8 h-8" /></button>
      
      <canvas ref={canvasRef} width="800" height="600" className="hidden" />

      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center text-center">
        <Trophy className={`w-20 h-20 mx-auto mb-8 transition-all duration-1000 ${winner ? 'text-yellow-500 scale-125 drop-shadow-[0_0_30px_rgba(234,179,8,0.5)]' : 'text-pink-600'}`} />
        
        <p className="text-pink-500 font-bold uppercase tracking-[0.3em] mb-4">{raffle.title} - Official Draw</p>
        
        <div className={`w-full py-16 px-4 rounded-3xl border ${winner ? 'bg-zinc-900/80 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.2)]' : 'bg-black/50 border-zinc-800'} mb-12 transition-all duration-700`}>
           <h2 className={`text-4xl md:text-6xl lg:text-7xl font-black uppercase tracking-tighter italic break-words ${winner ? 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'text-zinc-300'}`}>
             {currentName}
           </h2>
           {winner && <p className="text-yellow-500 font-black text-xl md:text-2xl uppercase tracking-[0.4em] mt-8 animate-pulse">Winner Winner!</p>}
        </div>

        <div className="flex flex-col md:flex-row gap-4 w-full max-w-2xl justify-center">
          {!winner && (
            <button 
              onClick={startDraw} 
              disabled={isDrawing || pool.length === 0} 
              className="w-full max-w-md mx-auto bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:bg-zinc-800 text-white font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-lg shadow-[0_0_30px_rgba(219,39,119,0.3)] hover:shadow-[0_0_50px_rgba(219,39,119,0.5)] active:scale-95"
            >
              {isDrawing ? 'Drawing & Recording...' : 'Spin The Wheel'}
            </button>
          )}
          
          {winner && (
            <>
              {videoUrl && (
                <a 
                  href={videoUrl} 
                  download={`DRS_Draw_${raffle.title.replace(/\s+/g, '_')}_${Date.now()}`}
                  className="flex-1 bg-zinc-800 hover:bg-pink-600 text-white font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-xs md:text-sm active:scale-95 flex items-center justify-center gap-2 border border-zinc-700 hover:border-pink-500"
                >
                  <Video className="w-5 h-5" /> Download Draw Video
                </a>
              )}
              <button 
                onClick={() => onSetWinner(winner)} 
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-xs md:text-sm shadow-[0_0_30px_rgba(22,163,74,0.3)] active:scale-95"
              >
                Approve & End Raffle
              </button>
            </>
          )}
        </div>
        
        <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest mt-8">Total Tickets in Drum: {pool.length}</p>
      </div>
    </div>
  );
};

const RafflesView = ({ raffles, user, members }) => {
  const [reservingRaffle, setReservingRaffle] = useState(null);
  const [reserveQuantity, setReserveQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loginPrompt, setLoginPrompt] = useState(false);

  const membersById = useMemo(() => {
    if (!members) return {};
    return members.reduce((acc, m) => { acc[m.id] = m; return acc; }, {});
  }, [members]);

  const handleReserveClick = (raffle) => {
    if (!user || user.isAnonymous || !membersById[user.uid] || !membersById[user.uid].name) {
      setLoginPrompt(true);
      return;
    }
    setReservingRaffle(raffle);
    setReserveQuantity(1);
    setSubmitError('');
  };

  const submitReservation = async () => {
    if (!reservingRaffle || !user) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      if (!reservingRaffle.id.startsWith('mock-')) {
         const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'raffles', reservingRaffle.id);
         const currentReservations = reservingRaffle.reservations || {};
         const currentVal = currentReservations[user.uid] || 0;
         await setDoc(rRef, { 
           reservations: {
             [user.uid]: currentVal + reserveQuantity
           }
         }, { merge: true });
      }

      const amount = reservingRaffle.ticketPrice * reserveQuantity;
      
      const cloudFunctionUrl = `https://us-central1-daily-ride-south-v3.cloudfunctions.net/createSumUpCheckout`;

      const secureResponse = await fetch(cloudFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: `drs_${user.uid}_${Date.now()}`,
          amount: amount,
          description: `DRS Raffle: ${reservingRaffle.title} (x${reserveQuantity})`
        })
      });

      if (!secureResponse.ok) {
         throw new Error('Cloud function error');
      }

      const { checkoutId } = await secureResponse.json();

      if (checkoutId) {
        window.location.href = `https://checkout.sumup.com/pay/${checkoutId}`;
      } else {
        throw new Error('Failed to generate checkout link');
      }
    } catch (e) {
      console.error(e);
      setSubmitError('Secure connection failed. Please try again later.');
      setIsSubmitting(false);
    }
  };

  const activeRaffles = raffles.filter(r => !r.isEnded);
  const pastRaffles = raffles.filter(r => r.isEnded);

  return (
    <div className="space-y-12">
      {loginPrompt && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full relative text-center">
            <button onClick={() => setLoginPrompt(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"><X className="w-6 h-6"/></button>
            <UserCircle className="w-12 h-12 text-pink-500 mx-auto mb-4" />
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Member Access Required</h3>
            <p className="text-zinc-400 text-sm mb-6">
              You must be logged into your registered club account to reserve tickets. 
              <br/><br/>
              If you opened this from WhatsApp or Instagram, please open the link in Chrome/Safari, or tap below to sign in.
            </p>
            <div className="space-y-3">
              <button 
                onClick={() => { setLoginPrompt(false); signOut(auth); }} 
                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-black py-3 rounded-xl transition-all uppercase tracking-widest text-xs shadow-lg shadow-pink-500/20 active:scale-[0.98]"
              >
                Sign In / Register
              </button>
              <button 
                onClick={() => setLoginPrompt(false)} 
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-3 rounded-xl transition-all uppercase tracking-widest text-xs shadow-lg active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {reservingRaffle && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full relative">
            <button onClick={() => setReservingRaffle(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"><X className="w-6 h-6"/></button>
            <div className="text-center mb-6">
              <Ticket className="w-12 h-12 text-pink-500 mx-auto mb-4" />
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Reserve Tickets</h3>
              <p className="text-zinc-400 text-sm mt-1">{reservingRaffle.title}</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 text-center mb-3">Select Quantity</label>
                <div className="flex items-center justify-between bg-black border border-zinc-800 rounded-2xl p-2">
                  <button onClick={() => setReserveQuantity(Math.max(1, reserveQuantity - 1))} className="w-12 h-12 flex items-center justify-center text-pink-500 hover:bg-zinc-900 rounded-xl font-black text-2xl transition-colors">-</button>
                  <span className="text-white font-black text-3xl">{reserveQuantity}</span>
                  <button onClick={() => setReserveQuantity(reserveQuantity + 1)} className="w-12 h-12 flex items-center justify-center text-pink-500 hover:bg-zinc-900 rounded-xl font-black text-2xl transition-colors">+</button>
                </div>
              </div>
              
              <div className="bg-black/50 p-4 rounded-xl border border-zinc-800/50 text-center">
                 <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Total Cost</p>
                 <p className="text-pink-500 font-black text-2xl">£{reservingRaffle.ticketPrice * reserveQuantity}</p>
              </div>

              <button onClick={submitReservation} disabled={isSubmitting} className="w-full bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:hover:bg-zinc-800 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest text-xs shadow-lg shadow-pink-500/20 active:scale-[0.98]">
                {isSubmitting ? 'Connecting to SumUp...' : 'Confirm & Pay via SumUp'}
              </button>
              {submitError && <p className="text-red-500 text-[10px] font-bold text-center uppercase tracking-widest mt-2">{submitError}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white border-b border-zinc-800 pb-2">Active Raffles</h2>
        <div className="bg-zinc-900/60 p-6 md:p-8 rounded-3xl border border-zinc-800/50 shadow-inner mb-8">
          <p className="text-zinc-300 text-sm md:text-base leading-relaxed italic">
            Try your luck and win some incredible club prizes whilst raising funds to keep the club going. Secure your tickets below and checkout securely via SumUp.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {activeRaffles.map(raffle => {
            const appRes = raffle.reservations || {};
            const offRes = raffle.offlineReservations || {};
            
            let allReservedList = [];
            Object.keys(appRes).forEach(uid => {
              const m = membersById[uid] || { name: 'Pending Setup', avatar: DEFAULT_AVATAR };
              allReservedList.push({ ...m, id: uid, ticketCount: appRes[uid] });
            });
            Object.keys(offRes).forEach(gid => {
              allReservedList.push({
                id: gid,
                name: offRes[gid].name,
                avatar: DEFAULT_AVATAR,
                ticketCount: offRes[gid].count
              });
            });

            const totalReserved = allReservedList.reduce((sum, item) => sum + item.ticketCount, 0);
            const progress = (totalReserved / raffle.totalTickets) * 100;

            return (
              <div key={raffle.id} className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 flex flex-col md:flex-row hover:border-pink-500 transition-colors shadow-lg">
                <div className="md:w-2/5 h-48 md:h-auto relative">
                  <img src={raffle.image || DEFAULT_CAR} alt="" className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 bg-pink-600 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">£{raffle.ticketPrice} / Ticket</div>
                </div>
                <div className="p-5 md:w-3/5 flex flex-col">
                  <div>
                    <h3 className="text-xl font-bold text-white">{raffle.title}</h3>
                    <p className="text-zinc-400 text-sm mt-1">{raffle.description}</p>
                  </div>
                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-500 tracking-widest">
                        <span>{totalReserved} Tickets Taken</span>
                        <span>{Math.round(progress)}% Full</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2 shadow-inner">
                      <div className="bg-pink-500 h-2 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(236,72,153,0.5)]" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-zinc-800/50">
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3">Members Reserving</p>
                    <div className="flex -space-x-3 overflow-hidden p-1">
                        {allReservedList.slice(0, 6).map(m => (
                          <img 
                            key={m.id} 
                            src={m.avatar || DEFAULT_AVATAR} 
                            title={`${m.name} (${m.ticketCount} tickets)`} 
                            className="inline-block h-8 w-8 rounded-full ring-2 ring-zinc-900 object-cover relative z-10 hover:z-20 shadow-lg" 
                            alt="avatar" 
                          />
                        ))}
                        {allReservedList.length > 6 && (
                          <div className="flex items-center justify-center h-8 w-8 rounded-full ring-2 ring-zinc-900 bg-zinc-800 text-[10px] font-bold text-white z-10">
                            +{allReservedList.length - 6}
                          </div>
                        )}
                        {allReservedList.length === 0 && (
                          <span className="text-xs text-zinc-600 font-medium italic py-1">Be the first to reserve!</span>
                        )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-zinc-400 pt-4 mt-auto">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Draws {raffle.drawDate}</span>
                    <button onClick={() => handleReserveClick(raffle)} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-4 py-2 rounded-lg border border-zinc-700 text-[10px] transition-colors uppercase tracking-widest">Reserve</button>
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
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', meetingPoint: '', meetingTime: '', w3w: '', description: '', image: '', link: '' });
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [editingRaffle, setEditingRaffle] = useState(null);
  const [drawingRaffle, setDrawingRaffle] = useState(null);
  const [newRaffle, setNewRaffle] = useState({ title: '', description: '', drawDate: '', ticketPrice: '', totalTickets: 100, image: '' });
  const [raffleWinners, setRaffleWinners] = useState({});
  const [editDescription, setEditDescription] = useState(clubDescription || '');
  const [editSpotlightId, setEditSpotlightId] = useState(spotlightMemberId || '');
  const [memberRoles, setMemberRoles] = useState({});
  const [memberRanks, setMemberRanks] = useState({});
  
  const [compressing, setCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState({ current: 0, total: 0, status: '' });
  const [offlineForms, setOfflineForms] = useState({});

  useEffect(() => {
    if (clubDescription) setEditDescription(clubDescription);
  }, [clubDescription]);

  useEffect(() => {
    if (spotlightMemberId) setEditSpotlightId(spotlightMemberId);
  }, [spotlightMemberId]);

  useEffect(() => {
    const handlePopState = () => {
      if (editingEvent) setEditingEvent(null);
      if (editingMember) setEditingMember(null);
      if (editingRaffle) setEditingRaffle(null);
      if (drawingRaffle) setDrawingRaffle(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [editingEvent, editingMember, editingRaffle, drawingRaffle]);

  const editableUpcoming = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return combinedEvents.filter(e => parseEventDateStr(e.date) >= now).sort((a, b) => parseEventDateStr(a.date) - parseEventDateStr(b.date));
  }, [combinedEvents]);
  
  const editablePast = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return combinedEvents.filter(e => parseEventDateStr(e.date) < now).sort((a, b) => parseEventDateStr(b.date) - parseEventDateStr(a.date));
  }, [combinedEvents]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'dailyride2026' || userProfile?.role === 'Admin') { 
        setIsAuthenticated(true); 
        setError(''); 
    } else { 
        setError('Access Denied: Incorrect credentials.'); 
    }
  };

  const handleDeployEvent = async () => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'events'), newEvent);
      setNewEvent({ title: '', date: '', time: '', location: '', meetingPoint: '', meetingTime: '', w3w: '', description: '', image: '', link: '' });
    } catch (err) {
      console.error("Error saving event:", err);
    }
  };

  const handleEditEvent = (event) => {
    window.history.pushState({ modal: 'editEvent' }, '');
    setEditingEvent(event);
  };

  const handleEditMemberClick = (member) => {
    window.history.pushState({ modal: 'editMember' }, '');
    setEditingMember(member);
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
      setNewRaffle({ title: '', description: '', drawDate: '', ticketPrice: '', totalTickets: 100, image: '' });
    } catch (err) {
      console.error("Error saving raffle:", err);
    }
  };

  const handleUpdateRaffle = async () => {
    try {
      const { id, ...updateData } = editingRaffle;
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'raffles', id), updateData, { merge: true });
      setEditingRaffle(null);
      window.history.back();
    } catch (err) {
      console.error("Error updating raffle:", err);
    }
  };

  const handleUpdateReservation = async (raffle, memberId, delta) => {
    if (raffle.id.startsWith('mock-')) return;
    try {
      const currentReservations = raffle.reservations || {};
      const currentVal = currentReservations[memberId] || 0;
      const newVal = currentVal + delta;
      
      const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'raffles', raffle.id);
      
      if (newVal <= 0) {
        await updateDoc(rRef, {
          [`reservations.${memberId}`]: deleteField()
        });
      } else {
        await setDoc(rRef, { 
          reservations: {
            [memberId]: newVal
          }
        }, { merge: true });
      }
    } catch (err) {
      console.error("Error updating reservation:", err);
    }
  };

  const handleUpdateOfflineReservation = async (raffle, guestId, delta) => {
    if (raffle.id.startsWith('mock-')) return;
    try {
      const rRef = doc(db, 'artifacts', appId, 'public', 'data', 'raffles', raffle.id);
      const currentCount = raffle.offlineReservations[guestId].count;
      const newVal = currentCount + delta;

      if (newVal <= 0) {
        await updateDoc(rRef, {
          [`offlineReservations.${guestId}`]: deleteField()
        });
      } else {
        await updateDoc(rRef, {
          [`offlineReservations.${guestId}.count`]: newVal
        });
      }
    } catch (err) {
      console.error("Error updating offline reservation:", err);
    }
  };

  const updateOfflineForm = (id, updates) => {
    setOfflineForms(prev => ({ ...prev, [id]: { ...(prev[id] || { selected: '', guestName: '', qty: 1 }), ...updates } }));
  };

  const handleAddOffline = async (raffleId) => {
    const r = raffles.find(x => x.id === raffleId);
    const f = offlineForms[raffleId];
    if (!r || !f || !f.selected) return;
    
    try {
      if (f.selected === 'guest') {
        const newId = `guest_${Date.now()}`;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'raffles', r.id), {
          [`offlineReservations.${newId}`]: { name: f.guestName.trim(), count: f.qty }
        }, { merge: true });
      } else {
        const currentReservations = r.reservations || {};
        const currentVal = currentReservations[f.selected] || 0;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'raffles', r.id), {
          [`reservations.${f.selected}`]: currentVal + f.qty
        }, { merge: true });
      }
      updateOfflineForm(raffleId, { selected: '', guestName: '', qty: 1 });
    } catch (e) {
      console.error(e);
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

  const handleToggleHide = async (member) => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', member.id), { isHidden: !member.isHidden }, { merge: true });
    } catch (err) {
      console.error("Error toggling hide status:", err);
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

  const handleDownloadMembers = async () => {
    try {
      const { jsPDF } = await import('https://esm.sh/jspdf@2.5.1');
      const autoTableModule = await import('https://esm.sh/jspdf-autotable@3.8.2');
      const autoTable = autoTableModule.default;
      
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Daily Ride South - Member Roster`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${formatDate(new Date())}`, 14, 22);
      
      autoTable(doc, {
        startY: 30,
        head: [['Name', 'Nickname', 'Email', 'Location', 'Status']],
        body: members.map(m => [
          m.name || 'Pending Setup',
          m.nickname || '-',
          m.email || 'No email saved',
          m.location || '-',
          m.isHidden ? 'Banned' : (m.role || 'Member')
        ])
      });
      
      doc.save('DRS_Member_Roster.pdf');
    } catch (err) {
      console.error("Failed to generate PDF", err);
      alert("Failed to download PDF. Please try again.");
    }
  };

  const handleCompressAll = async () => {
    if (!window.confirm('WARNING: This will download, compress, and re-upload all legacy uncompressed images. Please ensure you are on a fast Wi-Fi connection. Proceed?')) return;

    setCompressing(true);
    let tasks = [];

    members.forEach(member => {
      if (member.avatar && !member.avatar.includes('.webp') && member.avatar.includes('firebasestorage')) {
        tasks.push({ type: 'avatar', memberId: member.id, url: member.avatar });
      }
      (member.cars || []).forEach((car, carIdx) => {
        if (car.image && !car.image.includes('.webp') && car.image.includes('firebasestorage')) {
          tasks.push({ type: 'main', memberId: member.id, carIdx, url: car.image });
        }
        (car.gallery || []).forEach((gUrl, gIdx) => {
           if (gUrl && !gUrl.includes('.webp') && gUrl.includes('firebasestorage')) {
             tasks.push({ type: 'gallery', memberId: member.id, carIdx, gIdx, url: gUrl });
           }
        });
      });
    });

    if (tasks.length === 0) {
       setCompressProgress({ current: 0, total: 0, status: 'All images are already compressed!' });
       setCompressing(false);
       return;
    }

    setCompressProgress({ current: 0, total: tasks.length, status: 'Starting compression...' });

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      setCompressProgress({ current: i + 1, total: tasks.length, status: `Compressing image ${i + 1} of ${tasks.length}` });
      
      try {
        const compressedFile = await compressImageFromUrl(task.url, 1080, 1080, 0.8);
        const storageRef = ref(storage, `artifacts/${appId}/users/${task.memberId}/uploads/retro_compressed_${Date.now()}_${compressedFile.name}`);
        const uploadTask = await uploadBytesResumable(storageRef, compressedFile);
        const newUrl = await getDownloadURL(uploadTask.ref);

        const memberData = members.find(m => m.id === task.memberId);
        if (memberData) {
           if (task.type === 'avatar') {
              await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', task.memberId), { avatar: newUrl }, { merge: true });
           } else {
              const updatedCars = [...memberData.cars];
              if (task.type === 'main') {
                 updatedCars[task.carIdx].image = newUrl;
              } else if (task.type === 'gallery') {
                 updatedCars[task.carIdx].gallery[task.gIdx] = newUrl;
              }
              await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', task.memberId), { cars: updatedCars }, { merge: true });
           }
        }
      } catch (e) {
        console.error("Failed to compress image:", task.url, e);
      }
    }

    setCompressProgress({ current: tasks.length, total: tasks.length, status: 'Compression Complete!' });
    setCompressing(false);
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

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-24 animate-in fade-in duration-700">
      
      {drawingRaffle && (
        <RaffleDrawModal 
          raffle={drawingRaffle} 
          members={members} 
          onClose={() => { window.history.back(); }} 
          onSetWinner={async (winnerName) => {
             try {
               await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'raffles', drawingRaffle.id), { isEnded: true, winner: winnerName });
               window.history.back();
             } catch (err) { console.error(err); }
          }}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-6 gap-4">
        <h2 className="text-3xl font-black text-white flex items-center gap-3 uppercase tracking-tighter"><Shield className="w-8 h-8 text-pink-500" /> Club Control Panel</h2>
        <div className="flex items-center gap-3">
          <button onClick={() => window.location.hash = 'admin_guide'} className="bg-pink-600/10 hover:bg-pink-600/20 text-pink-500 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 border border-pink-500/30">
            <CheckCircle2 className="w-4 h-4" /> Admin Guide
          </button>
          <span className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase hidden sm:block">Verified Admin</span>
        </div>
      </div>
      
      <section className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 space-y-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-pink-500"></div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-widest"><Plus className="w-5 h-5 text-pink-500" /> Deploy New Event</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <InputField label="Event Title" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
          <InputField label="Date (e.g. Sunday, 1st Oct)" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
          <InputField label="Event Start Time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} />
          <InputField label="Location / Venue" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} />
          <InputField label="Meeting Point" value={newEvent.meetingPoint} onChange={e => setNewEvent({...newEvent, meetingPoint: e.target.value})} placeholder="e.g. Tesco Extra Car Park" />
          <InputField label="Meeting Time" value={newEvent.meetingTime} onChange={e => setNewEvent({...newEvent, meetingTime: e.target.value})} placeholder="e.g. 08:00 AM" />
          <InputField label="What3Words Location" value={newEvent.w3w} onChange={e => setNewEvent({...newEvent, w3w: e.target.value})} placeholder="e.g. ///apple.banana.cherry" />
          <InputField label="External Ticket Link" value={newEvent.link} onChange={e => setNewEvent({...newEvent, link: e.target.value})} />
          <div className="md:col-span-2 bg-black/30 p-4 rounded-lg border border-zinc-800/50">
             <ImageUpload label="Upload Event Poster Image" onUploadSuccess={url => setNewEvent({...newEvent, image: url})} />
             {newEvent.image && <p className="text-[10px] text-green-500 mt-2 font-bold uppercase tracking-widest">Poster Uploaded Successfully</p>}
          </div>
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
               <button onClick={() => { setEditingEvent(null); window.history.back(); }} className="text-zinc-400 hover:text-white bg-zinc-900 p-2 rounded-lg transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <InputField label="Event Title" value={editingEvent.title || ''} onChange={e => setEditingEvent({...editingEvent, title: e.target.value})} />
            <InputField label="Date (e.g. Sunday, 1st Oct)" value={editingEvent.date || ''} onChange={e => setEditingEvent({...editingEvent, date: e.target.value})} />
            <InputField label="Event Start Time" value={editingEvent.time || ''} onChange={e => setEditingEvent({...editingEvent, time: e.target.value})} />
            <InputField label="Location / Venue" value={editingEvent.location || ''} onChange={e => setEditingEvent({...editingEvent, location: e.target.value})} />
            <InputField label="Meeting Point" value={editingEvent.meetingPoint || ''} onChange={e => setEditingEvent({...editingEvent, meetingPoint: e.target.value})} />
            <InputField label="Meeting Time" value={editingEvent.meetingTime || ''} onChange={e => setEditingEvent({...editingEvent, meetingTime: e.target.value})} />
            <InputField label="What3Words Location" value={editingEvent.w3w || ''} onChange={e => setEditingEvent({...editingEvent, w3w: e.target.value})} />
            <InputField label="External Ticket Link" value={editingEvent.link || ''} onChange={e => setEditingEvent({...editingEvent, link: e.target.value})} />
            <div className="md:col-span-2 bg-black/50 p-4 rounded-lg border border-zinc-800/50">
               <ImageUpload label="Update Event Poster" onUploadSuccess={url => setEditingEvent({...editingEvent, image: url})} />
               {editingEvent.image && <img src={editingEvent.image} alt="preview" className="mt-4 h-24 rounded-lg border border-zinc-700 object-cover" />}
            </div>
            <div className="md:col-span-2 space-y-1">
               <label className="block text-sm font-medium text-zinc-400">Event Description</label>
               <textarea className="w-full bg-black border border-zinc-800 text-white rounded-xl p-4 outline-none focus:border-pink-500 transition-all" value={editingEvent.description || ''} onChange={e => setEditingEvent({...editingEvent, description: e.target.value})} rows={3} />
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
                  {editableUpcoming.map(e => <EventListTile key={e.id} event={e} onEdit={handleEditEvent} />)}
                </div>
              </div>
            )}
            
            {editablePast.length > 0 && (
              <div>
                <p className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em] mb-4 border-l-2 border-zinc-700 pl-3">Past Events</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {editablePast.map(e => <EventListTile key={e.id} event={e} onEdit={handleEditEvent} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 space-y-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-pink-500"></div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-widest"><Ticket className="w-5 h-5 text-pink-500" /> Raffle Administration</h3>
        
        {editingRaffle ? (
          <div className="bg-black/50 p-6 rounded-2xl border border-pink-500/50 animate-in zoom-in-95 duration-300 mt-6">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-4">
               <h4 className="font-bold text-white uppercase tracking-wider">Editing Raffle: {editingRaffle.title}</h4>
               <button onClick={() => { setEditingRaffle(null); window.history.back(); }} className="text-zinc-400 hover:text-white bg-zinc-900 p-2 rounded-lg transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <InputField label="Prize Title" value={editingRaffle.title || ''} onChange={e => setEditingRaffle({...editingRaffle, title: e.target.value})} />
              <InputField label="Live Draw Date" value={editingRaffle.drawDate || ''} onChange={e => setEditingRaffle({...editingRaffle, drawDate: e.target.value})} />
              <InputField label="Ticket Cost (£)" value={editingRaffle.ticketPrice || ''} onChange={e => setEditingRaffle({...editingRaffle, ticketPrice: e.target.value})} />
              <InputField label="Maximum Ticket Cap" type="number" value={editingRaffle.totalTickets || 100} onChange={e => setEditingRaffle({...editingRaffle, totalTickets: Number(e.target.value)})} />
              <div className="md:col-span-2 bg-black/50 p-4 rounded-lg border border-zinc-800/50">
                 <ImageUpload label="Update Prize Image" onUploadSuccess={url => setEditingRaffle({...editingRaffle, image: url})} />
                 {editingRaffle.image && <img src={editingRaffle.image} alt="preview" className="mt-4 h-24 rounded-lg border border-zinc-700 object-cover" />}
              </div>
              <div className="md:col-span-2 space-y-1">
                 <label className="block text-sm font-medium text-zinc-400">Raffle Terms / Details</label>
                 <textarea className="w-full bg-black border border-zinc-800 text-white rounded-xl p-4 outline-none focus:border-pink-500 transition-all" value={editingRaffle.description || ''} onChange={e => setEditingRaffle({...editingRaffle, description: e.target.value})} rows={3} />
              </div>
              <button onClick={handleUpdateRaffle} className="md:col-span-2 bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-pink-500/20">Save Raffle Changes</button>
            </div>
          </div>
        ) : (
          <>
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
              {raffles.map(r => {
                const appRes = r.reservations || {};
                const offRes = r.offlineReservations || {};
                
                let allReservedList = [];
                Object.keys(appRes).forEach(uid => {
                  const m = members.find(x => x.id === uid) || { id: uid, name: 'Guest (In-App Browser)', avatar: DEFAULT_AVATAR };
                  allReservedList.push({ ...m, ticketCount: appRes[uid], type: 'app' });
                });
                Object.keys(offRes).forEach(gid => {
                  allReservedList.push({
                    id: gid,
                    name: offRes[gid].name,
                    avatar: DEFAULT_AVATAR,
                    ticketCount: offRes[gid].count,
                    type: 'offline'
                  });
                });

                const totalReserved = allReservedList.reduce((sum, item) => sum + item.ticketCount, 0);
                const progress = (totalReserved / r.totalTickets) * 100;
                
                const form = offlineForms[r.id] || { selected: '', guestName: '', qty: 1 };

                return (
                  <div key={r.id} className="bg-black p-4 rounded-xl border border-zinc-800 flex flex-col justify-between group hover:border-pink-900 transition-colors">
                    <div>
                      <p className="text-white font-bold text-sm truncate uppercase tracking-wider">{r.title}</p>
                      {r.isEnded ? (
                        <div className="mt-4 p-3 bg-pink-900/20 border border-pink-500/30 rounded-lg text-center">
                          <span className="text-pink-500 font-black uppercase text-xs tracking-widest">Winner: {r.winner}</span>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-2">
                           <div className="flex items-center justify-between bg-zinc-900/80 p-2 rounded-lg border border-pink-500/30">
                             <span className="text-pink-500 text-[10px] font-black uppercase tracking-[0.1em]">Total Taken:</span>
                             <span className="text-pink-500 font-black text-sm">{totalReserved} / {r.totalTickets}</span>
                           </div>
                        </div>
                      )}
                      
                      {!r.isEnded && !r.id.startsWith('mock-') && (
                        <div className="mt-4 pt-4 border-t border-zinc-800/50">
                          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3">Manage Reservations</p>
                          <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                             {allReservedList.map(m => (
                                <div key={m.id} className="flex items-center justify-between bg-zinc-900 p-2 rounded-lg border border-zinc-700">
                                   <div className="flex items-center gap-2">
                                     <img src={m.avatar || DEFAULT_AVATAR} className="w-6 h-6 rounded-full object-cover" alt="" />
                                     <span className="text-xs text-zinc-300 font-bold truncate max-w-[100px]">{m.name}</span>
                                   </div>
                                   <div className="flex items-center gap-2">
                                     <button 
                                       onClick={() => m.type === 'offline' ? handleUpdateOfflineReservation(r, m.id, -1) : handleUpdateReservation(r, m.id, -1)} 
                                       className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 text-pink-500 hover:bg-zinc-700 font-black transition-colors leading-none"
                                     >-</button>
                                     <span className="text-white font-bold text-xs w-4 text-center">{m.ticketCount}</span>
                                     <button 
                                       onClick={() => m.type === 'offline' ? handleUpdateOfflineReservation(r, m.id, 1) : handleUpdateReservation(r, m.id, 1)} 
                                       className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 text-pink-500 hover:bg-zinc-700 font-black transition-colors leading-none"
                                     >+</button>
                                   </div>
                                </div>
                             ))}
                             {allReservedList.length === 0 && <span className="text-[10px] text-zinc-600 italic block mb-2">No reservations yet.</span>}
                          </div>
                          
                          <div className="mt-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50 space-y-3">
                             <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">Add Manual Reservation</p>
                             <div className="flex flex-col gap-2">
                               <select 
                                  value={form.selected} 
                                  onChange={e => updateOfflineForm(r.id, { selected: e.target.value })}
                                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs text-white outline-none focus:border-pink-500"
                               >
                                  <option value="">-- Select Member --</option>
                                  <option value="guest">Not Registered (Manual Entry)</option>
                                  {members.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                               </select>
                               
                               {form.selected === 'guest' && (
                                 <input 
                                   type="text" 
                                   placeholder="Guest Full Name" 
                                   value={form.guestName}
                                   onChange={e => updateOfflineForm(r.id, { guestName: e.target.value })}
                                   className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs text-white outline-none focus:border-pink-500"
                                 />
                               )}
                               
                               <div className="flex gap-2">
                                 <input 
                                   type="number" 
                                   min="1" 
                                   value={form.qty} 
                                   onChange={e => updateOfflineForm(r.id, { qty: parseInt(e.target.value) || 1 })}
                                   className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs text-white outline-none focus:border-pink-500"
                                 />
                                 <button 
                                   onClick={() => handleAddOffline(r.id)}
                                   disabled={!form.selected || (form.selected === 'guest' && !form.guestName.trim())}
                                   className="flex-grow bg-zinc-800 hover:bg-pink-600 disabled:opacity-50 text-white font-bold rounded-lg text-[10px] uppercase tracking-widest transition-colors"
                                 >
                                   Add Tickets
                                 </button>
                               </div>
                             </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {!r.isEnded && !r.id.startsWith('mock-') && (
                      <div className="mt-4 pt-4 border-t border-zinc-800/50 space-y-4">
                        <button 
                          onClick={() => { window.history.pushState({ modal: 'drawRaffle' }, ''); setDrawingRaffle(r); }}
                          className="w-full bg-pink-600 hover:bg-pink-500 text-white font-black py-3 rounded-lg text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(219,39,119,0.3)]"
                        >
                          <Trophy className="w-4 h-4" /> Launch Draw Machine
                        </button>

                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Or manual winner name..." 
                            value={raffleWinners[r.id] || ''} 
                            onChange={e => setRaffleWinners({...raffleWinners, [r.id]: e.target.value})} 
                            className="flex-grow bg-zinc-900 border border-zinc-700 text-white rounded-lg p-2 text-xs outline-none focus:border-pink-500 transition-colors" 
                          />
                          <button 
                            onClick={async () => { 
                              if (!raffleWinners[r.id]) return;
                              try {
                                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'raffles', r.id), { isEnded: true, winner: raffleWinners[r.id] });
                              } catch (err) { console.error(err); }
                            }} 
                            disabled={!raffleWinners[r.id]}
                            className="px-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:hover:bg-zinc-800 text-white font-bold rounded-lg text-[10px] transition-all uppercase tracking-widest border border-zinc-700"
                          >
                            End
                          </button>
                        </div>
                      </div>
                    )}

                    {!r.id.startsWith('mock-') && (
                      <div className="flex justify-between items-center mt-4 pt-4 border-t border-zinc-800/50">
                        <button
                          onClick={() => { window.history.pushState({ modal: 'editRaffle' }, ''); setEditingRaffle(r); }}
                          className="text-pink-500 group-hover:text-pink-400 font-bold uppercase text-[9px] flex items-center gap-1 transition-colors tracking-widest"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        <button 
                          onClick={async () => { 
                            if(window.confirm('PERMANENTLY DELETE RAFFLE?')) {
                              try {
                                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'raffles', r.id));
                              } catch (err) { console.error(err); }
                            }
                          }} 
                          className="text-red-900 group-hover:text-red-500 font-bold uppercase text-[9px] flex items-center gap-1 transition-colors tracking-widest"
                        >
                          <Trash2 className="w-3 h-3" /> Purge
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 gap-8">
        <section className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden flex flex-col">
          <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest border-b border-zinc-800 pb-3 mb-4"><Edit3 className="w-4 h-4 text-pink-500" /> Club Homepage Settings</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-widest">Spotlight Member</label>
              <select value={editSpotlightId} onChange={e => setEditSpotlightId(e.target.value)} className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 outline-none focus:border-pink-500 transition-all appearance-none cursor-pointer">
                 <option value="">None</option>
                 {members.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-800 pb-3 mb-4 gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest"><Users className="w-4 h-4 text-pink-500" /> Member Moderation Hub</h3>
                {members.filter(m => !m.name).length > 0 && (
                   <span className="bg-orange-500/20 text-orange-500 border border-orange-500/50 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest animate-pulse">
                     {members.filter(m => !m.name).length} Pending
                   </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-zinc-500 font-bold uppercase italic hidden lg:inline">Rank members 1-5 to show them first</span>
                <button onClick={handleDownloadMembers} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-pink-500 px-3 py-1.5 rounded border border-zinc-700 transition-colors uppercase tracking-widest font-bold flex items-center gap-2">
                  <Download className="w-3 h-3" /> Download Roster PDF
                </button>
              </div>
          </div>

          {editingMember ? (
            <div className="bg-black/50 p-6 rounded-2xl border border-pink-500/50 animate-in zoom-in-95 duration-300 mb-6">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-4">
                 <h4 className="font-bold text-white uppercase tracking-wider flex items-center gap-2"><UserCog className="w-5 h-5 text-pink-500" /> Editing Profile: {editingMember.name || editingMember.email}</h4>
                 <button onClick={() => { setEditingMember(null); window.history.back(); }} className="text-zinc-400 hover:text-white bg-zinc-900 p-2 rounded-lg transition-colors"><X className="w-5 h-5"/></button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <InputField label="Name" value={editingMember.name} onChange={e => setEditingMember({...editingMember, name: e.target.value})} />
                <InputField label="Nickname" value={editingMember.nickname || ''} onChange={e => setEditingMember({...editingMember, nickname: e.target.value})} />
                <InputField label="Location" value={editingMember.location || ''} onChange={e => setEditingMember({...editingMember, location: e.target.value})} />
                <InputField label="Instagram Link" value={editingMember.instagram || ''} onChange={e => setEditingMember({...editingMember, instagram: e.target.value})} />
                <div className="sm:col-span-2 space-y-1">
                   <label className="block text-sm font-medium text-zinc-400">Bio</label>
                   <textarea className="w-full bg-black border border-zinc-800 text-white rounded-xl p-4 outline-none focus:border-pink-500 transition-all" value={editingMember.bio || ''} onChange={e => setEditingMember({...editingMember, bio: e.target.value})} rows={3} />
                </div>
              </div>
              <button 
                onClick={async () => {
                  try {
                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', editingMember.id), editingMember, { merge: true });
                    setEditingMember(null);
                    window.history.back();
                  } catch (err) { console.error(err); }
                }} 
                className="w-full mt-6 bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-pink-500/20"
              >
                Save Profile Changes
              </button>
            </div>
          ) : null}

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {members.map(m => (
              <div key={m.id} className={`flex flex-col gap-3 p-4 rounded-xl border transition-colors ${m.isHidden ? 'bg-red-900/10 border-red-900/50' : 'bg-black/50 border-zinc-800/50 hover:border-zinc-700'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-xs font-bold truncate max-w-[100px]">{m.name || 'Pending Setup'}</span>
                        {!m.name && (
                           <span className="bg-orange-600/20 text-orange-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-orange-500/30 tracking-widest">INCOMPLETE</span>
                        )}
                        {m.rank && (
                          <span className="bg-pink-600/20 text-pink-500 text-[9px] font-black px-1.5 py-0.5 rounded border border-pink-500/30">#{m.rank}</span>
                        )}
                        {m.isHidden && (
                          <span className="bg-red-600/20 text-red-500 text-[9px] font-black px-1.5 py-0.5 rounded border border-red-500/30">BANNED</span>
                        )}
                      </div>
                      <span className="text-zinc-600 text-[9px] uppercase tracking-tighter">{m.nickname || 'NO NICKNAME'}</span>
                      <span className="text-zinc-500 text-[9px] lowercase tracking-wider truncate max-w-[150px]">{m.email || 'no email'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEditMemberClick(m)} className="text-zinc-500 hover:text-pink-500 transition-colors p-1" title="Edit Profile"><UserCog className="w-4 h-4" /></button>
                    <button onClick={() => handleToggleHide(m)} className={`p-1 transition-colors ${m.isHidden ? 'text-red-500 hover:text-green-500' : 'text-zinc-500 hover:text-red-500'}`} title={m.isHidden ? "Unban Member" : "Ban/Hide Member"}>
                      {m.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleExpelMember(m.id)} className="text-zinc-700 hover:text-red-500 transition-colors p-1" title="Delete Member"><Trash2 className="w-4 h-4" /></button>
                  </div>
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

        <section className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden flex flex-col">
          <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest border-b border-zinc-800 pb-3 mb-4"><ImageIcon className="w-4 h-4 text-pink-500" /> Database Maintenance (Temporary)</h3>
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
              Run this tool to automatically scan the database, download all legacy uncompressed images, compress them to WebP format, and re-upload them. This will save significant bandwidth for your users.
            </p>
            
            {compressProgress.total > 0 && (
              <div className="bg-black border border-zinc-800 p-4 rounded-xl">
                 <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                    <span>{compressProgress.status}</span>
                    <span>{Math.round((compressProgress.current / compressProgress.total) * 100)}%</span>
                 </div>
                 <div className="w-full bg-zinc-800 rounded-full h-2 shadow-inner">
                   <div className="bg-pink-500 h-2 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(236,72,153,0.5)]" style={{ width: `${(compressProgress.current / compressProgress.total) * 100}%` }}></div>
                 </div>
              </div>
            )}

            <button 
              onClick={handleCompressAll}
              disabled={compressing}
              className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-pink-500 font-black py-3 rounded-xl transition-all uppercase tracking-widest text-xs shadow-lg border border-zinc-700 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {compressing ? <span className="animate-pulse">Compressing...</span> : <><Download className="w-4 h-4" /> Run Bulk Compression Tool</>}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};

const MainApp = () => {
  const [activeTab, setActiveTabState] = useState(() => window.location.hash.replace('#', '') || 'home');
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [cloudMembers, setCloudMembers] = useState([]);
  const [cloudEvents, setCloudEvents] = useState([]);
  const [cloudRaffles, setCloudRaffles] = useState([]);
  const [cloudRsvps, setCloudRsvps] = useState({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [clubDescription, setClubDescription] = useState("It started simply enough: just a petrol-head couple bonded by a shared love for burning fuel and draining bank accounts.");
  const [spotlightMemberId, setSpotlightMemberId] = useState(null);
  const [birthdayIndex, setBirthdayIndex] = useState(0);
  const [globalSelectedMember, setGlobalSelectedMember] = useState(null);
  const [globalViewingCar, setGlobalViewingCar] = useState(null);
  const [enlargedImage, setEnlargedImage] = useState(null);

  // --- INACTIVITY TIMER ---
  useEffect(() => {
    let inactivityTimer;
    const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        if (auth.currentUser) {
          signOut(auth).catch(err => console.error("Inactivity logout error:", err));
        }
      }, INACTIVITY_LIMIT);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

    if (user) {
      activityEvents.forEach(evt => document.addEventListener(evt, resetInactivityTimer, { passive: true }));
      resetInactivityTimer();
    }

    return () => {
      clearTimeout(inactivityTimer);
      activityEvents.forEach(evt => document.removeEventListener(evt, resetInactivityTimer, { passive: true }));
    };
  }, [user]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      setActiveTabState(hash || 'home');
      setIsMenuOpen(false); 
      setGlobalSelectedMember(null);
      setEnlargedImage(null);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (enlargedImage) setEnlargedImage(null);
      else if (globalViewingCar) setGlobalViewingCar(null);
      else if (globalSelectedMember) setGlobalSelectedMember(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [globalViewingCar, globalSelectedMember, enlargedImage]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth error:", err); }
      setIsLoadingAuth(false);
    };
    initAuth();
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) return;
    const membersRef = collection(db, 'artifacts', appId, 'public', 'data', 'members');
    const unsubMembers = onSnapshot(membersRef, s => {
      const f = []; s.forEach(d => f.push({ id: d.id, ...d.data() })); setCloudMembers(f);
    }, e => console.error(e));

    const eventsRef = collection(db, 'artifacts', appId, 'public', 'data', 'events');
    const unsubEvents = onSnapshot(eventsRef, s => {
      const f = []; s.forEach(d => f.push({ id: d.id, ...d.data() })); setCloudEvents(f);
    }, e => console.error(e));

    const rafflesRef = collection(db, 'artifacts', appId, 'public', 'data', 'raffles');
    const unsubRaffles = onSnapshot(rafflesRef, s => {
      const f = []; s.forEach(d => f.push({ id: d.id, ...d.data() })); setCloudRaffles(f);
    }, e => console.error(e));

    const rsvpsRef = collection(db, 'artifacts', appId, 'public', 'data', 'rsvps');
    const unsubRsvps = onSnapshot(rsvpsRef, s => {
      const f = {}; s.forEach(d => f[d.id] = d.data()); setCloudRsvps(f);
    }, e => console.error(e));
    
    const infoRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'clubInfo');
    const unsubInfo = onSnapshot(infoRef, d => {
      if (d.exists()) {
        if (d.data().description) setClubDescription(d.data().description);
        if (d.data().spotlightMemberId) setSpotlightMemberId(d.data().spotlightMemberId);
      }
    });

    return () => { unsubMembers(); unsubEvents(); unsubRaffles(); unsubRsvps(); unsubInfo(); };
  }, [user]);

  const allAdminMembers = useMemo(() => {
    return [...cloudMembers].sort((a, b) => (parseInt(a.rank) || 999) - (parseInt(b.rank) || 999));
  }, [cloudMembers]);

  const sortedMembers = useMemo(() => allAdminMembers.filter(m => !m.isHidden && m.name), [allAdminMembers]);

  const birthdayMembers = useMemo(() => {
    const today = new Date();
    const d = today.getDate().toString();
    const m = (today.getMonth() + 1).toString();
    return cloudMembers.filter(mb => !mb.isHidden && mb.birthdayDay === d && mb.birthdayMonth === m);
  }, [cloudMembers]);

  useEffect(() => {
    if (birthdayMembers.length > 1) {
      const interval = setInterval(() => setBirthdayIndex(prev => (prev + 1) % birthdayMembers.length), 5000);
      return () => clearInterval(interval);
    }
  }, [birthdayMembers.length]);

  const isBirthdaySpotlight = birthdayMembers.length > 0;

  const spotlightMember = useMemo(() => {
    if (birthdayMembers.length > 0) return birthdayMembers[birthdayIndex] || birthdayMembers[0];
    return cloudMembers.find(m => m.id === spotlightMemberId && !m.isHidden) || null;
  }, [cloudMembers, spotlightMemberId, birthdayMembers, birthdayIndex]);

  const combinedEvents = useMemo(() => {
    const cloudTitles = new Set(cloudEvents.map(e => e.title.toLowerCase()));
    const visibleStatic = STATIC_EVENTS.filter(s => !cloudTitles.has(s.title.toLowerCase()));
    return [...visibleStatic, ...cloudEvents];
  }, [cloudEvents]);

  const combinedRaffles = useMemo(() => [...STATIC_RAFFLES, ...cloudRaffles], [cloudRaffles]);

  const upcomingEvents = useMemo(() => {
    const n = new Date(); n.setHours(0,0,0,0);
    return combinedEvents.filter(e => parseEventDateStr(e.date) >= n).sort((a,b) => parseEventDateStr(a.date) - parseEventDateStr(b.date));
  }, [combinedEvents]);
  
  const pastEvents = useMemo(() => {
    const n = new Date(); n.setHours(0,0,0,0);
    return combinedEvents.filter(e => parseEventDateStr(e.date) < n).sort((a,b) => parseEventDateStr(b.date) - parseEventDateStr(a.date));
  }, [combinedEvents]);

  const currentUserProfile = useMemo(() => cloudMembers.find(m => m.id === user?.uid) || null, [cloudMembers, user]);

  useEffect(() => {
    if (user && user.email && currentUserProfile && currentUserProfile.email !== user.email) {
      const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'members', user.uid);
      setDoc(profileRef, { email: user.email }, { merge: true }).catch(e => console.error("Email sync error", e));
    }
  }, [user, currentUserProfile]);

  const toggleRsvp = async (eventId, isPast) => {
    if (!user) return;
    try {
      const rsvpDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rsvps', String(eventId));
      const current = cloudRsvps[eventId] || { attending: [], attended: [] };
      const field = isPast ? 'attended' : 'attending';
      const list = current[field] || [];
      const newList = list.includes(user.uid) ? list.filter(id => id !== user.uid) : [...list, user.uid];
      await setDoc(rsvpDocRef, { [field]: newList }, { merge: true });
    } catch (err) { console.error(err); }
  };

  const handleMemberModal = (m) => {
    window.history.pushState({modal:'member'}, '');
    setGlobalSelectedMember(m);
  };

  const isRegisteredUser = user && !user.isAnonymous;
  const requiresProfileSetup = isRegisteredUser && (!currentUserProfile || !currentUserProfile.name || currentUserProfile.name.trim() === '');

  if (isLoadingAuth) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-sm animate-pulse">Establishing Secure Hub...</div>;
  if (!user) return <SplashView />;

  const renderContent = () => {
    if (requiresProfileSetup) {
      return <ProfileView user={user} userProfile={currentUserProfile} isForcedSetup={true} />;
    }

    switch (activeTab) {
      case 'home': return <HomeView clubDescription={clubDescription} spotlightMember={spotlightMember} isBirthdaySpotlight={isBirthdaySpotlight} onMemberClick={handleMemberModal} members={sortedMembers} onImageClick={img => { window.history.pushState({modal:'image'}, ''); setEnlargedImage(img); }} />;
      case 'events': return <EventsView title="Upcoming Events" events={upcomingEvents} cloudRsvps={cloudRsvps} cloudMembers={cloudMembers} user={user} userProfile={currentUserProfile} toggleRsvp={toggleRsvp} isPast={false} onMemberClick={handleMemberModal} />;
      case 'past_events': return <EventsView title="Past Events Gallery" events={pastEvents} cloudRsvps={cloudRsvps} cloudMembers={cloudMembers} user={user} userProfile={currentUserProfile} toggleRsvp={toggleRsvp} isPast={true} onMemberClick={handleMemberModal} />;
      case 'gallery': return <GalleryView members={sortedMembers} onImageClick={img => { window.history.pushState({modal:'image'}, ''); setEnlargedImage(img); }} />;
      case 'members': return <MembersView members={sortedMembers} onMemberClick={handleMemberModal} />;
      case 'profile': return <ProfileView user={user} userProfile={currentUserProfile} />;
      case 'raffles': return <RafflesView raffles={combinedRaffles} user={user} members={cloudMembers} />;
      case 'charity': return <CharityView />;
      case 'admin': return <AdminView members={allAdminMembers} combinedEvents={combinedEvents} raffles={combinedRaffles} clubDescription={clubDescription} userProfile={currentUserProfile} spotlightMemberId={spotlightMemberId} />;
      case 'admin_guide': return <AdminGuideView onBack={() => window.location.hash = 'admin'} />;
      default: return <HomeView clubDescription={clubDescription} spotlightMember={spotlightMember} isBirthdaySpotlight={isBirthdaySpotlight} onMemberClick={handleMemberModal} members={sortedMembers} onImageClick={img => { window.history.pushState({modal:'image'}, ''); setEnlargedImage(img); }} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 font-sans pb-32 text-zinc-200 selection:bg-pink-500/30 selection:text-pink-200 relative">
      <header className="bg-black/90 backdrop-blur-xl border-b border-zinc-900 sticky top-0 z-50 h-20 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 h-full flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.hash = 'home'}>
            <img src="https://i.ibb.co/xnqpNZV/Whats-App-Image-2026-05-10-at-4-19-50-PM.jpg" className="h-10 w-10 rounded-xl object-cover border border-zinc-800 shadow-lg" alt="" />
            <h1 className="text-xl font-black text-white uppercase tracking-tighter italic">Daily Ride <span className="text-pink-600 not-italic">South</span></h1>
          </div>
          {!requiresProfileSetup && (
            <button onClick={() => setIsMenuOpen(true)} className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-pink-500 hover:text-white transition-all active:scale-95 shadow-xl">
              <Menu className="w-6 h-6" />
            </button>
          )}
        </div>
      </header>

      {isMenuOpen && <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] animate-in fade-in duration-300" onClick={() => setIsMenuOpen(false)} />}
      <div className={`fixed top-0 right-0 h-full w-80 bg-zinc-950 z-[70] border-l border-zinc-800 transform transition-all duration-500 p-8 shadow-[0_0_50px_rgba(0,0,0,1)] ${isMenuOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'} overflow-y-auto`}>
        <div className="flex justify-between items-center mb-10">
          <span className="text-white font-black uppercase text-xl tracking-tighter">DRS <span className="text-pink-600 italic">Menu</span></span>
          <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <nav className="space-y-3 mb-10">
          {navItems.map(item => (
            <NavLink key={item.id} item={item} mobile isActive={activeTab === item.id || (activeTab === 'past_events' && item.id === 'events')} onClick={() => { window.location.hash = item.id; setIsMenuOpen(false); }} />
          ))}
        </nav>
        <div className="pt-8 border-t border-zinc-900 space-y-4">
          <div className="flex justify-center gap-6 mb-2">
            <a href="https://www.facebook.com/daily.ride.south" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-pink-500 transition-colors"><FacebookIcon className="w-6 h-6" /></a>
            <a href="https://www.instagram.com/daily.ride.south/" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-pink-500 transition-colors"><InstagramIcon className="w-6 h-6" /></a>
            <a href="https://www.tiktok.com/@dailyridesouth?_r=1&_t=ZN-96GvaNt02b9" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-pink-500 transition-colors"><TikTokIcon className="w-6 h-6" /></a>
          </div>
          <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition-colors uppercase tracking-widest text-xs font-bold"><LogOut className="w-4 h-4" /> Sign Out</button>
          <div className="flex justify-center pt-4">
            <button onClick={() => { window.location.hash = 'admin'; setIsMenuOpen(false); window.scrollTo(0,0); }} className="text-zinc-700 hover:text-pink-500 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] border border-zinc-900 px-6 py-3 rounded-full hover:border-pink-900/30 transition-all active:scale-95 shadow-inner">
              <Lock className="w-3 h-3" /> Staff Entry
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 pt-10">
        {globalSelectedMember && !requiresProfileSetup ? (
          <MemberProfileModal member={globalSelectedMember} onClose={() => { setGlobalSelectedMember(null); window.history.back(); }} onCarClick={c => { window.history.pushState({modal:'car'}, ''); setGlobalViewingCar(c); }} />
        ) : renderContent()}
      </main>

      {globalViewingCar && <CarGalleryModal viewingCar={globalViewingCar} onClose={() => { setGlobalViewingCar(null); window.history.back(); }} />}
      {enlargedImage && <EnlargedImageModal imageObj={enlargedImage} onClose={() => { setEnlargedImage(null); window.history.back(); }} onMemberClick={m => { setEnlargedImage(null); handleMemberModal(m); }} />}

      <footer className="mt-32 border-t border-zinc-900 py-16 bg-black/40">
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-8 text-center text-zinc-600">
          <p className="text-[10px] font-black uppercase tracking-[0.5em]">Webapp Created by Luke Martin</p>
          <div className="flex gap-6">
            <a href="https://www.facebook.com/daily.ride.south" target="_blank" rel="noopener noreferrer" className="hover:text-pink-500 transition-colors"><FacebookIcon className="w-5 h-5" /></a>
            <a href="https://www.instagram.com/daily.ride.south/" target="_blank" rel="noopener noreferrer" className="hover:text-pink-500 transition-colors"><InstagramIcon className="w-5 h-5" /></a>
            <a href="https://www.tiktok.com/@dailyridesouth?_r=1&_t=ZN-96GvaNt02b9" target="_blank" rel="noopener noreferrer" className="hover:text-pink-500 transition-colors"><TikTokIcon className="w-5 h-5" /></a>
          </div>
          {!requiresProfileSetup && (
            <button onClick={() => { window.location.hash = 'admin'; window.scrollTo(0,0); }} className="text-zinc-700 hover:text-pink-500 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] border border-zinc-900 px-6 py-3 rounded-full hover:border-pink-900/30 transition-all active:scale-95 shadow-inner">
              <Lock className="w-3 h-3" /> Staff Entry
            </button>
          )}
        </div>
      </footer>

      {!requiresProfileSetup && (
        <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/50 h-16 z-50 flex items-center justify-around px-4 rounded-2xl shadow-2xl">
           {navItems.slice(0, 4).map(item => {
             const Icon = item.icon;
             const isActive = activeTab === item.id || (activeTab === 'past_events' && item.id === 'events');
             return (
               <button key={item.id} onClick={() => window.location.hash = item.id} className={`flex flex-col items-center transition-all ${isActive ? 'text-pink-500 scale-110' : 'text-zinc-600'}`}>
                 <Icon className="w-5 h-5" />
               </button>
             );
           })}
           <button onClick={() => setIsMenuOpen(true)} className="flex flex-col items-center text-zinc-600">
             <Menu className="w-5 h-5" />
           </button>
        </nav>
      )}
    </div>
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("DRS App Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center text-white">
          <Shield className="w-16 h-16 text-pink-500 mb-6" />
          <h1 className="text-3xl font-black uppercase tracking-tighter italic mb-2">Pit Stop <span className="text-pink-600 not-italic">Required</span></h1>
          <p className="text-zinc-400 text-sm max-w-md mx-auto mb-8">
            Your device is struggling to load the latest club update. This usually happens when an old version of the app is stuck in your browser's cache.
          </p>
          <div className="bg-black border border-zinc-800 p-4 rounded-xl text-left w-full max-w-md overflow-auto mb-8">
             <p className="text-pink-500 text-[10px] font-bold uppercase tracking-widest mb-2">Error Log for Admin:</p>
             <code className="text-zinc-500 text-xs break-words">{this.state.error?.toString()}</code>
          </div>
          <button onClick={() => window.location.reload(true)} className="bg-pink-600 hover:bg-pink-700 text-white font-black py-4 px-8 rounded-xl transition-all uppercase tracking-widest text-xs shadow-lg active:scale-[0.98]">
            Force Refresh App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}