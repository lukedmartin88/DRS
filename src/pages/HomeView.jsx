import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, ChevronRight, Grid } from 'lucide-react';

import { useMembers } from '../context/MembersContext';
import { FacebookIcon, InstagramIcon, TikTokIcon } from '../components/Shared';
import { DEFAULT_CAR, DEFAULT_AVATAR } from '../utils/helpers';

export default function HomeView() {
  const { members } = useMembers();
  const navigate = useNavigate();
  
  const [clubDescription] = useState("It started simply enough: just a petrol-head couple bonded by a shared love for burning fuel and draining bank accounts.");
  
  // Spotlight & Birthday Logic from original app
  const [birthdayIndex, setBirthdayIndex] = useState(0);
  const birthdayMembers = useMemo(() => {
    const today = new Date();
    const d = today.getDate().toString();
    const m = (today.getMonth() + 1).toString();
    return members.filter(mb => !mb.isHidden && mb.birthdayDay === d && mb.birthdayMonth === m);
  }, [members]);

  useEffect(() => {
    if (birthdayMembers.length > 1) {
      const interval = setInterval(() => setBirthdayIndex(prev => (prev + 1) % birthdayMembers.length), 5000);
      return () => clearInterval(interval);
    }
  }, [birthdayMembers.length]);

  const isBirthdaySpotlight = birthdayMembers.length > 0;
  const spotlightMember = useMemo(() => {
    if (birthdayMembers.length > 0) return birthdayMembers[birthdayIndex] || birthdayMembers[0];
    return members.find(m => !m.isHidden) || null;
  }, [members, birthdayMembers, birthdayIndex]);

  // Gallery Image Aggregator
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

  // Original Live Mosaic Logic
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
      
      {/* Exact Original Hero Banner */}
      <div className="w-full h-64 md:h-96 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 mb-6 relative group flex items-center justify-center">
        <img src="[https://i.ibb.co/dwGFSkDT/Whats-App-Image-2026-05-10-at-4.jpg](https://i.ibb.co/dwGFSkDT/Whats-App-Image-2026-05-10-at-4.jpg)" alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-black/40 to-black/20"></div>
        <img src="[https://i.ibb.co/xnqpNZV/Whats-App-Image-2026-05-10-at-4-19-50-PM.jpg](https://i.ibb.co/xnqpNZV/Whats-App-Image-2026-05-10-at-4-19-50-PM.jpg)" className="relative z-10 w-32 h-32 md:w-44 md:h-44 rounded-3xl object-cover border-4 border-black/50 shadow-2xl" alt="" />
      </div>

      <div className="bg-zinc-900/60 p-6 md:p-8 rounded-3xl border border-zinc-800/50 shadow-inner mb-10">
        <p className="text-zinc-300 text-sm md:text-base leading-relaxed mb-4 italic whitespace-pre-wrap">{clubDescription}</p>
        <div className="flex flex-wrap items-center gap-6 mt-6 pt-6 border-t border-zinc-800/50">
          <a href="[https://www.facebook.com/daily.ride.south](https://www.facebook.com/daily.ride.south)" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-pink-500 transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-widest"><FacebookIcon className="w-5 h-5" /> Facebook</a>
          <a href="[https://www.instagram.com/daily.ride.south/](https://www.instagram.com/daily.ride.south/)" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-pink-500 transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-widest"><InstagramIcon className="w-5 h-5" /> Instagram</a>
          <a href="[https://www.tiktok.com/@dailyridesouth?_r=1&_t=ZN-96GvaNt02b9](https://www.tiktok.com/@dailyridesouth?_r=1&_t=ZN-96GvaNt02b9)" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-pink-500 transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-widest"><TikTokIcon className="w-5 h-5" /> TikTok</a>
        </div>
      </div>

      <div 
        onClick={() => navigate('/raffles')}
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
        <div className="mb-6 relative rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 h-64 md:h-80 cursor-pointer group" onClick={() => navigate('/members')}>
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

      {/* Exact Original Live Club Mosaic */}
      <div className="mt-12 space-y-4">
        <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2"><Grid className="w-5 h-5 text-pink-500" /> Live Club Mosaic</h3>
            <button onClick={() => navigate('/gallery')} className="text-pink-500 hover:text-pink-400 text-xs font-bold uppercase tracking-widest transition-colors">View Full Gallery</button>
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
                    onClick={() => navigate('/gallery')} 
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
}
