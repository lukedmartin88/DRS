import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, appId } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useMembers } from '../context/MembersContext';
import { InputField } from '../components/Shared';
import { UserCircle } from 'lucide-react';

export default function ProfileView() {
  const { user } = useAuth();
  const { members } = useMembers();
  
  const profile = members.find(m => m.id === user?.uid) || {};
  
  const [name, setName] = useState(profile.name || '');
  const [nickname, setNickname] = useState(profile.nickname || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', user.uid), {
        name,
        nickname,
        bio
      }, { merge: true });
      alert("Profile updated successfully!");
    } catch (err) {
      console.error("Failed to update profile", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold text-white mb-6 border-b border-zinc-800 pb-2 flex items-center gap-3">
        <UserCircle className="text-pink-500 w-8 h-8" /> My Profile
      </h2>
      
      <form onSubmit={handleSave} className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 space-y-6">
        <InputField label="Full Name" value={name} onChange={e => setName(e.target.value)} required />
        <InputField label="Nickname (Optional)" value={nickname} onChange={e => setNickname(e.target.value)} />
        
        <div className="w-full space-y-1">
          <label className="block text-sm font-medium text-zinc-400">Bio</label>
          <textarea 
            value={bio} 
            onChange={e => setBio(e.target.value)} 
            rows={4}
            className="w-full bg-black border border-zinc-800 text-white rounded-lg p-3 outline-none focus:border-pink-500" 
          />
        </div>

        <button 
          type="submit" 
          disabled={isSaving}
          className="w-full bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-xl uppercase tracking-widest disabled:opacity-50"
        >
          {isSaving ? 'Synchronising...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}