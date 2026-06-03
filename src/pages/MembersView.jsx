import React from 'react';
import { useMembers } from '../context/MembersContext';
import { DEFAULT_AVATAR } from '../utils/helpers';

export default function MembersView() {
  const { members, loadingMembers } = useMembers();

  if (loadingMembers) return <div className="text-zinc-500 text-center py-12">Loading members...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-6 border-b border-zinc-800 pb-2">Members Directory</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {members.filter(m => !m.isHidden).map(member => (
          <div 
            key={member.id} 
            className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 hover:border-pink-500 transition-all cursor-pointer flex items-center gap-4"
          >
            <img src={member.avatar || DEFAULT_AVATAR} alt={member.name} className="w-16 h-16 rounded-full object-cover" />
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">
                {member.name || 'Pending Setup'}
              </h3>
              {member.nickname && <p className="text-zinc-500 text-xs italic">"{member.nickname}"</p>}
              <p className="text-pink-500 text-xs font-semibold uppercase tracking-wider mt-1">{member.role || 'Member'}</p>
            </div>
          </div>
        ))}
        {members.length === 0 && <div className="col-span-full py-12 text-center text-zinc-500">No members found.</div>}
      </div>
    </div>
  );
}
