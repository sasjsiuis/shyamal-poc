import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}

export const RangeSlider: React.FC<RangeSliderProps> = ({
  min,
  max,
  step = 1,
  value,
  onChange,
  ariaLabel,
}) => {
  const { isDark } = useTheme();
  const clamped = Math.min(max, Math.max(min, value));
  const pct = max === min ? 0 : ((clamped - min) / (max - min)) * 100;
  const trackBg = isDark ? '#1F2937' : '#E5E7EB';

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={clamped}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      className="card-slider block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/50"
      style={{
        background: `linear-gradient(to right, #4F46E5 0%, #4F46E5 ${pct}%, ${trackBg} ${pct}%, ${trackBg} 100%)`,
      }}
    />
  );
};
