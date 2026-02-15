import { formatTimer } from '../../utils/time';

type TimerProps = {
  seconds: number;
};

export default function Timer({ seconds }: TimerProps) {
  return (
    <div className="timer">{formatTimer(seconds)}</div>
  );
}
