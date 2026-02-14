import type React from 'react';

type RecordButtonState = 'idle' | 'recording' | 'saving';

type RecordButtonProps = {
  state: RecordButtonState;
  disabled?: boolean;
  onClick: () => void;
};

const STYLES = Object.freeze({
  base: {
    width: 220,
    height: 220,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#374151',
    cursor: 'pointer',
    fontSize: 18,
    fontWeight: 600,
  } satisfies React.CSSProperties,
  idle: {
    background: '#1f2937',
    color: 'var(--fg)',
  } satisfies React.CSSProperties,
  recording: {
    background: '#b91c1c',
    borderColor: '#ef4444',
    color: 'white',
  } satisfies React.CSSProperties,
  saving: {
    background: '#111827',
    color: 'var(--muted)',
  } satisfies React.CSSProperties,
});

function getVariantStyle(state: RecordButtonState): React.CSSProperties {
  if (state === 'recording') return STYLES.recording;
  if (state === 'saving') return STYLES.saving;
  return STYLES.idle;
}

function getLabel(state: RecordButtonState): string {
  if (state === 'recording') return 'Stop';
  if (state === 'saving') return 'Saving…';
  return 'Record';
}

export default function RecordButton({ state, disabled, onClick }: RecordButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={getLabel(state)}
      style={{
        ...STYLES.base,
        ...getVariantStyle(state),
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {getLabel(state)}
    </button>
  );
}
