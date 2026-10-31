import { Link } from '@remix-run/react';
import { BITTENSOR_QUEST_URL, TENSORSCAN_URL } from './links';
import { StudioMark } from '~/components/studio/StudioShell';

const groups = [
  {
    title: 'Product',
    links: [
      ['Playground', '/playground'],
      ['Subnet builder', '/editor'],
      ['Subnet setup', '/subcreate'],
    ],
  },
  {
    title: 'Network',
    links: [
      ['Nodes', '/nodes'],
      ['TensorScan', TENSORSCAN_URL],
      ['Dashboard', '/dashboard'],
    ],
  },
  {
    title: 'Resources',
    links: [
      ['Bittensor Quest', BITTENSOR_QUEST_URL],
      ['Workspace overview', '#modules'],
      ['How it works', '#how-it-works'],
      ['Questions & answers', '#faq'],
    ],
  },
  {
    title: 'Get started',
    links: [
      ['Explore an idea', '/playground'],
      ['Open your wallet', '/wallet'],
      ['Runner console', '/runner'],
    ],
  },
];
export function LandingFooter() {
  return (
    <footer className="ts-directory-footer">
      <div className="ts-footer-directory">
        <div className="ts-footer-identity">
          <Link to="/" className="ts-brand" aria-label="TensorStudio home">
            <StudioMark />
            <span>
              Tensor<span>Studio</span>
            </span>
          </Link>
          <p>
            © 2026 TensorStudio.
            <br />A place for your next network.
          </p>
          <p>Built by Somesh Talligeri.</p>
          <a
            className="ts-footer-docs"
            href="https://www.bittensor.com/docs/quickstart"
            target="_blank"
            rel="noreferrer"
          >
            Built for Bittensor <span aria-hidden="true">↗</span>
          </a>
        </div>
        {groups.map((group) => (
          <nav key={group.title} aria-label={`Footer ${group.title.toLowerCase()}`}>
            <h2>{group.title}</h2>
            {group.links.map(([label, to]) =>
              to.startsWith('#') || to.startsWith('https://') ? (
                <a
                  key={label}
                  href={to}
                  target={to.startsWith('https://') ? '_blank' : undefined}
                  rel={to.startsWith('https://') ? 'noopener noreferrer' : undefined}
                >
                  {label}
                </a>
              ) : (
                <Link key={label} to={to}>
                  {label}
                </Link>
              ),
            )}
          </nav>
        ))}
      </div>
      <div className="ts-footer-watermark" aria-hidden="true">
        TensorStudio
      </div>
      <div className="ts-footer-baseline">
        <span>Built for open intelligence.</span>
        <a href="#landing-main">Back to top ↑</a>
      </div>
    </footer>
  );
}
