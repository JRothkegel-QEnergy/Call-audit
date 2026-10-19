export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start gap-4">
      <div>
        <h1 className="m-0 text-[22px] font-semibold leading-7 tracking-[-0.01em]">{title}</h1>
        {description && <p className="mb-0 mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KpiCard({
  value,
  label,
  badge,
  onClick,
  hint,
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
  hint?: React.ReactNode;
}) {
  const content = (
    <>
      {badge}
      <div className="mt-1.5 text-[28px] font-semibold leading-[34px] tracking-[-0.02em] tabular">{value}</div>
      <div className="text-[13px] text-muted-foreground">{label}</div>
      {hint && <div className="help">{hint}</div>}
    </>
  );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className="card cursor-pointer text-left hover:border-neutral-300">
        {content}
      </button>
    );
  return <div className="card">{content}</div>;
}
