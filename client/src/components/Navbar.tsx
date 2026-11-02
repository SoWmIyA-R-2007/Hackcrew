import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Bell, LogOut, User } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router';
import { api, type CurrentUser } from '@/lib/api';
import { AppNotification } from '@/lib/types';
import { getInitials } from '@/lib/utils';
import { NotificationDrawer } from './NotificationDrawer';

interface NavbarProps {
  onAddHackathon?: () => void;
  // Search is only shown on pages that can filter
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

/** Three staggered bars — the timeline motif used across the app */
export const Wordmark: React.FC<{ className?: string; compact?: boolean }> = ({ className = '', compact = false }) => (
  <span className={`inline-flex items-center gap-2 ${className}`}>
    <svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true">
      <rect x="0" y="1" width="12" height="4" rx="2" className="fill-accent" />
      <rect x="5" y="7" width="15" height="4" rx="2" className="fill-ink" />
      <rect x="2" y="13" width="9" height="4" rx="2" className="fill-ink-3" />
    </svg>
    <span className={`font-display font-semibold text-lg tracking-tight text-ink ${compact ? 'sr-only sm:not-sr-only' : ''}`}>
      HackTrack
    </span>
  </span>
);

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Hackathons' },
  { to: '/projects', label: 'Projects' },
  { to: '/tasks', label: 'My tasks' },
  { to: '/stats', label: 'Stats' },
  { to: '/friends', label: 'Friends' },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 h-8 inline-flex items-center rounded-lg text-sm whitespace-nowrap transition-colors ${
    isActive ? 'bg-sunken text-ink font-medium' : 'text-ink-2 hover:text-ink hover:bg-sunken'
  }`;

export const Navbar: React.FC<NavbarProps> = ({ onAddHackathon, searchQuery, onSearchChange }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [verifySent, setVerifySent] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const loadNotifications = useCallback(
    () =>
      api
        .notifications()
        .then(setNotifications)
        .catch(() => {
          // Notifications are optional; the rest of the page still works
        }),
    []
  );

  useEffect(() => {
    const loadUser = () =>
      api
        .me()
        .then(setUser)
        .catch(() => {
          // Not signed in; the API redirects to /login when it matters
        });
    loadUser();
    loadNotifications();
    // Deadlines move into the "due soon" window over time, so check again every few minutes
    const timer = setInterval(loadNotifications, 5 * 60 * 1000);
    window.addEventListener('profile-updated', loadUser);
    window.addEventListener('hackathons-changed', loadNotifications);
    return () => {
      clearInterval(timer);
      window.removeEventListener('profile-updated', loadUser);
      window.removeEventListener('hackathons-changed', loadNotifications);
    };
  }, [loadNotifications]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const handleSignOut = async () => {
    try {
      await api.logout();
    } catch {
      // Ignored: the session cookie is cleared server-side either way
    }
    navigate('/login');
  };

  // Leaving a demo goes straight to the sign-up form
  const handleLeaveDemo = async () => {
    try {
      await api.logout();
    } catch {
      // Ignored
    }
    navigate('/login?mode=signup');
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    try {
      await api.markNotificationsRead();
    } catch {
      loadNotifications();
    }
  };

  const handleResendVerification = async () => {
    setVerifySent('sending');
    try {
      await api.resendVerification();
      setVerifySent('sent');
    } catch {
      setVerifySent('failed');
    }
  };

  const needsVerification = user && !user.isDemo && !user.emailVerified;

  return (
    <>
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur border-b border-rule">
        <div className="max-w-6xl mx-auto h-16 px-4 sm:px-6 flex items-center gap-3 sm:gap-5">
          <Link to="/dashboard" className="shrink-0 rounded-md">
            <Wordmark compact={Boolean(onSearchChange)} />
          </Link>

          <nav aria-label="Main" className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass} end={item.to !== '/projects'}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {onSearchChange ? (
            <label className="flex-1 max-w-sm flex items-center gap-2 bg-surface border border-rule rounded-lg px-3 h-9 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft transition">
              <Search className="w-4 h-4 text-ink-3 shrink-0" aria-hidden="true" />
              <span className="sr-only">Search hackathons</span>
              <input
                type="search"
                value={searchQuery ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search by name, team or track"
                className="bg-transparent w-full text-sm text-ink placeholder:text-ink-3 focus:outline-none"
              />
            </label>
          ) : (
            <div className="flex-1" />
          )}
          {onSearchChange && <div className="flex-1 hidden lg:block" />}

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={() => {
                setDrawerOpen(true);
                loadNotifications();
              }}
              className="icon-btn relative"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-danger text-[10px] font-semibold leading-4 text-white text-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {onAddHackathon && (
              <button onClick={onAddHackathon} className="btn btn-primary">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add hackathon</span>
              </button>
            )}

            <div className="flex items-center gap-1 sm:pl-3 sm:ml-1 sm:border-l border-rule">
              <Link
                to="/profile"
                className="flex w-8 h-8 rounded-full bg-sunken text-ink-2 text-xs font-semibold items-center justify-center hover:bg-accent-soft hover:text-accent transition-colors"
                title={user?.username ? `Your profile (@${user.username})` : 'Your profile'}
                aria-label="Your profile"
              >
                {user ? getInitials(user.name || user.email) : <User className="w-4 h-4" />}
              </Link>
              <button onClick={handleSignOut} className="icon-btn" aria-label="Sign out" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* On small screens the main links get their own row */}
        <nav aria-label="Main" className="md:hidden border-t border-rule">
          <div className="max-w-6xl mx-auto px-4 py-1.5 flex gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass} end={item.to !== '/projects'}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {user?.isDemo && (
          <div className="bg-highlight text-highlight-ink border-t border-rule">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
              <p>
                <span className="font-semibold">You are using a demo account.</span> Feel free to change anything;
                it is deleted after 24 hours.
              </p>
              <button onClick={handleLeaveDemo} className="font-semibold underline underline-offset-2 cursor-pointer">
                Create your own account
              </button>
            </div>
          </div>
        )}

        {needsVerification && (
          <div className="bg-accent-soft text-ink border-t border-rule">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
              <p>
                <span className="font-semibold">Confirm your email address.</span> We sent a link to {user.email} so
                you can reset your password if you ever forget it.
              </p>
              {verifySent === 'sent' ? (
                <span className="font-medium">New link sent. Check your inbox.</span>
              ) : verifySent === 'failed' ? (
                <span className="font-medium">A link was sent recently. Try again in an hour.</span>
              ) : (
                <button
                  onClick={handleResendVerification}
                  disabled={verifySent === 'sending'}
                  className="font-semibold underline underline-offset-2 cursor-pointer"
                >
                  {verifySent === 'sending' ? 'Sending…' : 'Send the link again'}
                </button>
              )}
            </div>
          </div>
        )}

      </header>

      {/* Outside the header: its backdrop blur would otherwise confine the fixed drawer to the header's box */}
      <NotificationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        canEmail={Boolean(user && !user.isDemo)}
      />
    </>
  );
};
