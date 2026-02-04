import { Link } from './Link';

interface ExampleCardProps {
  id: string;
  title: string;
  description: string;
}

export function ExampleCard({ id, title, description }: ExampleCardProps) {
  const difficulty = getDifficulty(id);
  const badge = getDifficultyBadge(difficulty);

  return (
    <Link
      href={`/examples/${id}`}
      className="block group p-6 rounded-2xl bg-tertiary/30 border border-tertiary/50 hover:border-neon-cyan/50 transition-all duration-300 hover:shadow-neon-sm border-glow"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold text-gray-100 group-hover:text-neon-cyan transition-colors heading-glow">
              {title}
            </h3>
            {badge}
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
        </div>
        <svg
          className="w-5 h-5 text-gray-500 group-hover:text-neon-cyan group-hover:translate-x-1 transition-all neon-flicker-alt neon-flicker-delay-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </Link>
  );
}

/**
 * Determine example difficulty based on ID.
 */
function getDifficulty(id: string): 'beginner' | 'intermediate' | 'advanced' {
  const beginner = ['basic-ping'];
  const advanced = ['custom-serializer', 'timeout-config'];

  if (beginner.includes(id)) return 'beginner';
  if (advanced.includes(id)) return 'advanced';
  return 'intermediate';
}

/**
 * Get badge styling for difficulty level.
 */
function getDifficultyBadge(
  difficulty: 'beginner' | 'intermediate' | 'advanced'
): React.ReactNode {
  const styles = {
    beginner:
      'bg-neon-mint/20 text-neon-mint border-neon-mint/50 neon-flicker-slow',
    intermediate:
      'bg-neon-orange/20 text-neon-orange border-neon-orange/50 neon-flicker-alt',
    advanced:
      'bg-neon-purple/20 text-neon-purple border-neon-purple/50 neon-flicker',
  };

  return (
    <span
      className={`
        px-2 py-0.5 rounded text-xs font-medium border
        ${styles[difficulty]}
      `}
    >
      {difficulty}
    </span>
  );
}
