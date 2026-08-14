export function NexorMark({ size = 28, id = 'default' }: { size?: number; id?: string }) {
  const gradId = `nexor-grad-${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b7cf6" />
          <stop offset="1" stopColor="#6c5ce7" />
        </linearGradient>
      </defs>
      <path
        d="M9 9 L9 31 M9 9 L31 31 M31 9 L31 31"
        stroke={`url(#${gradId})`}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9" r="3.2" fill="#b8b3ff" />
      <circle cx="31" cy="31" r="3.2" fill="#b8b3ff" />
    </svg>
  );
}

export function NexorWordmark({ tagline = false }: { tagline?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <NexorMark size={26} />
      <div className="flex flex-col leading-none">
        <span className="text-[17px] font-black tracking-[0.14em] text-foreground">NEXOR</span>
        {tagline && (
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-purple">
            Secure every connection
          </span>
        )}
      </div>
    </div>
  );
}
