import type { HandConfig } from '../types';

interface Props {
  config: HandConfig;
  color?: string;
  size?: number;
}

/**
 * Geometric hand illustration for LSM signs.
 * Renders fingers (4) + thumb as rounded rectangles with a subtle glow.
 */
export function HandSVG({ config, color = '#0ED2B8', size = 64 }: Props) {
  const H = size * 1.18;

  // Palm geometry
  const pX  = size * 0.14;
  const pY  = size * 0.54;
  const pW  = size * 0.72;
  const pH  = size * 0.40;
  const pRx = size * 0.12;

  // Finger geometry
  const fw  = size * 0.13;
  const fxs = [pX + 2, pX + fw + 4, pX + fw * 2 + 6, pX + fw * 3 + 8]; // pinky→index

  const extH  = size * 0.50;
  const bentH = size * 0.28;
  const foldH = size * 0.11;

  const uid = `h${color.replace('#', '')}_${size}`;

  return (
    <svg
      viewBox={`0 0 ${size} ${H}`}
      width={size}
      height={H}
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <radialGradient id={`gl-${uid}`} cx="50%" cy="40%" r="65%">
          <stop offset="0%"   stopColor={color} stopOpacity=".22" />
          <stop offset="100%" stopColor={color} stopOpacity=".02" />
        </radialGradient>
      </defs>

      {/* Glow ellipse */}
      <ellipse
        cx={size / 2} cy={H - 5}
        rx={size * 0.36} ry={size * 0.09}
        fill={`url(#gl-${uid})`}
      />

      {/* Fingers: [pinky, ring, middle, index] */}
      {config.f.map((ext, i) => {
        const hf = ext === 1 ? extH : ext > 0.1 ? bentH : foldH;
        const fy = pY - hf + (ext < 0.1 ? 0 : foldH);
        const op = ext === 1 ? 1 : ext > 0.1 ? 0.78 : 0.42;
        return (
          <rect
            key={i}
            x={fxs[i]} y={fy}
            width={fw} height={hf + foldH * 0.7}
            rx={fw / 2}
            fill={color} opacity={op}
          />
        );
      })}

      {/* Palm */}
      <rect x={pX} y={pY} width={pW} height={pH} rx={pRx} fill={color} opacity=".87" />

      {/* Thumb */}
      {config.t === 'ext' && (
        <g transform={`rotate(-38 ${pX - 3} ${pY + pH * 0.38})`}>
          <rect
            x={pX - 11} y={pY + pH * 0.08}
            width={fw} height={size * 0.35}
            rx={fw / 2} fill={color} opacity=".90"
          />
        </g>
      )}
      {(config.t === 'side' || config.t === 'near') && (
        <g transform={`rotate(-14 ${pX - 1} ${pY + pH * 0.52})`}>
          <rect
            x={pX - 9} y={pY + pH * 0.22}
            width={fw} height={size * 0.27}
            rx={fw / 2} fill={color} opacity=".78"
          />
        </g>
      )}
      {config.t === 'over' && (
        <rect
          x={pX + 4} y={pY - 2}
          width={pW - 10} height={size * 0.07}
          rx={size * 0.035}
          fill={color} opacity=".60"
        />
      )}
    </svg>
  );
}
