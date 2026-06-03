import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import Layout from '../components/Layout';

// Lazy load pages for better performance
const SplashView = lazy(() => import('../pages/SplashView'));
const HomeView = lazy(() => import('../pages/HomeView'));
const EventsView = lazy(() => import('../pages/EventsView'));
const MembersView = lazy(() => import('../pages/MembersView'));
const ProfileView = lazy(() => import('../pages/ProfileView'));
const RafflesView = lazy(() => import('../pages/RafflesView'));
const AdminView = lazy(() => import('../pages/AdminView'));

const LoadingFallback = () => (
  <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-sm">
    <div className="relative w-20 h-20 mb-4">
      <div className="absolute inset-0 rounded-full border-4 border-zinc-800"></div>
      <div className="absolute inset-0 rounded-full border-4 border-pink-500 border-t-transparent animate-spin"></div>
    </div>
    Loading Module...
  </div>
);

export default function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Splash screen has no Layout wrapper so it takes up the full screen */}
        <Route path="/" element={<SplashView />} />
        
        {/* All protected routes sit inside the Layout component */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/home" element={<HomeView />} />
          <Route path="/events" element={<EventsView />} />
          <Route path="/members" element={<MembersView />} />
          <Route path="/profile" element={<ProfileView />} />
          <Route path="/raffles" element={<RafflesView />} />
          <Route path="/admin" element={<AdminView />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
