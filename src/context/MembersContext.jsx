import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../firebase/config';
import { useAuth } from './AuthContext';

const MembersContext = createContext();

export function MembersProvider({ children }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    if (!user) {
      setMembers([]);
      setLoadingMembers(false);
      return;
    }

    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'members'),
      (snapshot) => {
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMembers(fetched);
        setLoadingMembers(false);
      },
      (error) => {
        console.error("Members fetch error:", error);
        setLoadingMembers(false);
      }
    );

    return () => unsub();
  }, [user]);

  return (
    <MembersContext.Provider value={{ members, loadingMembers }}>
      {children}
    </MembersContext.Provider>
  );
}

export const useMembers = () => useContext(MembersContext);
