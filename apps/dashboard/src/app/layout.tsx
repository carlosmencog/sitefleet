import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = { title: 'SiteFleet', description: 'Website fleet operations dashboard' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
