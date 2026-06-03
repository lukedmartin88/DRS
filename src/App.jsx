import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MembersProvider } from './context/MembersContext';
import { EventsProvider } from './context/EventsContext';
import AppRoutes from './routes/AppRoutes';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MembersProvider>
          <EventsProvider>
            <AppRoutes />
          </EventsProvider>
        </MembersProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
