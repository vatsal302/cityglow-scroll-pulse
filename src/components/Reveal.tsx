import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "header" | "li" | "p" | "span";
};

/**
 * Smooth, understated scroll reveal:
 * - 16px translate, fades to opacity 1, blur(4px) → blur(0)
 * - 700ms ease-out, triggers at 18% in viewport, plays once
 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className = "",
  as: Tag = "div",
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.18 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const style: CSSProperties = {
    transitionDelay: `${delay}ms`,
    transform: shown ? "translate3d(0,0,0)" : `translate3d(0, ${y}px, 0)`,
    opacity: shown ? 1 : 0,
    filter: shown ? "blur(0px)" : "blur(4px)",
    transition:
      "opacity 700ms cubic-bezier(0.16, 1, 0.3, 1), transform 700ms cubic-bezier(0.16, 1, 0.3, 1), filter 700ms cubic-bezier(0.16, 1, 0.3, 1)",
    willChange: "transform, opacity, filter",
  };

  // @ts-expect-error - dynamic tag with ref
  return (
    <Tag ref={ref} style={style} className={className}>
      {children}
    </Tag>
  );
}

export default Reveal;
