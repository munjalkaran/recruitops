export function TeloraLogo({ size = 40, className = "", showLabel = false }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src="/brand/telora-mark.svg"
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain dark:hidden"
      />
      <img
        src="/brand/telora-mark-white.svg"
        alt=""
        width={size}
        height={size}
        className="hidden shrink-0 object-contain dark:block"
      />
      {showLabel ? <span className="font-semibold text-primary">Telora</span> : null}
    </span>
  );
}

export function TeloraFullLogo({ className = "", alt = "Telora" }) {
  return (
    <span className={`inline-flex ${className}`}>
      <img
        src="/brand/telora-logo.svg"
        alt={alt}
        className="h-auto w-[min(220px,70vw)] object-contain dark:hidden"
      />
      <img
        src="/brand/telora-logo-white.svg"
        alt={alt}
        className="hidden h-auto w-[min(220px,70vw)] object-contain dark:block"
      />
    </span>
  );
}

export function TeloraWordmark({ className = "" }) {
  return <span className={`text-base font-semibold tracking-tight text-primary ${className}`}>Telora</span>;
}
