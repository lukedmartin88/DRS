import React, { useState, useMemo } from 'react';
import { useMembers } from '../context/MembersContext';
import { EnlargedImageModal, MemberProfileModal, CarGalleryModal } from '../components/Modals';

export default function GalleryView() {
  const { members } = useMembers();
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [viewingCar, setViewingCar] = useState(null);

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
      <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Club Gallery</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {allImages.map((img, i) => (
          <div key={i} onClick={() => setEnlargedImage(img)} className="aspect-square cursor-pointer overflow-hidden rounded-lg group">
            <img src={img.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
          </div>
        ))}
      </div>

      {enlargedImage && (
        <EnlargedImageModal 
          imageObj={enlargedImage} 
          onClose={() => setEnlargedImage(null)} 
          onMemberClick={(m) => {
            setEnlargedImage(null);
            setSelectedMember(m);
          }} 
        />
      )}

      {selectedMember && (
        <div className="fixed inset-0 z-[120] bg-black p-4 overflow-y-auto">
            <MemberProfileModal 
                member={selectedMember} 
                onClose={() => setSelectedMember(null)} 
                onCarClick={(car) => setViewingCar(car)} 
            />
            {viewingCar && <CarGalleryModal viewingCar={viewingCar} onClose={() => setViewingCar(null)} />}
        </div>
      )}
    </div>
  );
}