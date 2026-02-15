type RecordButtonState = 'idle' | 'recording' | 'saving';

type RecordButtonProps = {
  state: RecordButtonState;
  disabled?: boolean;
  onClick: () => void;
};

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
      className="recordButton"
      data-state={state}
    >
      {getLabel(state)}
    </button>
  );
}
