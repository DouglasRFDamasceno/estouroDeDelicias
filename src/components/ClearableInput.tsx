import { useRef } from 'react';
import type { InputHTMLAttributes } from 'react';

export function FieldClearButton({
  label,
  disabled,
  onClear,
}: {
  label: string;
  disabled?: boolean;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      className="field-clear"
      aria-label={`Limpar ${label}`}
      title={`Limpar ${label}`}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.preventDefault();
        onClear();
      }}
    >
      <span aria-hidden="true">×</span>
    </button>
  );
}

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'type'> {
  label: string;
  value: string;
  type?: 'text' | 'search';
  onClear: () => void;
}

export function ClearableInput({ label, value, onClear, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <span className="clearable-field">
      <input
        {...props}
        ref={input}
        className={['clearable-input', props.className].filter(Boolean).join(' ')}
        aria-label={props['aria-label'] ?? label}
        value={value}
      />
      {value && !props.readOnly && (
        <FieldClearButton
          label={label}
          disabled={props.disabled}
          onClear={() => {
            onClear();
            input.current?.focus();
          }}
        />
      )}
    </span>
  );
}
