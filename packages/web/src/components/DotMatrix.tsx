import type { ReactNode } from 'react';

/** Amber LED text, like a bus destination blind or departure board. */
export function DotMatrix({
  children,
  className = '',
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div className={`dot-matrix ${className}`} aria-label={label}>
      {children}
    </div>
  );
}
