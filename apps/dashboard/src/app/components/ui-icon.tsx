type IconName = 'activity' | 'alert' | 'arrow' | 'arrow-left' | 'globe' | 'grid' | 'layers' | 'pulse' | 'settings' | 'shield' | 'wordpress';

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const shared = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'grid') return <svg {...shared}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>;
  if (name === 'globe') return <svg {...shared}><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c2.2 2.2 3.3 4.9 3.3 8S14.2 17.8 12 20c-2.2-2.2-3.3-4.9-3.3-8S9.8 6.2 12 4Z" /></svg>;
  if (name === 'alert') return <svg {...shared}><path d="m12 4 8 15H4L12 4Z" /><path d="M12 9v4m0 3h.01" /></svg>;
  if (name === 'activity') return <svg {...shared}><path d="M4 12h3l2-5 4 10 2-5h5" /></svg>;
  if (name === 'pulse') return <svg {...shared}><path d="M3 12h4l2.2-6 4.1 12 2.2-6H21" /></svg>;
  if (name === 'shield') return <svg {...shared}><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (name === 'layers') return <svg {...shared}><path d="m12 4 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4M4 16l8 4 8-4" /></svg>;
  if (name === 'settings') return <svg {...shared}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.2 2.2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.2v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.2-2.2.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5v-3.2h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.2-2.2.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h3.2v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.2 2.2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1Z" /></svg>;
  if (name === 'arrow-left') return <svg {...shared}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
  if (name === 'arrow') return <svg {...shared}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  return <svg {...shared}><path d="M5 5h14v14H5z" /><path d="M8 8h8v8H8z" /></svg>;
}
