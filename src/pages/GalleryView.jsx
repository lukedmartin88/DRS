import React, { useMemo } from 'react';
import { useMembers } from '../context/MembersContext';
import { Grid } from 'lucide-react';

export default function GalleryView() {
  const { members, loadingMembers } = useMembers();

  const allImages = useMemo(() => {
    const imgs = [];
    members.forEach(m => {
      if (!m.isHidden && m.cars) {
        m.cars.forEach(c => { 
           if(c.image) imgs.push({url: c.image, member: m, carName: `${c.make} ${c.model}`}); 
           if(c.gallery) {
              c.gallery.forEach(g => {
                 if(g) imgs.push({url: g, member: m, carName: `${c.make} ${c.model}`});
              });
           }
        });
      }
    });
    // Shuffle or sort as required; here we just reverse to show newest added (roughly) first
    return imgs.reverse();
  }, [members]);

  if (loadingMembers) {
    return <div className="text-zinc-500 text-center py-12 font-bold uppercase tracking-widest text-xs">Loading Gallery...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-4 mb-6">
        <Grid className="w-8 h-8 text-pink-500" />
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Club Gallery</h2>
      </div>

      {allImages.length === 0 ? (
        <p className="text-zinc-500 py-12 text-center italic border border-dashed border-zinc-800 rounded-3xl">
          No images in the gallery yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {allImages.map((img, idx) => (
            <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square bg-zinc-900 border border-zinc-800">
              <img 
                src={img.url} 
                alt={img.carName} 
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <p className="text-white font-black text-xs uppercase tracking-tight truncate">{img.member.name}</p>
                <p className="text-pink-500 font-bold text-[8px] uppercase tracking-widest truncate">{img.carName}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}