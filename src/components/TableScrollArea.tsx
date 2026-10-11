import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export function TableScrollArea({
  children,
  label,
  hint,
}: {
  children: ReactNode;
  label: string;
  hint: string;
}) {
  const region = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const element = region.current;
    if (!element) return;
    const measure = () => setOverflow(element.scrollWidth > element.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <>
      {overflow && (
        <p id={hintId} className="table-scroll-hint">
          {hint}
        </p>
      )}
      <div
        ref={region}
        className="product-table-scroll"
        role="region"
        aria-label={label}
        aria-describedby={overflow ? hintId : undefined}
        tabIndex={0}
      >
        {children}
      </div>
    </>
  );
}
