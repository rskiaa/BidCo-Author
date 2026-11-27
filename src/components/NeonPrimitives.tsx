import React, { useEffect, useState } from 'react';
import { motion, useSpring } from 'motion/react';

export const SPRING_SNAPPY = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function GoogleSpectrumBar({ sticky = false }: { sticky?: boolean }) {
  return (
    <div
      className={`h-[3px] w-full shrink-0 google-spectrum-bar ${
        sticky ? 'sticky top-0 z-50' : ''
      }`}
      aria-hidden="true"
    />
  );
}

export function GoogleBrandMark({ size = 34 }: { size?: number }) {
  return (
    <motion.div
      whileHover={{ scale: 1.06, rotate: -2 }}
      transition={SPRING_SNAPPY}
      style={{ width: size, height: size }}
      className="rounded-xl bg-[#11151E] border border-white/15 flex items-center justify-center shrink-0 relative overflow-hidden shadow-[0_0_20px_-6px_rgba(66,133,244,0.65)]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#4285F4]/20 via-transparent to-[#34A853]/15 pointer-events-none" />
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 relative z-10" fill="none">
        <path
          d="M6 3.5H13.5L18.5 8.5V19.5C18.5 20.0523 18.0523 20.5 17.5 20.5H6C5.44772 20.5 5 20.0523 5 19.5V4.5C5 3.94772 5.44772 3.5 6 3.5Z"
          stroke="#669DF6"
          strokeWidth="2"
        />
        <path d="M13.5 3.5V8.5H18.5" stroke="#4ADE80" strokeWidth="2" strokeLinejoin="round" />
        <path d="M8.5 12.5H15" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" />
        <path d="M8.5 16H13" stroke="#F87171" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </motion.div>
  );
}

export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const spring = useSpring(value, { stiffness: 120, damping: 22, mass: 0.7 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsub = spring.on('change', (latest) => {
      setDisplay(latest);
    });
    return () => unsub();
  }, [spring]);

  const formatted =
    decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export function StaggerContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.045,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.28, ease: EASE_OUT_EXPO },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
