import { useEffect, useState } from 'react';
import { Link } from '@remix-run/react';
export function LandingInstruments() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  return <section className="ts-instruments" aria-label="Your workbench tools">
    <div className="ts-instrument"><div className="ts-instrument-bar"><span className="i-ph:clock" aria-hidden="true" /> Local time</div><div className="ts-instrument-body"><p>{now ? now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Your next build starts here'}</p><time dateTime={now?.toISOString()}>{now ? now.toLocaleTimeString(undefined, { hour12: false }) : '— : — : —'}</time></div></div>
    <Link to="/nodes" className="ts-instrument"><div className="ts-instrument-bar"><span className="i-ph:terminal-window" aria-hidden="true" /> Node tools <span aria-hidden="true">↗</span></div><div className="ts-instrument-body"><strong>Miners & validators</strong><p>Local processes. Logs. One place.</p><small>Open node manager</small></div></Link>
    <Link to="/wallet" className="ts-instrument"><div className="ts-instrument-bar"><span className="i-ph:shield-check" aria-hidden="true" /> Your workspace <span aria-hidden="true">↗</span></div><div className="ts-instrument-body"><strong>Your keys stay yours.</strong><p>Personal wallet encrypted in-browser.</p><small>Explore wallet tools</small></div></Link>
  </section>;
}
