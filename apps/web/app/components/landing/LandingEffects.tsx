import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import BlurText from '~/components/react-bits/BlurText';
import TrueFocus from '~/components/react-bits/TrueFocus';

const GradientASCII = lazy(() => import('~/components/react-bits/GradientASCII'));
const FallingText = lazy(() => import('~/components/react-bits/FallingText'));
const headline = 'The workspace for your next Bittensor subnet.';
const words = 'Ideas Tasks Data Miners Validators Subnets';

export function ASCIIBackground({ ready, enabled }: { ready: boolean; enabled: boolean }) {
  return (
    <div className="ts-ascii-background" aria-hidden="true">
      <div className="ts-ascii-fallback" />
      {ready && (
        <Suspense fallback={null}>
          <GradientASCII
            colors={['#d5d1f0', '#f6dbea', '#c6e6f3', '#737bb8']}
            shape="horizon"
            characters=" .:+xτ01#"
            cellSize={17}
            density={0.7}
            glyphOpacity={0.65}
            gradientOpacity={0.42}
            lightMode
            glow={0.08}
            flicker={0.08}
            speed={0.35}
            flow={0.3}
            grain={0.025}
            dpr={1}
            paused={!enabled}
            intro={false}
            mouseInteraction={enabled}
            clickEffect="none"
          />
        </Suspense>
      )}
      <div className="ts-ascii-readability" />
    </div>
  );
}
export function LandingHeadline({ enabled }: { enabled: boolean }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <h1 id="hero-title">
      {enabled && !revealed ? (
        <BlurText
          onAnimationComplete={() => setRevealed(true)}
          as="span"
          text={headline}
          delay={65}
          blur={5}
          distance={12}
          stepDuration={0.2}
          trigger="load"
          effect="blur"
          className="ts-blur-headline"
        />
      ) : (
        <span>{headline}</span>
      )}
    </h1>
  );
}
export function FocusMessage({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.15 });
  return (
    <div ref={ref} className="ts-focus-message">
      <h2 className="sr-only">Describe it. Build it. Run it.</h2>
      <div aria-hidden="true">
        {enabled && inView ? (
          <TrueFocus
            sentence="Describe. Build. Run."
            focusStyle="brackets"
            blurAmount={0.6}
            borderColor="#f45aa3"
            cornerSize={15}
            borderWidth={2}
            animationDuration={0.45}
            pauseBetweenAnimations={1.8}
          />
        ) : (
          <div className="ts-focus-static">Describe. Build. Run.</div>
        )}
      </div>
      <p>One workspace for every next step.</p>
    </div>
  );
}
function StaticWords() {
  return (
    <div className="ts-falling-static" aria-hidden="true">
      {words.split(' ').map((word) => (
        <span key={word}>{word}</span>
      ))}
    </div>
  );
}
export function WordPlay({ enabled }: { enabled: boolean }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!enabled) setActive(false);
  }, [enabled]);
  return (
    <section className="ts-wordplay ts-section" aria-labelledby="wordplay-title">
      <div className="ts-wordplay-copy">
        <p className="ts-caption">A little room to experiment</p>
        <h2 id="wordplay-title">
          Big ideas.
          <br />A playful beginning.
        </h2>
        <p>Every subnet starts with a few building blocks. See where yours can go.</p>
        <div className="ts-wordplay-actions">
          <button type="button" disabled={!enabled || active} onClick={() => setActive(true)}>
            Drop the words <span aria-hidden="true">↓</span>
          </button>
          <button type="button" disabled={!active} onClick={() => setActive(false)}>
            Reset
          </button>
        </div>
        <small>
          {enabled
            ? 'Drop, drag, and rearrange. Reset to begin again.'
            : 'Animation is paused. Your building blocks stay in place.'}
        </small>
      </div>
      <div className="ts-wordplay-stage">
        <span className="sr-only">Building blocks: ideas, tasks, data, miners, validators, and subnets.</span>
        <div className="ts-wordplay-physics" aria-hidden="true">
          {active && enabled ? (
            <Suspense fallback={<StaticWords />}>
              <FallingText
                text={words}
                highlightWords={['Ideas', 'Subnets']}
                trigger="auto"
                variant="tiles"
                theme="light"
                fontSize="clamp(16px, 2vw, 23px)"
                gravity={0.6}
                bounciness={0.28}
                scatter={0.4}
                draggable
                cursorPush={0.3}
                accentColor="#e7a7ce"
                restoreDelay={0}
              />
            </Suspense>
          ) : (
            <StaticWords />
          )}
        </div>
        <span className="ts-wordplay-stage-label">Your building blocks</span>
      </div>
    </section>
  );
}
