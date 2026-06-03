import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMembers } from '../context/MembersContext';
import { FacebookIcon, InstagramIcon, TikTokIcon } from '../components/Shared';
import { Ticket, ChevronRight, Grid } from 'lucide-react';
import { DEFAULT_CAR, DEFAULT_AVATAR } from '../utils/helpers';

export default function HomeView() {
  const { members } = useMembers();
  const navigate = useNavigate();
  
  // Note: For a true production app, you would fetch these from a SettingsContext
  const clubDescription = "It started simply enough: just a petrolhead couple bonded by a shared love for burning fuel and draining bank accounts.";
  
  // Dynamic spotlight logic
  const spotlightMember = useMemo(() => {
    const today = new Date();
    const d = today.getDate().toString();
    const m = (today.getMonth() + 1).toString();
    const birthdayMembers = members.filter(mb => !mb.isHidden && mb.birthdayDay === d && mb.birthdayMonth === m);
    return birthdayMembers.length > 0 ? birthdayMembers[0] : (members.find(m => !m.isHidden) || null);
  }, [members]);

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

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900/60 p-6 md:p-8 rounded-3xl border border-zinc-800/50 shadow-inner mb-10">
        <p className="text-zinc-300 text-sm md:text-base leading-relaxed mb-4 italic whitespace-pre-wrap">{clubDescription}</p>
        <div className="flex flex-wrap items-center gap-6 mt-6 pt-6 border-t border-zinc-800/50">
          <a href="[https://www.facebook.com/daily.ride.south](https://www.facebook.com/daily.ride.south)" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-pink-500 font-bold text-xs uppercase"><FacebookIcon className="w-5 h-5" /></a>
          <a href="[https://www.instagram.com/daily.ride.south/](https://www.instagram.com/daily.ride.south/)" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-pink-500 font-bold text-xs uppercase"><InstagramIcon className="w-5 h-5" /></a>
          <a href="[https://www.tiktok.com/@dailyridesouth](https://www.tiktok.com/@dailyridesouth)" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-pink-500 font-bold text-xs uppercase"><TikTokIcon className="w-5 h-5" /></a>
        </div>
      </div>

      <div 
        onClick={() => navigate('/raffles')}
        className="bg-gradient-to-r from-pink-600 to-pink-900 rounded-3xl p-6 md:p-8 flex items-center justify-between cursor-pointer hover:scale-[1.02] shadow-xl mb-10 group"
      >
        <div className="flex items-center gap-4">
          <Ticket className="w-8 h-8 text-white" />
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Live Club Raffles</h3>
            <p className="text-pink-200 text-[10px] font-bold uppercase">Win premium prizes</p>
          </div>
        </div>
        <ChevronRight className="w-8 h-8 text-white group-hover:translate-x-2 transition-transform" />
      </div>

      {spotlightMember && (
        <div className="mb-6 relative rounded-3xl overflow-hidden h-64 border border-zinc-800 group">
          <img src={(spotlightMember.cars && spotlightMember.cars[0]?.image) || DEFAULT_CAR} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
          <div className="absolute bottom-6 left-6 flex items-center gap-4">
             <img src={spotlightMember.avatar || DEFAULT_AVATAR} className="w-20 h-20 rounded-full border-4 border-black object-cover" alt="" />
             <div>
                <h3 className="text-2xl font-black text-white uppercase">{spotlightMember.name || 'Pending Setup'}</h3>
                <p className="text-zinc-300 font-bold text-xs uppercase mt-2">{spotlightMember.role || 'Member'}</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
