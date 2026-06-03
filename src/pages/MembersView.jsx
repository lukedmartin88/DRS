import React, { useState } from 'react';
import { useMembers } from '../context/MembersContext';
import { MemberProfileModal, CarGalleryModal } from '../components/Modals';
import { DEFAULT_AVATAR } from '../utils/helpers';
import { Search } from 'lucide-react';

export default function MembersView() {
  const { members } = useMembers();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [viewingCar, setViewingCar] = useState(null);

  const filteredMembers = members.filter(m => 
    !m.isHidden && (m.name?.toLowerCase().includes(searchTerm.toLowerCase()) || m.nickname?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (selectedMember) {
    return (
      <div className="animate-in fade-in duration-300">
        <MemberProfileModal 
          member={selectedMember} 
          onClose={() => setSelectedMember(null)} 
          onCarClick={(car) => setViewingCar(car)} 
        />
        {viewingCar && <CarGalleryModal viewingCar={viewingCar} onClose={() => setViewingCar(null)} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-4 text-zinc-500" />
        <input 
          type="text" 
          placeholder="Search members..." 
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-pink-500 transition-colors"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filteredMembers.map(member => (
          <div 
            key={member.id} 
            onClick={() => setSelectedMember(member)}
            className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 hover:border-pink-500 cursor-pointer transition-all flex flex-col items-center text-center group"
          >
            <img src={member.avatar || DEFAULT_AVATAR} className="w-20 h-20 rounded-full mb-3 border-2 border-zinc-700 group-hover:border-pink-500 transition-colors" alt="" />
            <h3 className="text-white font-bold truncate w-full">{member.name}</h3>
            <p className="text-pink-500 text-xs font-bold uppercase tracking-widest mt-1">{member.role}</p>
          </div>
        ))}
      </div>
    </div>
  );
}