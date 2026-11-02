import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AppNotification, NotificationKind } from '@/lib/types';
import { api } from '@/lib/api';
import { X, AlertTriangle, Users, CalendarClock, Send } from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  // Demo accounts cannot send email
  canEmail: boolean;
}

const KIND_ICON: Record<NotificationKind, { icon: React.ElementType; tone: string }> = {
  urgent: { icon: AlertTriangle, tone: 'bg-danger-soft text-danger' },
  team: { icon: Users, tone: 'bg-accent-soft text-accent' },
  system: { icon: CalendarClock, tone: 'bg-sunken text-ink-2' },
};

/** "Today", "Yesterday" or "Earlier" in the viewer's own time zone */
function groupOf(iso: string) {
  const day = new Date(iso);
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(day)) / (24 * 60 * 60 * 1000));
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : 'Earlier';
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  return groupOf(iso) === 'Earlier'
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  canEmail,
}) => {
  const [emailState, setEmailState] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const groups = (['Today', 'Yesterday', 'Earlier'] as const)
    .map((label) => ({ label, items: notifications.filter((n) => groupOf(n.time) === label) }))
    .filter((g) => g.items.length > 0);
  const unread = notifications.filter((n) => n.unread).length;

  const emailTeam = async (n: AppNotification) => {
    if (!n.hackathonId) return;
    setEmailState((s) => ({ ...s, [n.id]: 'Sending…' }));
    try {
      const { sent } = await api.emailTeam(n.hackathonId, '');
      setEmailState((s) => ({ ...s, [n.id]: `Sent to ${sent} ${sent === 1 ? 'person' : 'people'}` }));
    } catch (err) {
      setEmailState((s) => ({ ...s, [n.id]: err instanceof Error ? err.message : 'Could not send' }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-scrim cursor-default" aria-label="Close notifications" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-heading"
        className="relative bg-paper border-l border-rule w-full max-w-md h-full flex flex-col animate-slide-in-right"
      >
        <div className="flex items-center justify-between gap-3 px-5 h-16 border-b border-rule shrink-0">
          <h2 id="notifications-heading" className="font-display text-lg font-semibold">
            Notifications
          </h2>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button onClick={onMarkAllRead} className="btn btn-ghost text-sm">
                Mark all as read
              </button>
            )}
            <button onClick={onClose} className="icon-btn" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {groups.length === 0 && (
            <p className="text-sm text-ink-2 text-center py-12">
              You are all caught up. Upcoming deadlines, your tasks and cards that are due, milestones, teammates
              joining, friend requests and team invites will show up here.
            </p>
          )}

          {groups.map((group) => (
            <section key={group.label}>
              <h3 className="text-sm font-medium text-ink-3 mb-2">{group.label}</h3>
              <ul className="bg-surface border border-rule rounded-xl divide-y divide-rule">
                {group.items.map((n) => {
                  const { icon: Icon, tone } = KIND_ICON[n.kind];
                  return (
                    <li key={n.id} className="flex gap-3 p-4">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className={`text-sm ${n.unread ? 'font-semibold text-ink' : 'font-medium text-ink-2'}`}>
                            {n.title}
                          </p>
                          <span className="text-xs text-ink-3 shrink-0 mt-0.5">{timeLabel(n.time)}</span>
                        </div>
                        <p className="text-sm text-ink-2 mt-1">{n.description}</p>
                        {n.link && !n.hackathonId && (
                          <div className="mt-3">
                            <Link to={n.link} onClick={onClose} className="btn btn-secondary text-sm py-1">
                              {n.link === '/friends' ? 'Open Friends' : n.link.startsWith('/projects/') ? 'Open project' : 'Open'}
                            </Link>
                          </div>
                        )}
                        {n.hackathonId && (
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <Link
                              to={`/dashboard/hackathons/${n.hackathonId}`}
                              onClick={onClose}
                              className="btn btn-secondary text-sm py-1"
                            >
                              Open hackathon
                            </Link>
                            {n.kind === 'urgent' && canEmail && !emailState[n.id] && (
                              <button onClick={() => emailTeam(n)} className="btn btn-secondary text-sm py-1">
                                <Send className="w-3.5 h-3.5" />
                                Email the team
                              </button>
                            )}
                            {emailState[n.id] && <span className="text-xs text-ink-2">{emailState[n.id]}</span>}
                          </div>
                        )}
                      </div>
                      {n.unread && <span className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" aria-label="Unread" />}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
};
