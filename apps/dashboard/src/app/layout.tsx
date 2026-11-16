import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './styles.css';
import './views.css';
import './brand.css';
import './typography.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans'
});

export const metadata: Metadata = { title: 'SiteFleet', description: 'Website fleet operations dashboard', icons: { icon: '/brand/sitefleet-favicon.svg' } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={dmSans.variable}>{children}</body></html>;
}
