import type { MetaFunction } from '@remix-run/cloudflare';
import { Link, useNavigate } from '@remix-run/react';
import { useState } from 'react';
import { StudioMark } from '~/components/studio/StudioShell';
import '~/components/landing/landing.css';
import '~/components/landing/editorial.css';
import { LandingFooter } from '~/components/landing/LandingFooter';
import { LandingInstruments } from '~/components/landing/LandingInstruments';
import { ASCIIBackground, LandingHeadline, FocusMessage, WordPlay } from '~/components/landing/LandingEffects';
import { useLandingMotion } from '~/components/landing/useLandingMotion';
import '~/components/landing/effects.css';
import { BITTENSOR_QUEST_URL, TENSORSCAN_URL } from '~/components/landing/links';

export const meta: MetaFunction = () => [
  { title: 'TensorStudio — An idea deserves a network' },
  {
    name: 'description',
    content:
      'Explore ideas, build subnet projects, and run local Bittensor nodes. One workspace for your next network.',
  },
];
const features = [
  {
    to: '/playground',
    icon: 'i-ph:sparkle',
    title: 'Start with a question.',
    detail: 'A building partner to explore your idea, work through tradeoffs, and find a practical next step.',
    action: 'Explore the playground',
  },
  {
    to: '/editor',
    icon: 'i-ph:code',
    title: 'Give your idea a shape.',
    detail: 'Go from a conversation to editable code. Build your subnet’s interfaces and tools in one workspace.',
    action: 'Open subnet builder',
  },
  {
    to: '/subcreate',
    icon: 'i-ph:graph',
    title: 'Define what good means.',
    detail: 'Assemble a subnet project around your task, labelled data, and a measurable evaluation.',
    action: 'Set up a subnet',
  },
];
export default function Home() {
  const navigate = useNavigate();
  const [idea, setIdea] = useState('');
  const motion = useLandingMotion();
  return (
    <div
      className="ts-landing ts-landing--editorial"
      data-reduced-motion={motion.reduced}
      data-motion={motion.enabled ? 'running' : 'paused'}
    >
      <a className="ts-skip" href="#landing-main">
        Skip to content
      </a>
      <header className="ts-nav">
        <Link to="/" className="ts-brand" aria-label="TensorStudio home">
          <StudioMark />
          <span>
            Tensor<span>Studio</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/playground">Playground</Link>
          <Link to="/editor">Builder</Link>
          <Link to="/nodes">Nodes</Link>
          <Link to={TENSORSCAN_URL} target="_blank" rel="noopener noreferrer" reloadDocument>
            TensorScan <span aria-hidden="true">↗</span>
          </Link>
        </nav>
        <Link className="ts-nav-cta" to="/editor">
          Open studio <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main id="landing-main">
        <section className="ts-hero" aria-labelledby="hero-title">
          <ASCIIBackground ready={motion.ready} enabled={motion.enabled} />
          <div className="ts-hero-content">
            <div className="ts-news-window">
              <div>
                <span className="i-ph:terminal-window" aria-hidden="true" /> TensorStudio workbench
              </div>
              <p>One idea. Every next step.</p>
              <a href="#modules">Discover your workspace ↗</a>
            </div>
            <div className="ts-logo-flare" aria-hidden="true">
              <div className="ts-flare-ring" />
              <div className="ts-flare-line" />
              <StudioMark />
            </div>
            <p className="ts-editorial-intro">
              Introducing TensorStudio <span aria-hidden="true">············</span> built for Bittensor
            </p>
            <LandingHeadline enabled={motion.enabled} />
            <p>
              From the first “what if” to your next subnet.
              <br className="ts-desktop-break" /> Think, build, and experiment on Bittensor.
            </p>
            <form
              className="ts-start-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (idea.trim()) navigate('/playground', { state: { draft: idea.trim() } });
              }}
            >
              <label className="sr-only" htmlFor="landing-idea">
                Your Bittensor idea
              </label>
              <span className="i-ph:sparkle" aria-hidden="true" />
              <input
                id="landing-idea"
                value={idea}
                maxLength={2000}
                onChange={(event) => setIdea(event.target.value)}
                placeholder="A task, an idea, a better way to do things…"
              />
              <button type="submit" disabled={!idea.trim()}>
                Explore <span aria-hidden="true">↗</span>
              </button>
            </form>
            <div className="ts-try-prompts">
              <span>Try an idea</span>
              {['A useful subnet', 'My first validator', 'An AI evaluation tool'].map((text) => (
                <Link
                  key={text}
                  to="/playground"
                  state={{ draft: `Help me plan ${text.toLowerCase()}. What should I decide first?` }}
                >
                  {text}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
            <div className="ts-hero-actions">
              <Link className="ts-button ts-button-primary" to="/editor">
                Build a subnet <span aria-hidden="true">↗</span>
              </Link>
              <Link className="ts-button ts-button-secondary" to="/playground">
                <span className="i-ph:sparkle" aria-hidden="true" /> Explore an idea
              </Link>
            </div>
            <div className="ts-hero-note">
              <span className="i-ph:code" aria-hidden="true" /> Editable code <span className="ts-note-dot" /> Local
              development <span className="ts-note-dot" /> Your keys, your control
            </div>
          </div>
          <div className="ts-hero-bottom">
            <span>Built for the open intelligence network</span>
            <button
              type="button"
              disabled={!motion.ready || motion.reduced}
              onClick={motion.toggle}
              aria-label={
                motion.reduced ? 'Reduced motion enabled' : motion.paused ? 'Resume animations' : 'Pause animations'
              }
            >
              <span className={motion.enabled ? 'i-ph:pause' : 'i-ph:play'} aria-hidden="true" />
              {motion.reduced ? 'Reduced motion on' : motion.paused ? 'Resume animations' : 'Pause animations'}
            </button>
          </div>
        </section>
        <div className="ts-topic-strip" aria-label="Built for Bittensor">
          <span>Bittensor</span>
          <i />
          <span>Subnets</span>
          <i />
          <span>Miners</span>
          <i />
          <span>Validators</span>
          <i />
          <span>TAO</span>
          <i />
          <span>Yuma</span>
          <i />
          <span>Consensus</span>
          <i />
          <span>Open intelligence</span>
        </div>
        <LandingInstruments />
        <section className="ts-modules ts-section" id="modules" aria-labelledby="modules-title">
          <div className="ts-modules-heading">
            <h2 id="modules-title">What’s inside.</h2>
            <span>One connected workspace</span>
          </div>
          <div className="ts-module-list">
            {[
              [
                'AI Playground',
                'Explore ideas, ask questions, and work out your next step.',
                '/playground',
                'i-ph:sparkle',
              ],
              ['Subnet builder', 'Build editable interfaces and tools with code and preview.', '/editor', 'i-ph:code'],
              [
                'Subnet setup',
                'Define a task, provide labelled data, and assemble a project.',
                '/subcreate',
                'i-ph:graph',
              ],
              ['Nodes', 'Manage local miner and validator processes and inspect their logs.', '/nodes', 'i-ph:cpu'],
              [
                'TensorScan',
                'Read blocks, accounts, transactions, and subnet activity.',
                TENSORSCAN_URL,
                'i-ph:magnifying-glass',
              ],
              ['Dashboard', 'Keep subnet information in view.', '/dashboard', 'i-ph:chart-line'],
              ['Wallet', 'Manage your personal wallet with keys encrypted in this browser.', '/wallet', 'i-ph:wallet'],
              ['Console', 'Access authenticated local runner operations.', '/runner', 'i-ph:terminal-window'],
            ].map(([name, detail, to, icon]) => (
              <Link
                key={to}
                to={to}
                className="ts-module-row"
                reloadDocument={to.startsWith('https://')}
                target={to.startsWith('https://') ? '_blank' : undefined}
                rel={to.startsWith('https://') ? 'noopener noreferrer' : undefined}
              >
                <span className={icon} aria-hidden="true" />
                <h3>{name}</h3>
                <p>{detail}</p>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
        <WordPlay enabled={motion.enabled} />
        <section className="ts-workspace ts-section" id="workspace" aria-labelledby="workspace-title">
          <div className="ts-section-heading">
            <p className="ts-caption">The workspace</p>
            <h2 id="workspace-title">
              Less between you
              <br />
              and your next build.
            </h2>
            <p>
              Ideas, code, and network tools.
              <br />
              Finally in the same place.
            </p>
          </div>
          <figure className="ts-network-art">
            <div className="ts-network-art-image">
              <img
                src="/media/bittensor-network.jpg"
                width={1672}
                height={941}
                loading="lazy"
                decoding="async"
                alt="A glass Bittensor tau at the center of six connected computing nodes, illuminated in lilac, icy blue, and pink."
              />
            </div>
            <figcaption>
              <div>
                <span className="ts-art-label">A network of possibilities</span>
                <p>
                  Miners do the work. Validators evaluate quality.
                  <br />
                  Your idea gives them a task.
                </p>
              </div>
              <Link to="/subcreate">
                Shape your subnet <span aria-hidden="true">↗</span>
              </Link>
            </figcaption>
          </figure>
          <div className="ts-features">
            {features.map((feature) => (
              <Link key={feature.to} to={feature.to} className="ts-feature">
                <span className={feature.icon} aria-hidden="true" />
                <h3>{feature.title}</h3>
                <p>{feature.detail}</p>
                <span className="ts-feature-action">
                  {feature.action}
                  <span aria-hidden="true">↗</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="ts-process ts-section" id="how-it-works" aria-labelledby="process-title">
          <div>
            <p className="ts-caption">A path from curiosity to code</p>
            <h2 id="process-title">
              Make the next
              <br />
              step a real one.
            </h2>
            <p>
              You don’t need the whole plan to begin.
              <br />
              You just need a place to start.
            </p>
            <Link className="ts-text-link" to="/playground">
              Find your starting point <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <ol>
            {[
              [
                'Explore the possibility',
                'Talk through your idea in the playground. Get useful questions, practical suggestions, and a direction you can build on.',
              ],
              [
                'Build the first version',
                'Create editable interfaces in the subnet builder. Use subnet setup to assemble a project from your task and evaluation data.',
              ],
              [
                'Run, observe, improve',
                'Run local miners and validators with the runner. Follow network activity in TensorScan and refine your project.',
              ],
            ].map(([title, detail], index) => (
              <li key={title}>
                <span className="ts-step-number">0{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="ts-tools-strip ts-section" aria-label="More workspace tools">
          <Link to="/nodes">
            <span className="i-ph:cpu" />
            <div>
              Meet your nodes<small>Local processes and logs</small>
            </div>
            <span aria-hidden="true">↗</span>
          </Link>
          <Link to={TENSORSCAN_URL} target="_blank" rel="noopener noreferrer" reloadDocument>
            <span className="i-ph:magnifying-glass" />
            <div>
              Read the network<small>Blocks, subnets, and activity</small>
            </div>
            <span aria-hidden="true">↗</span>
          </Link>
          <Link to="/wallet">
            <span className="i-ph:wallet" />
            <div>
              Stay in control<small>Manage your wallet locally</small>
            </div>
            <span aria-hidden="true">↗</span>
          </Link>
        </section>
        <section className="ts-quest" aria-labelledby="quest-title">
          <div className="ts-quest-icon" aria-hidden="true">
            <span className="i-ph:game-controller" />
          </div>
          <div className="ts-quest-copy">
            <p className="ts-caption">Bittensor Quest</p>
            <h2 id="quest-title">Learn Bittensor by playing.</h2>
            <p>
              Get to know Bittensor through a gamified learning experience. Then bring your next idea into TensorStudio.
            </p>
          </div>
          <a href={BITTENSOR_QUEST_URL} target="_blank" rel="noopener noreferrer" className="ts-quest-link">
            Play Bittensor Quest <span aria-hidden="true">↗</span>
          </a>
        </section>
        <section className="ts-faq ts-section" id="faq" aria-labelledby="faq-title">
          <h2 id="faq-title">Before you begin.</h2>
          <div>
            {[
              [
                'What can I build with TensorStudio?',
                'Explore ideas with the assistant, build Bittensor interfaces and tools in the code editor, assemble subnet projects, and run local miners and validators.',
              ],
              [
                'What do I need to run a project?',
                'Code generation needs a configured AI provider. Node processes need the local runner, and chain features need an available Bittensor RPC connection.',
              ],
              [
                'Does building a subnet register it on-chain?',
                'No. Generating a project or running a local process does not register a subnet or a node on-chain. Registration is a separate chain operation.',
              ],
              [
                'Where do my wallet keys live?',
                'Your personal wallet is encrypted in this browser. The local runner does not receive its mnemonic. Local development operations use separately labelled test identities.',
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="ts-final">
          <div className="ts-final-halo" aria-hidden="true" />
          <StudioMark />
          <FocusMessage enabled={motion.enabled} />
          <Link className="ts-button ts-button-primary" to="/playground">
            Let’s explore it <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
