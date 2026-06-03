import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useMembers } from '../context/MembersContext';
import { Ticket, History } from 'lucide-react';
import { parseRaffleReservations, DEFAULT_CAR } from '../utils/helpers';

export default function RafflesView() {
  const { user } = useAuth();
  const { members } = useMembers();
  const [cloudRaffles, setCloudRaffles] = useState([]);
  const [selectedRaffleId, setSelectedRaffleId] = useState(null);

  useEffect(() => {
    const unsubRaffles = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'raffles'), s => {
      const f = []; s.forEach(d => f.push({ id: d.id, ...d.data() })); setCloudRaffles(f);
    }, e => console.error(e));
    return () => unsubRaffles();
  }, []);

  const activeRaffles = cloudRaffles.filter((r) => !r.isEnded);
  const pastRaffles = cloudRaffles.filter((r) => r.isEnded);

  if (selectedRaffleId) {
    const raffle = cloudRaffles.find(r => r.id === selectedRaffleId);
    return (
        <div className="text-zinc-400 p-8 text-center bg-zinc-900 rounded-3xl border border-zinc-800">
           <h2 className="text-white text-2xl font-black mb-4 uppercase">{raffle?.title}</h2>
           <p className="mb-6">Integrate your RaffleDetailPage component here. It receives `raffleId`, `cloudRaffles`, and `members`.</p>
           <button onClick={() => setSelectedRaffleId(null)} className="text-pink-500 font-bold uppercase tracking-widest text-xs border border-pink-500 px-6 py-2 rounded-xl">Back to Raffles</button>
        </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="bg-zinc-900/60 p-6 md:p-8 rounded-3xl border border-zinc-800/50 shadow-inner">
        <p className="text-zinc-300 text-sm md:text-base leading-relaxed italic">
          Try your luck and win incredible club prizes whilst raising funds to keep DRS going.
          Click any draw to see full details and secure your tickets.
        </p>
      </div>

      <div className="space-y-5">
        <h2 className="text-3xl font-bold text-white border-b border-zinc-800 pb-2 flex items-center gap-3">
           <Ticket className="w-8 h-8 text-pink-500" /> Active Raffles
        </h2>
        {activeRaffles.length === 0 ? (
          <p className="text-zinc-500 py-12 text-center italic border border-dashed border-zinc-800 rounded-3xl">
            No active raffles right now. Check back soon!
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {activeRaffles.map((r) => {
                const list = parseRaffleReservations(r, members);
                const totalReserved = list.reduce((sum, item) => sum + item.ticketCount, 0);
                const progress = Math.min((totalReserved / r.totalTickets) * 100, 100);

                return (
                    <div key={r.id} onClick={() => setSelectedRaffleId(r.id)} className="group relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-pink-500 transition-all cursor-pointer shadow-lg flex flex-col">
                        <div className="relative h-52 overflow-hidden shrink-0">
                            <img src={r.image || DEFAULT_CAR} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute top-3 left-3 bg-pink-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase shadow">£{r.ticketPrice} / ticket</div>
                        </div>
                        <div className="p-4 flex flex-col flex-grow justify-between">
                            <h3 className="text-white font-black uppercase tracking-tight text-base">{r.title}</h3>
                            <div className="w-full bg-zinc-800 rounded-full h-1.5 shadow-inner mt-4">
                                <div className="bg-pink-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    </div>
                );
            })}
          </div>
        )}
      </div>

      {pastRaffles.length > 0 && (
        <div className="space-y-5 opacity-70 hover:opacity-100 transition-opacity">
          <h2 className="text-2xl font-bold text-white border-b border-zinc-800 pb-2 flex items-center gap-3">
             <History className="w-6 h-6 text-zinc-500" /> Past Draws
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pastRaffles.map((r) => (
                <div key={r.id} onClick={() => setSelectedRaffleId(r.id)} className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 cursor-pointer hover:border-zinc-500 transition-colors">
                    <div className="h-32 overflow-hidden grayscale relative">
                        <img src={r.image || DEFAULT_CAR} alt={r.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="bg-zinc-800 text-zinc-300 text-[10px] font-black px-3 py-1 rounded uppercase tracking-widest">Draw Ended</span>
                        </div>
                    </div>
                    <div className="p-3">
                        <h3 className="text-zinc-300 font-bold uppercase text-xs truncate">{r.title}</h3>
                    </div>
                </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}