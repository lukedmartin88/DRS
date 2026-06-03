import React from 'react';
import { Calendar } from 'lucide-react';

export const FacebookIcon = ({ className }) => (
  <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
);
export const InstagramIcon = ({ className }) => (
  <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);
export const TikTokIcon = ({ className }) => (
  <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
);

export const InputField = ({ label, value, onChange, placeholder, type = "text", required = false }) => (
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

export const EventListTile = ({ event, onEdit }) => (
  <div onClick={() => onEdit(event)} className="bg-black p-5 rounded-xl border border-zinc-800 flex flex-col justify-between group hover:border-pink-500 transition-colors cursor-pointer shadow-lg">
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