import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Calendar, Users, Ticket, UserCircle, LogOut, Menu, X, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMembers } from '../context/MembersContext';

export default function Layout() {
  const { logout, user } = useAuth();
  const { members } = useMembers();
  const navigate = useNavigate();
  const location = useLocation();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const currentUserProfile = members.find(m => m.id === user?.uid);
  const isAdmin = currentUserProfile?.role === 'Admin';

  const navItems = [
    { path: '/home', icon: Home, label: 'Home' },
    { path: '/events', icon: Calendar, label: 'Events' },
    { path: '/members', icon: Users, label: 'Members' },
    { path: '/raffles', icon: Ticket, label: 'Raffles' },
  ];

  const handleNavigate = (path) => {
    navigate(path);
    setShowMobileMenu(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto w-full">
          <h1 
            onClick={() => handleNavigate('/home')}
            className="text-xl font-black uppercase tracking-tighter italic cursor-pointer"
          >
            Daily Ride <span className="text-pink-600 not-italic">South</span>
          </h1>
          
          <div className="flex items-center gap-4">
            <button onClick={() => handleNavigate('/profile')} className="text-zinc-400 hover:text-white transition-colors">
              <UserCircle className="w-6 h-6" />
            </button>
            <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="md:hidden text-zinc-400 hover:text-white transition-colors">
              {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <button onClick={handleLogout} className="hidden md:flex text-zinc-400 hover:text-white transition-colors items-center gap-2 text-xs font-bold uppercase tracking-widest">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-30 top-[65px] bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 p-4 flex flex-col gap-2">
          {navItems.map(item => (
            <button 
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className={`flex items-center gap-4 p-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all ${location.pathname === item.path ? 'bg-pink-600 text-white' : 'bg-zinc-900 text-zinc-400'}`}
            >
              <item.icon className="w-5 h-5" /> {item.label}
            </button>
          ))}
          {isAdmin && (
            <button 
              onClick={() => handleNavigate('/admin')}
              className={`flex items-center gap-4 p-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all ${location.pathname === '/admin' ? 'bg-pink-600 text-white' : 'bg-zinc-900 text-zinc-400'}`}
            >
              <Shield className="w-5 h-5" /> Admin Panel
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="flex items-center gap-4 p-4 rounded-xl font-bold uppercase tracking-widest text-sm bg-zinc-900 text-red-500 mt-auto mb-20"
          >
            <LogOut className="w-5 h-5" /> Log Out
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl mx-auto w-full p-4 pb-28 md:pb-8">
        <Outlet />
      </main>

      {/* Desktop Navigation */}
      <nav className="hidden md:flex fixed bottom-0 w-full bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 justify-center p-4 gap-8 z-40">
        {navItems.map(item => (
          <button 
            key={item.path}
            onClick={() => handleNavigate(item.path)}
            className={`flex flex-col items-center gap-1 transition-colors ${location.pathname === item.path ? 'text-pink-500' : 'text-zinc-500 hover:text-white'}`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
        {isAdmin && (
           <button 
           onClick={() => handleNavigate('/admin')}
           className={`flex flex-col items-center gap-1 transition-colors ${location.pathname === '/admin' ? 'text-pink-500' : 'text-zinc-500 hover:text-white'}`}
         >
           <Shield className="w-6 h-6" />
           <span className="text-[10px] font-bold uppercase tracking-widest">Admin</span>
         </button>
        )}
      </nav>
      
      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 w-full bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 flex justify-around p-3 pb-safe z-40">
         {navItems.map(item => (
          <button 
            key={item.path}
            onClick={() => handleNavigate(item.path)}
            className={`flex flex-col items-center gap-1 transition-colors p-2 ${location.pathname === item.path ? 'text-pink-500' : 'text-zinc-500'}`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[8px] font-bold uppercase tracking-wider mt-1">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
