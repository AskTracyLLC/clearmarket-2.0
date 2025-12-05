interface CountBadgeProps {
  count: number;
  className?: string;
}

export const CountBadge = ({ count, className = "" }: CountBadgeProps) => {
  if (count <= 0) return null;

  const displayCount = count > 99 ? "99+" : count;

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-semibold rounded-full bg-orange-500/20 text-orange-500 border border-orange-500/30 ${className}`}
    >
      {displayCount}
    </span>
  );
};
