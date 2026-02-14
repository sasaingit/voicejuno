import { formatTimer } from '../../utils/time';

type TimerProps = {
  seconds: number;
};

export default function Timer({ seconds }: TimerProps) {
  return (
    <div style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted)', fontSize: 14 }}>
      {formatTimer(seconds)}
    </div>
  );
}
