import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Configuration for retrowave background effects
 */
export interface RetroEffectsConfig {
  /** Show the perspective grid at the bottom */
  grid: boolean;
  /** Show the horizon gradient (purple/pink fade) */
  horizon: boolean;
  /** Show floating orb elements */
  orbs: boolean;
  /** Show subtle CRT scanlines */
  scanlines: boolean;
}

const defaultConfig: RetroEffectsConfig = {
  grid: true,
  horizon: true,
  orbs: true,
  scanlines: true,
};

interface RetroEffectsContextValue {
  config: RetroEffectsConfig;
  setConfig: (config: Partial<RetroEffectsConfig>) => void;
  reducedMotion: boolean;
}

const RetroEffectsContext = createContext<RetroEffectsContextValue | null>(null);

/**
 * Hook to access and modify retro effects configuration
 */
export function useRetroEffects() {
  const context = useContext(RetroEffectsContext);
  if (!context) {
    throw new Error('useRetroEffects must be used within RetroEffectsProvider');
  }
  return context;
}

/**
 * Hook to detect prefers-reduced-motion
 */
function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return reducedMotion;
}

interface RetroEffectsProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<RetroEffectsConfig>;
}

/**
 * Provider component for retro effects configuration
 */
export function RetroEffectsProvider({
  children,
  initialConfig,
}: RetroEffectsProviderProps) {
  const [config, setConfigState] = useState<RetroEffectsConfig>({
    ...defaultConfig,
    ...initialConfig,
  });
  const reducedMotion = useReducedMotion();

  const setConfig = (partial: Partial<RetroEffectsConfig>) => {
    setConfigState((prev) => ({ ...prev, ...partial }));
  };

  return (
    <RetroEffectsContext.Provider value={{ config, setConfig, reducedMotion }}>
      {children}
    </RetroEffectsContext.Provider>
  );
}

interface RetroBackgroundProps {
  /** Override the context config for this instance */
  config?: Partial<RetroEffectsConfig>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Retrowave background component with toggleable effects.
 * Renders grid, horizon gradient, floating orbs, and scan lines.
 * Respects prefers-reduced-motion automatically.
 */
export function RetroBackground({ config: propConfig, className = '' }: RetroBackgroundProps) {
  const context = useContext(RetroEffectsContext);
  const reducedMotion = useReducedMotion();

  // Use prop config, context config, or defaults
  const config = {
    ...defaultConfig,
    ...context?.config,
    ...propConfig,
  };

  // If reduced motion is preferred, disable animated effects
  const effectiveConfig = reducedMotion
    ? { ...config, orbs: false, scanlines: false }
    : config;

  return (
    <div
      className={`fixed inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Horizon Gradient - bottom purple/pink fade */}
      {effectiveConfig.horizon && (
        <div className="absolute inset-0 retro-horizon" />
      )}

      {/* Perspective Grid Floor */}
      {effectiveConfig.grid && (
        <div className="absolute inset-0 retro-grid" />
      )}

      {/* Floating Orbs */}
      {effectiveConfig.orbs && (
        <>
          {/* Cyan orb - top left */}
          <div
            className="absolute w-96 h-96 rounded-full blur-3xl animate-float"
            style={{
              top: '15%',
              left: '20%',
              background: 'radial-gradient(circle, rgba(0, 240, 255, 0.15) 0%, transparent 70%)',
            }}
          />
          {/* Purple orb - bottom right */}
          <div
            className="absolute w-96 h-96 rounded-full blur-3xl animate-float"
            style={{
              bottom: '20%',
              right: '15%',
              background: 'radial-gradient(circle, rgba(191, 0, 255, 0.12) 0%, transparent 70%)',
              animationDelay: '2s',
            }}
          />
          {/* Pink/Magenta orb - center */}
          <div
            className="absolute w-72 h-72 rounded-full blur-3xl animate-float"
            style={{
              top: '40%',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'radial-gradient(circle, rgba(255, 0, 128, 0.08) 0%, transparent 70%)',
              animationDelay: '4s',
            }}
          />
          {/* Mint accent orb - top right */}
          <div
            className="absolute w-64 h-64 rounded-full blur-3xl animate-pulse-slow"
            style={{
              top: '10%',
              right: '25%',
              background: 'radial-gradient(circle, rgba(0, 255, 157, 0.06) 0%, transparent 70%)',
              animationDelay: '1s',
            }}
          />
        </>
      )}

      {/* Scan Lines Overlay */}
      {effectiveConfig.scanlines && (
        <div className="absolute inset-0 retro-scanlines" />
      )}
    </div>
  );
}

/**
 * Toggle button component for retro effects (optional UI element)
 */
interface EffectsToggleProps {
  className?: string;
}

export function EffectsToggle({ className = '' }: EffectsToggleProps) {
  const { config, setConfig, reducedMotion } = useRetroEffects();
  const [isOpen, setIsOpen] = useState(false);

  const toggleAll = () => {
    const allEnabled = config.grid && config.horizon && config.orbs && config.scanlines;
    const newValue = !allEnabled;
    setConfig({
      grid: newValue,
      horizon: newValue,
      orbs: newValue,
      scanlines: newValue,
    });
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg bg-tertiary/50 border border-tertiary hover:border-neon-cyan/50 transition-colors"
        title="Toggle visual effects"
        aria-label="Toggle visual effects menu"
      >
        <svg
          className="w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 p-3 rounded-lg bg-secondary border border-tertiary shadow-neon-sm min-w-48">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Visual Effects
          </div>

          {reducedMotion && (
            <div className="text-xs text-neon-orange mb-2 pb-2 border-b border-tertiary">
              Reduced motion enabled
            </div>
          )}

          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={config.grid}
              onChange={(e) => setConfig({ grid: e.target.checked })}
              className="rounded border-tertiary text-neon-cyan focus:ring-neon-cyan"
            />
            <span className="text-sm text-gray-300">Grid</span>
          </label>

          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={config.horizon}
              onChange={(e) => setConfig({ horizon: e.target.checked })}
              className="rounded border-tertiary text-neon-cyan focus:ring-neon-cyan"
            />
            <span className="text-sm text-gray-300">Horizon</span>
          </label>

          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={config.orbs}
              onChange={(e) => setConfig({ orbs: e.target.checked })}
              disabled={reducedMotion}
              className="rounded border-tertiary text-neon-cyan focus:ring-neon-cyan disabled:opacity-50"
            />
            <span className={`text-sm ${reducedMotion ? 'text-gray-500' : 'text-gray-300'}`}>
              Floating Orbs
            </span>
          </label>

          <label className="flex items-center gap-2 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={config.scanlines}
              onChange={(e) => setConfig({ scanlines: e.target.checked })}
              disabled={reducedMotion}
              className="rounded border-tertiary text-neon-cyan focus:ring-neon-cyan disabled:opacity-50"
            />
            <span className={`text-sm ${reducedMotion ? 'text-gray-500' : 'text-gray-300'}`}>
              Scan Lines
            </span>
          </label>

          <div className="mt-2 pt-2 border-t border-tertiary">
            <button
              onClick={toggleAll}
              className="text-xs text-neon-cyan hover:text-neon-mint transition-colors"
            >
              Toggle All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
