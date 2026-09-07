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
      className={`relative h-[22px] w-10 flex-none rounded-full transition disabled:opacity-40 ${checked ? 'bg-primary-600' : 'shadow-inset'}`}
    >
      <span
        className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all"
        style={{ left: checked ? '21px' : '3px' }}
      />
    </button>
  );
}
