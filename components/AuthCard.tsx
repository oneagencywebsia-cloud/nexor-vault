import { NexorMark } from './NexorLogo';

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
    <div className="nexor-mesh-bg safe-top safe-bottom flex flex-1 items-center justify-center bg-void px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 rounded-2xl border border-line bg-surface/60 p-3.5">
            <NexorMark size={30} id="auth" />
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-foreground">{title}</h1>
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
