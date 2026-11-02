import React from 'react';
import { Link } from 'react-router';
import { Wordmark } from './Navbar';

/** Simple centred layout for the account pages reached from emails */
export const AuthShell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-h-screen bg-paper flex flex-col px-6 sm:px-10 py-8">
    <Link to="/dashboard" className="self-start rounded-md">
      <Wordmark />
    </Link>
    <main className="flex-1 flex items-center">
      <div className="w-full max-w-sm mx-auto py-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
    </main>
  </div>
);
