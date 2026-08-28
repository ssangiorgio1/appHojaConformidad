export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  title,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!checked)}
      className="relative h-[22px] w-10 flex-none rounded-full shadow-inset transition disabled:opacity-50"
      style={{ background: checked ? 'linear-gradient(145deg, var(--color-accent), var(--color-primary))' : undefined }}
    >
      <span
        className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all"
        style={{ left: checked ? '21px' : '3px' }}
      />
    </button>
  );
}
