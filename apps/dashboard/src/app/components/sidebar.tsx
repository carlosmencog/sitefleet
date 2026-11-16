import Link from 'next/link';
import { Icon } from './ui-icon';

type Section = 'overview' | 'sites' | 'alerts';

export function Sidebar({ active }: { active: Section }) {
  return <aside className="sidebar">
    <Link className="brand" href="/" aria-label="SiteFleet overview"><span className="brand-mark" aria-hidden="true"><Icon name="pulse" size={19} /></span><strong>SiteFleet</strong></Link>
    <nav className="sidebar-nav" aria-label="Primary navigation">
      <Link className={`nav-item ${active === 'overview' ? 'active' : ''}`} href="/"><Icon name="grid" />Overview</Link>
      <Link className={`nav-item ${active === 'sites' ? 'active' : ''}`} href="/sites"><Icon name="globe" />Sites</Link>
      <Link className={`nav-item ${active === 'alerts' ? 'active' : ''}`} href="/alerts"><Icon name="alert" />Alerts</Link>
    </nav>
    <div className="sidebar-footer"><span className="status-indicator" aria-hidden="true" />Fleet is reporting</div>
  </aside>;
}
