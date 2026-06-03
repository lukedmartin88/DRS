import React, { useState, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, appId } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useMembers } from '../context/MembersContext';
import { useEvents } from '../context/EventsContext';
import { Calendar, Clock, MapPin, ExternalLink, Download, History } from 'lucide-react';
import { DEFAULT_AVATAR, parseEventDateStr } from '../utils/helpers';

const STATIC_EVENTS = [
  {
    id: 'static-1',
    title: "Tunerfest South",
    date: "Sunday, 14th June 2026",
    time: "09:00 AM",
    location: "Brands Hatch Circuit, Kent",
    description: "Celebrating the UK's tuning scene with Time Attack, drifting, and massive club displays. An action-packed day out.",
    image: "[https://scontent.fltn4-1.fna.fbcdn.net/v/t39.30808-6/615332601_1303146985173729_7017742900608760889_n.jpg?_nc_cat=111&ccb=1-7&_nc_sid=2a1932&_nc_ohc=9lMQN9k9fWwQ7kNvwEUw7bF&_nc_oc=Adrt86yG2RX2lia1fFym533-vAHlszAQe8vVA64q3g8wkzt7Jfx1KDqJcB-lJSwDnykrci9OoljCxIr8bzEGJz-K&_nc_zt=23&_nc_ht=scontent.fltn4-1.fna&_nc_gid=2KM11XS369ylUsSZzTmGew&_nc_ss=7b2a8&oh=00_Af6PNVmhDJzfZrZCfLJXUNXvnrBMD-3wj8UQvYTlsocLqg&oe=6A067D2C](https://scontent.fltn4-1.fna.fbcdn.net/v/t39.30808-6/615332601_1303146985173729_7017742900608760889_n.jpg?_nc_cat=111&ccb=1-7&_nc_sid=2a1932&_nc_ohc=9lMQN9k9fWwQ7kNvwEUw7bF&_nc_oc=Adrt86yG2RX2lia1fFym533-vAHlszAQe8vVA64q3g8wkzt7Jfx1KDqJcB-lJSwDnykrci9OoljCxIr8bzEGJz-K&_nc_zt=23&_nc_ht=scontent.fltn4-1.fna&_nc_gid=2KM11XS369ylUsSZzTmGew&_nc_ss=7b2a8&oh=00_Af6PNVmhDJzfZrZCfLJXUNXvnrBMD-3wj8UQvYTlsocLqg&oe=6A067D2C)",
    link: "[https://www.brandshatch.co.uk/2026/june/tunerfest-south](https://www.brandshatch.co.uk/2026/june/tunerfest-south)",
    isStatic: true
  }
];

export default function EventsView() {
  const { user } = useAuth();
  const { members } = useMembers();
  const { events: cloudEvents, rsvps } = useEvents();
  const [isPast, setIsPast] = useState(false);

  const currentUserProfile = members.find(m => m.id === user?.uid);
  const isAdmin = currentUserProfile?.role === 'Admin';

  const combinedEvents = useMemo(() => {
    const cloudTitles = new Set(cloudEvents.map(e => e.title.toLowerCase()));
    const visibleStatic = STATIC_EVENTS.filter(s => !cloudTitles.has(s.title.toLowerCase()));
    return [...visibleStatic, ...cloudEvents];
  }, [cloudEvents]);

  const displayEvents = useMemo(() => {
    const n = new Date(); n.setHours(0,0,0,0);
    return combinedEvents
      .filter(e => isPast ? parseEventDateStr(e.date) < n : parseEventDateStr(e.date) >= n)
      .sort((a,b) => isPast ? parseEventDateStr(b.date) - parseEventDateStr(a.date) : parseEventDateStr(a.date) - parseEventDateStr(b.date));
  }, [combinedEvents, isPast]);

  const toggleRsvp = async (eventId) => {
    if (!user) return;
    try {
      const rsvpDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rsvps', String(eventId));
      const current = rsvps[eventId] || { attending: [], attended: [] };
      const field = isPast ? 'attended' : 'attending';
      const list = current[field] || [];
      const newList = list.includes(user.uid) ? list.filter(id => id !== user.uid) : [...list, user.uid];
      await setDoc(rsvpDocRef, { [field]: newList }, { merge: true });
    } catch (err) { console.error(err); }
  };

  const handleRSVP = (event) => {
    const recipient = "Dailyridesouth@gmail.com";
    const subject = encodeURIComponent(`Questions about ${event.title}`);
    const body = encodeURIComponent(`Hi Daily Ride South team,\n\nI have a question regarding the following event:\n\nEvent: ${event.title}\nDate: ${event.date}\nLocation: ${event.location}\n\nThanks!`);
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  };

  const membersById = useMemo(() => {
    return members.reduce((acc, member) => { acc[member.id] = member; return acc; }, {});
  }, [members]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-zinc-800 pb-2">
        <h2 className="text-3xl font-bold text-white">{isPast ? 'Past Events Gallery' : 'Upcoming Events'}</h2>
        <button 
          onClick={() => setIsPast(!isPast)}
          className="text-pink-500 hover:text-pink-400 flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors"
        >
          {isPast ? <><Calendar className="w-4 h-4" /> View Upcoming Events</> : <><History className="w-4 h-4" /> View Past Events Gallery</>}
        </button>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {displayEvents.map(event => {
          const eventRsvps = rsvps[event.id] || { attending: [], attended: [] };
          const listField = isPast ? 'attended' : 'attending';
          const rsvpList = eventRsvps[listField] || [];
          const isMarked = user && rsvpList.includes(user.uid);
          
          const attendeeMembers = rsvpList.map(uid => membersById[uid] || { id: uid, name: 'Guest', avatar: DEFAULT_AVATAR });

          return (
            <div key={event.id} className="bg-zinc-900 rounded-2xl overflow-hidden shadow-xl border border-zinc-800 flex flex-col transition-all hover:shadow-pink-500/5">
              <div className="h-48 overflow-hidden shrink-0 relative group">
                <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent"></div>
              </div>
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tighter leading-tight">{event.title}</h3>
                <div className="space-y-2 text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
                  <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-pink-500" /><span className="text-zinc-300">{event.date}</span></div>
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-pink-500" /><span>{event.time}</span></div>
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-pink-500" /><span className="truncate">{event.location}</span></div>
                </div>

                <p className="text-zinc-400 text-sm flex-grow mb-6 leading-relaxed">{event.description}</p>
                
                <div className="mt-auto">
                  <div className="space-y-3">
                    <button 
                      onClick={() => toggleRsvp(event.id)}
                      className={`w-full font-black py-4 rounded-xl transition-all uppercase tracking-[0.2em] text-[10px] shadow-lg active:scale-[0.98] ${isMarked ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-pink-600 hover:bg-pink-700 text-white'}`}
                    >
                      {isMarked ? (isPast ? 'Attended ✓' : 'Attending ✓') : (isPast ? 'Mark as Attended' : 'Mark as Attending')}
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => handleRSVP(event)} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-xl transition-colors border border-zinc-700 text-[10px] uppercase tracking-widest flex items-center justify-center">
                        Email Organiser
                      </button>
                      {event.link && (
                        <a href={event.link} target="_blank" rel="noopener noreferrer" className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-xl transition-colors border border-zinc-700 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                          Details <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}