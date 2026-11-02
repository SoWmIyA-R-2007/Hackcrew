import React, { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { applyUpdate, canPromptInstall, isInstalled, isIos, promptInstall, updateReady } from '@/lib/pwa';
import { Modal } from './project/Modal';

/** "Install app" in the header: the browser's install dialog, or Add to Home Screen steps on iPhone and iPad */
export const InstallButton: React.FC = () => {
  const [installable, setInstallable] = useState(() => canPromptInstall());
  const [showIosSteps, setShowIosSteps] = useState(false);
  const iosHint = isIos() && !isInstalled();

  useEffect(() => {
    const onChange = () => setInstallable(canPromptInstall());
    window.addEventListener('pwa-install-changed', onChange);
    return () => window.removeEventListener('pwa-install-changed', onChange);
  }, []);

  if (isInstalled() || (!installable && !iosHint)) return null;
  return (
    <>
      <button
        onClick={() => (installable ? promptInstall() : setShowIosSteps(true))}
        className="icon-btn lg:w-auto lg:px-2.5 lg:gap-1.5 text-sm"
        aria-label="Install the Hackcrew app"
        title="Install the Hackcrew app"
      >
        <Download className="w-[18px] h-[18px]" />
        <span className="hidden lg:inline">Install app</span>
      </button>
      {showIosSteps && (
        <Modal title="Install Hackcrew" onClose={() => setShowIosSteps(false)}>
          <div className="px-6 py-6 space-y-4 text-sm text-ink-2">
            <p>Add Hackcrew to your home screen to open it like an app, full screen and one tap away.</p>
            <ol className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-sunken flex items-center justify-center shrink-0">
                  <Share className="w-4 h-4 text-accent" aria-hidden="true" />
                </span>
                <span>
                  Tap <span className="font-medium text-ink">Share</span> in Safari's toolbar.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-sunken flex items-center justify-center shrink-0">
                  <SquarePlus className="w-4 h-4 text-accent" aria-hidden="true" />
                </span>
                <span>
                  Choose <span className="font-medium text-ink">Add to Home Screen</span>, then{' '}
                  <span className="font-medium text-ink">Add</span>.
                </span>
              </li>
            </ol>
            <button onClick={() => setShowIosSteps(false)} className="btn btn-primary w-full">
              Got it
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};

/** A small notice when a new version has been downloaded, so people choose when to reload */
export const UpdateNotice: React.FC = () => {
  const [ready, setReady] = useState(() => updateReady());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onReady = () => setReady(true);
    window.addEventListener('pwa-update-ready', onReady);
    return () => window.removeEventListener('pwa-update-ready', onReady);
  }, []);

  if (!ready || dismissed) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 z-[70] bg-surface border border-rule rounded-2xl shadow-2xl shadow-ink/20 px-5 py-4 flex items-start gap-3 animate-rise"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">A new version of Hackcrew is ready</p>
        <p className="text-sm text-ink-2 mt-0.5">Reload to get the latest changes. Anything you saved is kept.</p>
        <button onClick={applyUpdate} className="btn btn-primary text-sm py-1.5 mt-3">
          Reload now
        </button>
      </div>
      <button onClick={() => setDismissed(true)} className="icon-btn w-8 h-8 shrink-0" aria-label="Later">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
