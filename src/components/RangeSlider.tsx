import React from 'react';

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
  const clamped = Math.min(max, Math.max(min, value));
  const pct = max === min ? 0 : ((clamped - min) / (max - min)) * 100;

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={clamped}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      className="card-slider block w-full"
      style={{
        background: `linear-gradient(to right, #faab3f 0%, #faab3f ${pct}%, #3b3b3b ${pct}%, #3b3b3b 100%)`,
      }}
    />
  );
};
