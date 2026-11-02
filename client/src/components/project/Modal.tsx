import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'md' | 'lg';
}

/** Dialog shell shared by the project forms: scrim, title bar, Escape to close */
export const Modal: React.FC<Props> = ({ title, onClose, children, size = 'md' }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <button className="fixed inset-0 bg-scrim cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
        className={`relative bg-paper border border-rule rounded-2xl w-full ${size === 'lg' ? 'max-w-2xl' : 'max-w-lg'} my-auto animate-rise shadow-2xl shadow-ink/20`}
      >
        <div className="flex items-center justify-between gap-3 px-6 h-16 border-b border-rule">
          <h2 id="modal-heading" className="font-display text-xl font-semibold truncate">
            {title}
          </h2>
          <button onClick={onClose} className="icon-btn shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
