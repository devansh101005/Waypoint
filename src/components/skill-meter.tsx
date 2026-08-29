/**
 * One skill's standing: where the learner is, and where they need to get to.
 *
 * Drawn as a five-segment gauge rather than a percentage bar because the corpus
 * is tagged in levels 1-5, and rounding that to a percentage invents precision
 * the data does not have. The target sits on the gauge as a tick, so "how far
 * is left" is read directly instead of computed.
 */

interface SkillMeterProps {
  name: string;
  level: number;
  targetLevel: number | null;
  isGoal: boolean;
}

const SEGMENTS = [1, 2, 3, 4, 5];

export function SkillMeter({
  name,
  level,
  targetLevel,
  isGoal,
}: SkillMeterProps) {
  const reached = targetLevel !== null && level >= targetLevel;
  const label =
    targetLevel === null
      ? `${name}: level ${round(level)} of 5`
      : `${name}: level ${round(level)} of 5, target ${targetLevel}${reached ? ", reached" : ""}`;

  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className="min-w-0 flex-1 truncate text-sm">
        {name}
        {isGoal && (
          <span className="text-route-ink ml-2 text-[0.65rem] tracking-wide uppercase">
            goal
          </span>
        )}
      </span>

      <span
        className="flex items-center gap-[3px]"
        role="img"
        aria-label={label}
      >
        {SEGMENTS.map((segment) => {
          const filled = level >= segment - 0.25;
          const isTarget = targetLevel !== null && segment === targetLevel;
          return (
            <span
              key={segment}
              className={`h-3.5 w-2.5 rounded-[2px] ${
                filled ? "bg-route" : "bg-muted"
              } ${isTarget && !filled ? "ring-route-ink ring-1" : ""}`}
            />
          );
        })}
      </span>

      <span className="text-ink-muted w-16 text-right font-mono text-xs tabular-nums">
        {round(level)}
        {targetLevel !== null && (
          <span className="opacity-60"> / {targetLevel}</span>
        )}
      </span>
    </li>
  );
}

function round(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
