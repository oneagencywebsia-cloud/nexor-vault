import { NexorMark } from './NexorLogo';
import { SectionBackdrop } from './SectionBackdrop';

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="nexor-mesh-bg safe-top safe-bottom relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-void px-4 py-8 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px]">
        <SectionBackdrop scene="home" />
      </div>
      <div className="nexor-page-anim relative z-10 w-full max-w-sm rounded-[28px] sm:border sm:border-line sm:bg-white/80 sm:p-8 sm:shadow-[0_30px_70px_-35px_rgba(76,63,196,0.4)] sm:backdrop-blur-md">
        <div className="mb-7 flex flex-col items-center text-center sm:mb-8">
          <div className="mb-4 rounded-2xl border border-line bg-white p-3.5 shadow-sm">
            <NexorMark size={30} id="auth" />
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-foreground sm:text-[24px]">{title}</h1>
          {subtitle && <div className="mt-1.5 text-[13px] leading-relaxed text-dim">{subtitle}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputClass =
  'w-full rounded-2xl border border-line-strong bg-surface px-4 py-3.5 text-[15px] text-foreground placeholder:text-dim outline-none transition-colors focus:border-purple';

export const primaryButtonClass =
  'w-full rounded-2xl bg-purple py-3.5 text-[15px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(108,92,231,0.7)] transition-transform active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100';

export const ghostButtonClass =
  'w-full rounded-2xl border border-line-strong bg-surface/60 py-3.5 text-[15px] font-semibold text-foreground transition-transform active:scale-[0.97] disabled:opacity-50';
