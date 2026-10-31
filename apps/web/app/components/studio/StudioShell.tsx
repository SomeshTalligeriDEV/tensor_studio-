import { NavLink, useLocation } from '@remix-run/react';
import { useEffect, useState, type ReactNode } from 'react';
import { toggleTheme } from '~/lib/stores/theme';
import { RunnerStatus } from './RunnerStatus';
import { ModelSettings } from './ModelSettings';
import { BITTENSOR_QUEST_URL } from '../landing/links';

const routes = [
  ['/', 'Overview', 'i-ph:squares-four'],
  ['/editor', 'Subnet builder', 'i-ph:code'],
  ['/subcreate', 'Subnet setup', 'i-ph:graph'],
  ['/nodes', 'Nodes', 'i-ph:cpu'],
  ['/dashboard', 'Dashboard', 'i-ph:chart-line'],
  ['/scan', 'TensorScan', 'i-ph:magnifying-glass'],
  ['/playground', 'Playground', 'i-ph:flask'],
  ['/wallet', 'Wallet', 'i-ph:wallet'],
  ['/runner', 'Console', 'i-ph:terminal-window'],
];

export function StudioMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M4 7h20M14 7v13c0 3 3 4 6 2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StudioShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const home = location.pathname === '/';
  const [panel, setPanel] = useState<'docs' | 'settings' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const title = location.pathname === '/owner' ? 'Owner workspace' : location.pathname === '/harness' ? 'Evaluation report' : location.pathname.startsWith('/dashboard') ? 'Subnet dashboard' : location.pathname.startsWith('/scan') ? 'TensorScan' : routes.find(([path]) => path === location.pathname)?.[1] || 'Subnet builder';
  useEffect(() => {
    setMenuOpen(false);
    setPanel(null);
  }, [location.pathname]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanel(null);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  if (home) return <>{children}</>;
  return (
    <div className={`studio-shell ${home ? 'studio-shell--home' : ''} ${menuOpen ? 'studio-shell--menu' : ''}`}>
      <a href="#studio-main" className="studio-skip">
        Skip to workspace
      </a>
      <aside className="studio-nav" aria-label="Studio navigation">
        <NavLink to="/" className="studio-brand">
          <StudioMark />
          <span>
            Tensor<em>Studio</em>
          </span>
          <small>BETA</small>
        </NavLink>
        <NavLink to="/editor" className="studio-new">
          <span className="i-ph:plus" /> New project <span className="studio-arrow">↗</span>
        </NavLink>
        <p className="studio-nav-caption">WORKSPACE</p>
        <nav>
          {routes.map(([path, label, icon]) => (
            <NavLink key={path} to={path} end={path === '/'}>
              <span className={icon} />
              {label}
            </NavLink>
          ))}
          <a href={BITTENSOR_QUEST_URL} target="_blank" rel="noopener noreferrer" className="studio-quest-link">
            <span className="i-ph:game-controller" aria-hidden="true" />
            Bittensor Quest <span className="studio-arrow" aria-hidden="true">↗</span>
          </a>
        </nav>
        <div className="studio-nav-bottom">
          <div className="studio-local">
            <span className="i-ph:desktop" />
            <div>
              Local workspace<small>Build tools for Bittensor</small>
            </div>
          </div>
          <button
            onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
            aria-expanded={panel === 'settings'}
          >
            <span className="i-ph:sliders-horizontal" /> Model settings
          </button>
          <button onClick={() => setPanel(panel === 'docs' ? null : 'docs')} aria-expanded={panel === 'docs'}>
            <span className="i-ph:book-open" /> Documentation <span className="studio-arrow">↗</span>
          </button>
        </div>
      </aside>
      <div className="studio-main-column">
        <header className="studio-topbar">
          {home ? (
            <NavLink to="/" className="studio-brand">
              <StudioMark />
              <span>
                Tensor<em>Studio</em>
              </span>
              <small>BETA</small>
            </NavLink>
          ) : (
            <div className="studio-breadcrumb">
              <button
                className="studio-menu-toggle"
                aria-label="Toggle navigation"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <span className="i-ph:list" />
              </button>
              <NavLink to="/">TensorStudio</NavLink>
              <span>/</span>
              <strong>{title}</strong>
            </div>
          )}
          {home && (
            <nav className="studio-top-links" aria-label="Quick navigation">
              <NavLink to="/editor">Build</NavLink>
              <NavLink to="/nodes">Nodes</NavLink>
              <NavLink to="/scan">BScan</NavLink>
              <button onClick={() => setPanel(panel === 'docs' ? null : 'docs')}>Docs ↗</button>
            </nav>
          )}
          <div className="studio-top-actions">
            <button className="studio-settings-button" onClick={toggleTheme} aria-label="Toggle light and dark theme"><span className="i-ph:sun-dim" /></button>
            <button
              className="studio-settings-button"
              onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
              aria-label="Open model settings"
              aria-expanded={panel === 'settings'}
            >
              <span className="i-ph:sliders-horizontal" />
            </button>
            <NavLink to="/wallet" className="studio-wallet-link">
              <span className="i-ph:wallet" /> Wallet
            </NavLink>
            {home && (
              <NavLink to="/editor" className="studio-primary-link">
                Open studio <span>↗</span>
              </NavLink>
            )}
          </div>
        </header>
        <div id="studio-main" className="studio-workspace">
          {children}
        </div>
        <footer className="studio-status" aria-label="Workspace status">
          <RunnerStatus />
          <span className="studio-status-network">{(location.pathname === '/explorer' || location.pathname.startsWith('/scan')) ? 'BScan · read-only' : 'Built for Bittensor'}</span>
        </footer>
      </div>
      {menuOpen && (
        <button className="studio-menu-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
      )}
      {panel && (
        <aside className="studio-docs" aria-label={panel === 'docs' ? 'Bittensor documentation' : 'AI settings'}>
          <div className="studio-panel-heading">
            <h2>{panel === 'docs' ? 'Documentation' : 'Model settings'}</h2>
            <button aria-label="Close panel" onClick={() => setPanel(null)}>
              ×
            </button>
          </div>
          {panel === 'settings' ? (
            <>
              <p>Choose the configured model for your next build.</p>
              <ModelSettings />
            </>
          ) : (
            <>
              <p>Build with the Bittensor SDK. Official guides for your next step.</p>
              <a href="https://www.bittensor.com/docs/quickstart" target="_blank" rel="noreferrer">
                SDK quickstart ↗
              </a>
              <a href="https://www.bittensor.com/docs/migration" target="_blank" rel="noreferrer">
                SDK v11 migration ↗
              </a>
              <a href="https://www.bittensor.com/docs/guides/subnets" target="_blank" rel="noreferrer">
                Running a subnet ↗
              </a>
              <a href="https://www.bittensor.com/docs/guides/signed-requests" target="_blank" rel="noreferrer">
                Signed miner requests ↗
              </a>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
