/**
 * The HackTrack site the app opens. Set HACKTRACK_URL when syncing or building, e.g.
 *   HACKTRACK_URL=https://hacktrack.onrender.com npm run android:build
 * The default reaches `npm run dev` on the computer running the Android emulator (10.0.2.2 is its localhost).
 */
export const serverUrl = (process.env.HACKTRACK_URL || 'http://10.0.2.2:5173').replace(/\/$/, '');

/** True when no address was given, so the app only works in the Android emulator */
export const emulatorOnly = !process.env.HACKTRACK_URL;
