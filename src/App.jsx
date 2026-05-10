import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
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
  LogOut
} from 'lucide-react';

// --- FIREBASE SETUP ---
// Using your live V3 credentials for local deployment, with a fallback for the Canvas preview
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

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&q=80&w=200";
const DEFAULT_CAR = "https://images.unsplash.com/photo-1502877338535-494e509f583b?auto=format&fit=crop&q=80&w=800";

// --- SHARED COMPONENTS ---

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      // Clean up Firebase error messages for the user
      const message = err.message.includes('auth/invalid-credential') 
        ? 'Invalid email or password.' 
        : err.message.includes('auth/email-already-in-use')
        ? 'An account with this email already exists.'
        : err.message.replace('Firebase: ', '');
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden selection:bg-pink-500/30 selection:text-pink-200">
      {/* Background styling */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1502877338535-494e509f583b?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center opacity-20 blur-sm scale-105"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-950/40"></div>

      <div className="relative z-10 w-full max-w-md bg-black/80 backdrop-blur-xl p-8 rounded-3xl border border-zinc-800 shadow-2xl shadow-pink-500/5 animate-in zoom-in-95 duration-700">
        
        <div className="flex flex-col items-center mb-8">
          <img src="https://i.ibb.co/xnqpNZV/Whats-App-Image-2026-05-10-at-4-19-50-PM.jpg" className="h-20 w-20 rounded-2xl object-cover border border-zinc-700 shadow-lg shadow-pink-500/20 mb-4" alt="DRS Logo" />
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Daily Ride <span className="text-pink-600 not-italic">South</span></h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">Petrolhead Community</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <InputField 
            label="Email Address" 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="member@dailyridesouth.com" 
            required 
          />
          <InputField 
            label="Password" 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            placeholder="••••••••" 
            required 
          />

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-lg">
              <p className="text-red-500 text-xs font-bold uppercase tracking-widest text-center">{error}</p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:hover:bg-pink-600 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-pink-500/20 uppercase tracking-widest active:scale-[0.98]"
          >
            {loading ? 'Processing...' : (isLogin ? 'Enter Garage' : 'Join Club')}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-zinc-800/50 pt-6">
          <p className="text-zinc-400 text-sm">
            {isLogin ? "Don't have an account yet?" : "Already part of the club?"}
          </p>
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-pink-500 hover:text-pink-400 font-bold uppercase text-xs tracking-widest mt-2 transition-colors"
          >
            {isLogin ? 'Sign up here' : 'Log in instead'}
          </button>
        </div>
      </div>
    </div>
  );
};


// --- MOCK DATA (Static Fallbacks) ---

const STATIC_EVENTS = [
  {
    id: 1,
    title: "Tunerfest South",
    date: "Sunday, 14th June 2026",
    time: "09:00 AM",
    location: "Brands Hatch Circuit, Kent",
    description: "Celebrating the UK's tuning scene with Time Attack, drifting, and massive club displays. An action-packed day out.",
    image: "https://scontent.fltn4-1.fna.fbcdn.net/v/t39.30808-6/615332601_1303146985173729_7017742900608760889_n.jpg?_nc_cat=111&ccb=1-7&_nc_sid=2a1932&_nc_ohc=9lMQN9k9fWwQ7kNvwEUw7bF&_nc_oc=Adrt86yG2RX2lia1fFym533-vAHlszAQe8vVA64q3g8wkzt7Jfx1KDqJcB-lJSwDnykrci9OoljCxIr8bzEGJz-K&_nc_zt=23&_nc_ht=scontent.fltn4-1.fna&_nc_gid=2KM11XS369ylUsSZzTmGew&_nc_ss=7b2a8&oh=00_Af6PNVmhDJzfZrZCfLJXUNXvnrBMD-3wj8UQvYTlsocLqg&oe=6A067D2C",
    link: "https://www.brandshatch.co.uk/2026/june/tunerfest-south"
  },
  {
    id: 2,
    title: "Isle of Wight Takeover",
    date: "Saturday, 16th May 2026",
    time: "10:00 AM",
    location: "Isle of Wight",
    description: "The ultimate weekend away for car enthusiasts. Join our club stand as we head over on the ferry for a massive island takeover.",
    image: "https://scontent.fltn4-1.fna.fbcdn.net/v/t39.30808-6/370897411_788936759904376_6556989917387874387_n.jpg?_nc_cat=100&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=BAm1Zb4f-a8Q7kNvwF4HI_P&_nc_oc=AdoHjuaouRTMphGXdxORfQlSFYaOroD7I3nl0lfqQkZpAyG2i1rLmcZEMgm5HRjZLJl3rYRR_4AemK172VSwxXe1&_nc_zt=23&_nc_ht=scontent.fltn4-1.fna&_nc_gid=EmZtuaqTOlSEllcyBAYDPA&_nc_ss=7b2a8&oh=00_Af5oVHzQmfxAuzDJ3SjQBwDnCKIR9t4QvxmZImjX9Z_j3w&oe=6A0678E0",
    link: "https://www.iowtakeover.co.uk/"
  },
  {
    id: 3,
    title: "TRAX",
    date: "Sunday, 16th August 2026",
    time: "09:00 AM",
    location: "Silverstone Circuit",
    description: "Britain's biggest performance car show. We will have a dedicated club stand. Features live track time and professional drifting displays.",
    image: "https://scontent.fltn4-1.fna.fbcdn.net/v/t39.30808-6/597894646_1257634839745045_372102352193919714_n.jpg?_nc_cat=100&ccb=1-7&_nc_sid=2a1932&_nc_ohc=35X4SY7dnmkQ7kNvwEwboEG&_nc_oc=Adpg8NNV3a0AdvHzh8yEsEk_Qa3DtyI9a-SuyKblDuqTTqFiV8iWIqHOWc0djpS_gQ6z0ZS327EGchEspfksXzEf&_nc_zt=23&_nc_ht=scontent.fltn4-1.fna&_nc_gid=kofn6rvocXLB_bC8mS405w&_nc_ss=7b2a8&oh=00_Af6xgBQDE6Ks8tXI5Q5WdNok7Nw_o37QF3mqQJXef9ayuA&oe=6A069083",
    link: "https://traxshows.co.uk/"
  },
  {
    id: 4,
    title: "Ford Fair",
    date: "Sunday, 23rd August 2026",
    time: "08:30 AM",
    location: "Silverstone Circuit",
    description: "The biggest and best Ford festival in Europe. Expect thousands of club cars, intense track action, and huge retail villages.",
    image: "https://scontent.fltn4-1.fna.fbcdn.net/v/t39.30808-6/597864318_1331850388984316_4749659490145813671_n.jpg?_nc_cat=103&ccb=1-7&_nc_sid=2a1932&_nc_ohc=Eyzst_iXSeEQ7kNvwF165SD&_nc_oc=AdoDsCCTTBzrUNBCRp75jZ0jIv8H2XjTev23iPy3bQNpiE5djXJXpSvQo0oJpyfotxjSytru99gpgebiIDOv8cQJ&_nc_zt=23&_nc_ht=scontent.fltn4-1.fna&_nc_gid=9XwwuzQfNhIwISHL8RR-KA&_nc_ss=7b2a8&oh=00_Af5tVKR_W4mxaLAaIVKvPgimkVJs48pQ6CJ_NztkYJQ3zw&oe=6A068DDB",
    link: "https://fordshows.co.uk/ford-fair"
  },
  {
    id: 5,
    title: "Ford Power Live",
    date: "Sunday, 13th September 2026",
    time: "09:00 AM",
    location: "Brands Hatch Circuit, Kent",
    description: "A dedicated celebration of all things Ford, from classic RS models to the latest STs taking to the famous Indy circuit.",
    image: "https://i.ibb.co/Nd6d6L3m/Untitled-design-9.png",
    link: "https://www.fordpowerlive.co.uk/"
  },
  {
    id: 6,
    title: "Lancing Motor Show",
    date: "Sunday, 27th September 2026",
    time: "09:00 AM",
    location: "Lancing Beach Green, West Sussex",
    description: "600+ cars on display at Lancing Beach Green. FREE ENTRY to public, with Children's Amusements, Trade Stalls, Hot & Cold Drinks, Food refreshments and much more to see and do on the day. A display of motoring excellence.",
    image: "https://scontent.fltn4-1.fna.fbcdn.net/v/t39.30808-6/673478652_1411226824381514_8742350712894671620_n.png?_nc_cat=108&ccb=1-7&_nc_sid=2a1932&_nc_ohc=HIDGrimsPmAQ7kNvwHOoubY&_nc_oc=AdrAY5sMilU7z84ghmC3VwRtoff35i3jmKvEEdmM2bUFHGBX7AS-wl4iiBmxSBroVyo6SJgOSKceHXnT3-telYcb&_nc_zt=23&_nc_ht=scontent.fltn4-1.fna&_nc_gid=ZjADEz4Aukm54gCOUIAKUw&_nc_ss=7b2a8&oh=00_Af58pi1U-_VlcuRajrZMqDu2Gk0NK83QXmn8qD7jv7Q01g&oe=6A06721B",
    link: "https://lancingmotorshow.onlineticketseller.com/"
  }
];

const STATIC_CHARITY = [
  {
    id: 1,
    title: "Coastguard Association 50th Anniversary",
    description: "Daily Ride South is supporting the Coastguard for their 50th year. These dedicated volunteers look after our coastline and are on call day and night. Purchase official merchandise to support them directly.",
    raised: 1250,
    deadline: "31st December 2026",
    image: "https://images.unsplash.com/photo-1468276311594-df7cb65d8df6?auto=format&fit=crop&q=80&w=800",
    link: "https://coastguardassociation.sumupstore.com/"
  }
];

// --- COMPONENTS ---

const EventsView = ({ events }) => {
  const handleRSVP = (event) => {
    const recipient = "Dailyridesouth@gmail.com";
    const subject = encodeURIComponent(`RSVP for ${event.title}`);
    const body = encodeURIComponent(`Hi Daily Ride South team,\n\nI would like to RSVP for the following event:\n\nEvent: ${event.title}\nDate: ${event.date}\nLocation: ${event.location}\n\nPlease let me know if there are any specific meeting details for the club stand.\n\nThanks!`);
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-6 border-b border-zinc-800 pb-2">Upcoming Events</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map(event => (
          <div key={event.id} className="bg-zinc-900 rounded-xl overflow-hidden shadow-lg border border-zinc-800 hover:border-pink-500 transition-colors flex flex-col">
            <div className="h-48 overflow-hidden shrink-0">
              <img src={event.image} alt={event.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-5 flex flex-col flex-grow">
              <h3 className="text-xl font-bold text-white mb-3">{event.title}</h3>
              <div className="space-y-2 text-sm text-zinc-300 mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-pink-500" />
                  <span>{event.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-pink-500" />
                  <span>{event.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-pink-500" />
                  <span>{event.location}</span>
                </div>
              </div>
              <p className="text-zinc-400 text-sm flex-grow mb-5">{event.description}</p>
              <div className="grid grid-cols-2 gap-3 mt-auto">
                <button 
                  onClick={() => handleRSVP(event)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2 rounded-lg transition-colors border border-zinc-700"
                >
                  RSVP
                </button>
                {event.link && (
                  <a 
                    href={event.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full bg-pink-600 hover:bg-pink-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    Details <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MembersView = ({ members }) => {
  const [selectedMember, setSelectedMember] = useState(null);

  if (selectedMember) {
    const cars = selectedMember.cars || [];
    
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button 
          onClick={() => setSelectedMember(null)}
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
              {selectedMember.role === "Club President" && <Award className="w-6 h-6 text-yellow-500" />}
            </h2>
            <p className="text-pink-500 font-medium text-lg">{selectedMember.role || 'Member'}</p>
            <p className="text-zinc-400 mt-2 max-w-2xl">{selectedMember.bio || 'No bio provided.'}</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-4">
              <p className="text-zinc-500 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Member since {selectedMember.joinDate}
              </p>
              {selectedMember.location && (
                <p className="text-zinc-500 text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> {selectedMember.location}
                </p>
              )}
            </div>
          </div>
        </div>

        <h3 className="text-2xl font-bold text-white mt-8 mb-4 border-b border-zinc-800 pb-2">Garage Gallery</h3>
        <div className="grid gap-6 md:grid-cols-2">
          {cars.map((car, idx) => (
            <div key={idx} className="bg-zinc-900 rounded-xl overflow-hidden shadow-lg border border-zinc-800">
              <div className="h-64 overflow-hidden relative group">
                <img 
                  src={car.image || DEFAULT_CAR} 
                  alt={`${car.make} ${car.model}`} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80"></div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex justify-between items-end mb-1">
                    <h4 className="text-2xl font-bold text-white">{car.make} {car.model}</h4>
                    {car.reg && <span className="bg-yellow-400 text-black font-bold px-2 py-0.5 rounded text-xs tracking-wider">{car.reg.toUpperCase()}</span>}
                  </div>
                  <p className="text-zinc-300 font-medium">{car.year} • {car.specs}</p>
                  {car.mods && (
                    <p className="text-pink-400 text-sm font-medium mt-2 line-clamp-2">Mods: <span className="text-zinc-300 font-normal">{car.mods}</span></p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
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
            onClick={() => setSelectedMember(member)}
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
    
    // MANDATORY STORAGE RULE: Path must include artifacts/{appId}/users/{userId}/data/ or artifacts/{appId}/users/{userId}/uploads/
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
  const [avatar, setAvatar] = useState('');
  const [cars, setCars] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setNickname(userProfile.nickname || '');
      setBio(userProfile.bio || '');
      setLocation(userProfile.location || '');
      setAvatar(userProfile.avatar || '');
      setCars(userProfile.cars || []);
    }
  }, [userProfile]);

  const handleSave = async () => {
    if (!user) return;
    const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'members', user.uid);
    await setDoc(profileRef, {
      name, nickname, bio, location, avatar, cars,
      role: userProfile?.role || 'Member',
      joinDate: userProfile?.joinDate || formatDate(new Date())
    }, { merge: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
            <div className="sm:col-span-2">
                <InputField label="Town / City" value={location} onChange={e => setLocation(e.target.value)} />
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
        <button onClick={() => setCars([...cars, { reg: '', make: '', model: '', year: 2026, specs: '', mods: '', image: '' }])} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm border border-zinc-700 transition-colors"><Plus className="w-4 h-4" /> Add Vehicle</button>
      </div>

      <div className="space-y-6">
        {cars.map((car, idx) => (
          <div key={idx} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 relative shadow-lg animate-in slide-in-from-left-4 duration-300">
            <button onClick={() => setCars(cars.filter((_, i) => i !== idx))} className="absolute top-4 right-4 text-zinc-500 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
            <div className="grid md:grid-cols-2 gap-4">
              <InputField label="Registration" value={car.reg} onChange={e => { const n = [...cars]; n[idx].reg = e.target.value; setCars(n); }} />
              <InputField label="Make" value={car.make} onChange={e => { const n = [...cars]; n[idx].make = e.target.value; setCars(n); }} />
              <InputField label="Model" value={car.model} onChange={e => { const n = [...cars]; n[idx].model = e.target.value; setCars(n); }} />
              <InputField label="Year" type="number" value={car.year} onChange={e => { const n = [...cars]; n[idx].year = e.target.value; setCars(n); }} />
              <InputField label="Specs" value={car.specs} onChange={e => { const n = [...cars]; n[idx].specs = e.target.value; setCars(n); }} />
              <InputField label="Mods" value={car.mods} onChange={e => { const n = [...cars]; n[idx].mods = e.target.value; setCars(n); }} />
              <div className="md:col-span-2 bg-black/30 p-4 rounded-lg border border-zinc-800/50">
                  <ImageUpload label="Upload Vehicle Photo" onUploadSuccess={url => { const n = [...cars]; n[idx].image = url; setCars(n); }} />
                  {car.image && <p className="text-[10px] text-green-500 mt-2 font-bold uppercase tracking-widest flex items-center gap-1">Photo Uploaded Successfully</p>}
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

const RafflesView = ({ raffles }) => (
  <div className="space-y-6">
    <h2 className="text-3xl font-bold text-white border-b border-zinc-800 pb-2">Active Raffles</h2>
    <div className="grid gap-6 lg:grid-cols-2">
      {raffles.map(raffle => {
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
                <button className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-3 py-1 rounded border border-zinc-700 text-[10px] transition-colors uppercase tracking-widest">Reserve</button>
              </div>
            </div>
          </div>
        );
      })}
      {raffles.length === 0 && <p className="text-zinc-500 py-12 text-center col-span-full italic">No active raffles available at the moment. Check back soon!</p>}
    </div>
  </div>
);

const CharityView = ({ charityRaised }) => (
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
            <div className="bg-black/50 p-6 rounded-xl text-center border border-zinc-800 shadow-inner">
              <p className="text-pink-500 uppercase text-xs font-black mb-2 tracking-[0.2em]">Total Raised to Date</p>
              <p className="text-5xl font-black text-white tracking-tighter shadow-pink-500/5 drop-shadow-md">£{(charityRaised || campaign.raised).toLocaleString()}</p>
            </div>
            <a href={campaign.link} target="_blank" rel="noopener noreferrer" className="bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-pink-500/10 uppercase tracking-widest"><Heart className="w-5 h-5 fill-white" /> Support the Coastguard</a>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AdminView = ({ members, events, raffles, charityRaised }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', description: '', image: '', link: '' });
  const [newRaffle, setNewRaffle] = useState({ title: '', description: '', drawDate: '', ticketPrice: '', totalTickets: 100, ticketsSold: 0, image: '' });
  const [newCharityTotal, setNewCharityTotal] = useState(charityRaised || 1250);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'dailyride2026') { setIsAuthenticated(true); setError(''); }
    else { setError('Access Denied: Incorrect credentials.'); }
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
          <InputField label="Poster Image URL" value={newEvent.image} onChange={e => setNewEvent({...newEvent, image: e.target.value})} />
          <InputField label="External Ticket Link" value={newEvent.link} onChange={e => setNewEvent({...newEvent, link: e.target.value})} />
          <div className="md:col-span-2 space-y-1">
             <label className="block text-sm font-medium text-zinc-400">Event Description</label>
             <textarea className="w-full bg-black border border-zinc-800 text-white rounded-xl p-4 outline-none focus:border-pink-500 transition-all" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} placeholder="Detailed brief for club members..." rows={3} />
          </div>
          <button onClick={async () => { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'events'), newEvent); setNewEvent({ title: '', date: '', time: '', location: '', description: '', image: '', link: '' }); }} className="md:col-span-2 bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-xl transition-all uppercase tracking-[0.2em] shadow-lg shadow-pink-500/20">Publish to Public Board</button>
        </div>
      </section>

      <section className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 space-y-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-pink-500"></div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-widest"><Ticket className="w-5 h-5 text-pink-500" /> Raffle Administration</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <InputField label="Prize Title" value={newRaffle.title} onChange={e => setNewRaffle({...newRaffle, title: e.target.value})} />
          <InputField label="Live Draw Date" value={newRaffle.drawDate} onChange={e => setNewRaffle({...newRaffle, drawDate: e.target.value})} />
          <InputField label="Ticket Cost (£)" value={newRaffle.ticketPrice} onChange={e => setNewRaffle({...newRaffle, ticketPrice: e.target.value})} />
          <InputField label="Maximum Ticket Cap" type="number" value={newRaffle.totalTickets} onChange={e => setNewRaffle({...newRaffle, totalTickets: Number(e.target.value)})} />
          <div className="md:col-span-2">
            <InputField label="Prize Image URL" value={newRaffle.image} onChange={e => setNewRaffle({...newRaffle, image: e.target.value})} />
          </div>
          <div className="md:col-span-2 space-y-1">
             <label className="block text-sm font-medium text-zinc-400">Raffle Terms / Details</label>
             <textarea className="w-full bg-black border border-zinc-800 text-white rounded-xl p-4 outline-none focus:border-pink-500 transition-all" value={newRaffle.description} onChange={e => setNewRaffle({...newRaffle, description: e.target.value})} placeholder="What's for grabs?..." rows={3} />
          </div>
          <button onClick={async () => { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'raffles'), newRaffle); setNewRaffle({ title: '', description: '', drawDate: '', ticketPrice: '', totalTickets: 100, ticketsSold: 0, image: '' }); }} className="md:col-span-2 bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-xl transition-all uppercase tracking-[0.2em] shadow-lg shadow-pink-500/20">Go Live with Raffle</button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8 pt-8 border-t border-zinc-800/50">
          {raffles.map(r => (
            <div key={r.id} className="bg-black p-4 rounded-xl border border-zinc-800 flex flex-col justify-between group">
              <div>
                <p className="text-white font-bold text-sm truncate uppercase tracking-wider">{r.title}</p>
                <p className="text-zinc-500 text-[10px] font-bold mt-1 uppercase tracking-[0.1em] italic">Tickets Sold: {r.ticketsSold}</p>
              </div>
              <button onClick={async () => { if(window.confirm('PERMANENTLY DELETE RAFFLE?')) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'raffles', r.id)); }} className="text-red-900 group-hover:text-red-500 font-bold uppercase text-[9px] mt-4 flex items-center gap-1 transition-colors tracking-widest"><Trash2 className="w-3 h-3" /> Purge Entry</button>
            </div>
          ))}
        </div>
      </section>

      <div className="grid md:grid-cols-3 gap-8">
        <section className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 space-y-4 shadow-xl">
          <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest border-b border-zinc-800 pb-3"><Edit3 className="w-4 h-4 text-pink-500" /> Funds Raised</h3>
          <div className="space-y-4">
            <input type="number" value={newCharityTotal} onChange={e => setNewCharityTotal(e.target.value)} className="w-full bg-black border border-zinc-800 text-white rounded-xl p-4 outline-none focus:border-pink-500 text-xl font-bold tracking-tight shadow-inner" />
            <button onClick={async () => await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'charity'), { raised: Number(newCharityTotal) }, { merge: true })} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all uppercase text-xs tracking-widest border border-zinc-700">Update Counter</button>
          </div>
        </section>
        <section className="md:col-span-2 bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden flex flex-col">
          <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest border-b border-zinc-800 pb-3 mb-4"><Users className="w-4 h-4 text-pink-500" /> Member Moderation Hub</h3>
          <div className="grid sm:grid-cols-2 gap-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {members.map(m => (
              <div key={m.id} className="flex justify-between items-center bg-black/50 p-3 rounded-xl border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                <div className="flex flex-col">
                    <span className="text-white text-xs font-bold truncate max-w-[120px]">{m.name}</span>
                    <span className="text-zinc-600 text-[9px] uppercase tracking-tighter">{m.nickname || 'NO NICKNAME'}</span>
                </div>
                <button onClick={async () => { if(window.confirm('EXPEL MEMBER FROM CLUB?')) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', m.id)); }} className="text-zinc-700 hover:text-red-500 transition-colors p-2"><Trash2 className="w-4 h-4" /></button>
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
  const [activeTab, setActiveTab] = useState('events');
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [cloudMembers, setCloudMembers] = useState([]);
  const [cloudEvents, setCloudEvents] = useState([]);
  const [cloudRaffles, setCloudRaffles] = useState([]);
  const [charityRaised, setCharityRaised] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Only use the custom token if running within the initial Canvas preview environment
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

    const charityRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'charity');
    const unsubCharity = onSnapshot(charityRef, d => { if (d.exists()) setCharityRaised(d.data().raised); });
    
    return () => { unsubMembers(); unsubEvents(); unsubRaffles(); unsubCharity(); };
  }, [user]);

  if (isLoadingAuth) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-sm animate-pulse">Initialising Framework...</div>;
  }

  // If no user is logged in, show the splash view
  if (!user) {
    return <SplashView />;
  }

  const navItems = [
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'profile', label: 'My Profile', icon: UserCircle },
    { id: 'raffles', label: 'Raffles', icon: Ticket },
    { id: 'charity', label: 'Charity', icon: Heart },
  ];

  const combinedEvents = [...STATIC_EVENTS, ...cloudEvents];
  const currentUserProfile = cloudMembers.find(m => m.id === user?.uid) || null;

  const renderContent = () => {
    switch (activeTab) {
      case 'events': return <EventsView events={combinedEvents} />;
      case 'members': return <MembersView members={cloudMembers} />;
      case 'profile': return <ProfileView user={user} userProfile={currentUserProfile} />;
      case 'raffles': return <RafflesView raffles={cloudRaffles} />;
      case 'charity': return <CharityView charityRaised={charityRaised} />;
      case 'admin': return <AdminView members={cloudMembers} events={combinedEvents} raffles={cloudRaffles} charityRaised={charityRaised} />;
      default: return <EventsView events={combinedEvents} />;
    }
  };

  const NavLink = ({ item, mobile = false }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button onClick={() => { setActiveTab(item.id); setIsMenuOpen(false); }} className={`flex items-center gap-3 px-6 py-4 rounded-2xl transition-all ${isActive ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/20' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'} ${mobile ? 'w-full' : ''}`}>
        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-pink-500'}`} />
        <span className="font-black uppercase tracking-widest text-xs">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 font-sans pb-32 text-zinc-200 selection:bg-pink-500/30 selection:text-pink-200">
      <header className="bg-black/90 backdrop-blur-xl border-b border-zinc-900 sticky top-0 z-50 h-20 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 h-full flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('events')}>
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
      <div className={`fixed top-0 right-0 h-full w-80 bg-zinc-950 z-[70] border-l border-zinc-800 transform transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) p-8 shadow-[0_0_50px_rgba(0,0,0,1)] ${isMenuOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
        <div className="flex justify-between items-center mb-12">
          <div className="flex flex-col">
              <span className="text-white font-black uppercase text-xl tracking-tighter">DRS <span className="text-pink-600 italic">Menu</span></span>
              <span className="text-zinc-600 font-bold uppercase text-[10px] tracking-[0.3em]">Navigation Board</span>
          </div>
          <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        
        <nav className="space-y-3 flex-grow">
          {navItems.map(item => <NavLink key={item.id} item={item} mobile />)}
        </nav>
        
        <div className="absolute bottom-8 left-8 right-8 space-y-4">
          <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors uppercase tracking-widest text-xs font-bold">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
          <div className="p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 text-center">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2">Member Since 2026</p>
              <p className="text-white text-xs font-bold">Stay Tuned. Drive Hard.</p>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 pt-10">
        {renderContent()}
      </main>

      <footer className="mt-32 border-t border-zinc-900 py-16 bg-black/40">
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => setActiveTab('events')}>
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
           const isActive = activeTab === item.id;
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