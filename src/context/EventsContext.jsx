import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../firebase/config';
import { useAuth } from './AuthContext';

const EventsContext = createContext();

export function EventsProvider({ children }) {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [rsvps, setRsvps] = useState({});

  useEffect(() => {
    if (!user) return;

    const unsubEvents = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'events'), (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(fetched);
    });

    const unsubRsvps = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'rsvps'), (snapshot) => {
      const fetched = {};
      snapshot.forEach(doc => { fetched[doc.id] = doc.data(); });
      setRsvps(fetched);
    });

    return () => {
      unsubEvents();
      unsubRsvps();
    };
  }, [user]);

  return (
    <EventsContext.Provider value={{ events, rsvps }}>
      {children}
    </EventsContext.Provider>
  );
}

export const useEvents = () => useContext(EventsContext);