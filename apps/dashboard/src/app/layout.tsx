import type { Metadata } from 'next';
import './styles.css';
import './views.css';
import './brand.css';

export const metadata: Metadata = { title: 'SiteFleet', description: 'Website fleet operations dashboard', icons: { icon: '/brand/sitefleet-favicon.svg' } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
