import { useEffect, useState } from "react";

type Props = { text: string; speed?: number; onTick?: () => void };

export default function Typer({ text, speed = 50, onTick }: Props) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setN(i);
      if (i % 3 === 0) onTick?.();
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed]);
  return (
    <span>
      {text.slice(0, n)}
      <span className="opacity-0">{text.slice(n)}</span>
    </span>
  );
}
