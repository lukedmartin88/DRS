import React from 'react';
import { X, ChevronLeft, Shield, Award, Calendar, MapPin, ImageIcon } from 'lucide-react';
import { InstagramIcon } from './Shared';
import { DEFAULT_AVATAR, DEFAULT_CAR } from '../utils/helpers';

export const MemberProfileModal = ({ member, onClose, onCarClick }) => {
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

export const CarGalleryModal = ({ viewingCar, onClose }) => {
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

export const EnlargedImageModal = ({ imageObj, onClose, onMemberClick }) => {
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