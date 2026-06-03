export const getOrdinalSuffix = (d) => {
  if (d > 3 && d < 21) return 'th';
  switch (d % 10) {
    case 1:  return "st";
    case 2:  return "nd";
    case 3:  return "rd";
    default: return "th";
  }
};

export const formatDate = (date) => {
  const d = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'long' });
  const year = date.getFullYear();
  return `${d}${getOrdinalSuffix(d)} ${month} ${year}`;
};

export const parseEventDateStr = (dateStr) => {
  if (!dateStr) return new Date(9999, 0, 1);
  let cleanStr = dateStr.replace(/^[A-Za-z]+,\s*/, '').replace(/(\d+)(st|nd|rd|th)/, '$1');
  if (cleanStr.includes('/')) {
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const dateObj = new Date(y, m, d);
      if (!isNaN(dateObj.getTime())) return dateObj;
    }
  }
  const parsed = Date.parse(cleanStr);
  return isNaN(parsed) ? new Date(9999, 0, 1) : new Date(parsed);
};

export const DEFAULT_AVATAR = "[https://i.ibb.co/RTHHJ3JW/PROFILE-PIC.png](https://i.ibb.co/RTHHJ3JW/PROFILE-PIC.png)";
export const DEFAULT_CAR = "[https://images.unsplash.com/photo-1502877338535-494e509f583b?auto=format&fit=crop&q=80&w=800](https://images.unsplash.com/photo-1502877338535-494e509f583b?auto=format&fit=crop&q=80&w=800)";

export const parseRaffleReservations = (raffle, cloudMembers) => {
  const appRes = { ...(raffle.reservations || {}) };
  const offRes = { ...(raffle.offlineReservations || {}) };

  Object.keys(raffle).forEach(key => {
    if (key.startsWith('offlineReservations.')) offRes[key.replace('offlineReservations.', '')] = raffle[key];
    if (key.startsWith('reservations.')) appRes[key.replace('reservations.', '')] = raffle[key];
  });

  const membersById = cloudMembers.reduce((acc, m) => { acc[m.id] = m; return acc; }, {});
  const list = [];

  Object.keys(appRes).forEach(uid => {
    const m = membersById[uid] || { name: 'Pending Setup', avatar: DEFAULT_AVATAR };
    list.push({ id: uid, name: m.name || m.email || 'Pending Setup', avatar: m.avatar || DEFAULT_AVATAR, ticketCount: appRes[uid], type: 'app' });
  });

  Object.keys(offRes).forEach(gid => {
    const record = offRes[gid];
    const safeCount = typeof record === 'object' ? record.count : parseInt(record) || 0;
    const safeName = typeof record === 'object' ? record.name : 'Guest Participant';
    list.push({ id: gid, name: safeName, avatar: DEFAULT_AVATAR, ticketCount: safeCount, type: 'offline' });
  });

  list.sort((a, b) => a.name.localeCompare(b.name) !== 0 ? a.name.localeCompare(b.name) : a.id.localeCompare(b.id));
  return list;
};
