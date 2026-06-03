import React, { useState } from 'react';
import { collection, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useMembers } from '../context/MembersContext';
import { useEvents } from '../context/EventsContext';
import { Shield, Plus, Edit3, X, Download } from 'lucide-react';
import { InputField } from '../components/Shared';

export default function AdminView() {
  const { user } = useAuth();
  const { members } = useMembers();
  const { events } = useEvents();
  
  const currentUserProfile = members.find(m => m.id === user?.uid);
  const [isAuthenticated, setIsAuthenticated] = useState(currentUserProfile?.role === 'Admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', description: '' });

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'dailyride2026' || currentUserProfile?.role === 'Admin') { 
        setIsAuthenticated(true); 
        setError(''); 
    } else { 
        setError('Access Denied: Incorrect credentials.'); 
    }
  };

  const handleDeployEvent = async () => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'events'), newEvent);
      setNewEvent({ title: '', date: '', time: '', location: '', description: '' });
      alert("Event deployed successfully!");
    } catch (err) {
      console.error("Error saving event:", err);
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

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-6 gap-4">
        <h2 className="text-3xl font-black text-white flex items-center gap-3 uppercase tracking-tighter"><Shield className="w-8 h-8 text-pink-500" /> Club Control Panel</h2>
        <span className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase hidden sm:block">Verified Admin</span>
      </div>
      
      <section className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 space-y-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-pink-500"></div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-widest"><Plus className="w-5 h-5 text-pink-500" /> Deploy New Event</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <InputField label="Event Title" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
          <InputField label="Date (e.g., Sunday, 1st Oct)" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
          <InputField label="Location / Venue" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} />
          <div className="md:col-span-2 space-y-1">
             <label className="block text-sm font-medium text-zinc-400">Event Description</label>
             <textarea className="w-full bg-black border border-zinc-800 text-white rounded-xl p-4 outline-none focus:border-pink-500 transition-all" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} rows={3} />
          </div>
          <button onClick={handleDeployEvent} className="md:col-span-2 bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-xl transition-all uppercase tracking-[0.2em] shadow-lg shadow-pink-500/20">Publish to Public Board</button>
        </div>
      </section>
    </div>
  );
}