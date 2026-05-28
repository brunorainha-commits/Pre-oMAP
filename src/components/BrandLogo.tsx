interface BrandLogoProps {
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16'
};

export function BrandLogo({ showText = true, size = 'md' }: BrandLogoProps) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <img
        src="/logo.svg"
        alt="PrecoMap"
        className={`${sizeClasses[size]} shrink-0 drop-shadow-[0_10px_24px_rgba(6,182,212,0.18)]`}
      />
      {showText && (
        <div className="min-w-0">
          <div className="font-outfit font-bold text-white leading-none tracking-wide truncate">PrecoMap</div>
          <div className="text-[10px] text-cyan-300/80 font-semibold tracking-[0.18em] uppercase mt-1">
            Price Intel
          </div>
        </div>
      )}
    </div>
  );
}
