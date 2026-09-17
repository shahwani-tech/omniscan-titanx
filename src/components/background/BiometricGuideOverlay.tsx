/**
 * OMNISCAN TITAN X - Biometric Passport Photo Guide Overlay
 * Displays ICAO 9303 / ISO 19794-5 compliant biometric guide lines:
 * Face Oval, Eye Level line, Crown line, Chin line, Shoulder curve, and Headroom %
 */

import React from "react";

interface BiometricGuideOverlayProps {
  showOval?: boolean;
  showEyeLine?: boolean;
  showShoulderLine?: boolean;
  showHeadroom?: boolean;
  subjectYOffset?: number; // foregroundTransform.y
  subjectScale?: number;   // foregroundTransform.scale
}

export const BiometricGuideOverlay: React.FC<BiometricGuideOverlayProps> = ({
  showOval = true,
  showEyeLine = true,
  showShoulderLine = true,
  showHeadroom = true,
  subjectYOffset = 0,
  subjectScale = 1,
}) => {
  // Headroom estimation: standard passport target is ~10-14% of photo height above crown
  // Calculate dynamic headroom based on subject offset & scale
  const baseHeadroom = 12;
  const deltaHeadroom = -Math.round((subjectYOffset / 10) * 0.8 + (subjectScale - 1) * 15);
  const currentHeadroom = Math.max(2, Math.min(30, baseHeadroom + deltaHeadroom));
  const isOptimal = currentHeadroom >= 8 && currentHeadroom <= 16;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-15 overflow-hidden">
      <svg className="w-full h-full" viewBox="0 0 400 500" preserveAspectRatio="none">
        <defs>
          {/* Subtle glow filter for guides */}
          <filter id="guideGlow">
            <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* 4 Corner Crop Brackets */}
        <g stroke="#10B981" strokeWidth="2" fill="none" opacity="0.8" filter="url(#guideGlow)">
          {/* Top-Left */}
          <path d="M 12 28 L 12 12 L 28 12" />
          {/* Top-Right */}
          <path d="M 372 12 L 388 12 L 388 28" />
          {/* Bottom-Left */}
          <path d="M 12 472 L 12 488 L 28 488" />
          {/* Bottom-Right */}
          <path d="M 372 488 L 388 488 L 388 472" />
        </g>

        {/* Crown Line (12% from top) */}
        <line
          x1="20"
          y1="60"
          x2="380"
          y2="60"
          stroke="#38BDF8"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.6"
          filter="url(#guideGlow)"
        />

        {/* Eye Level Line (46% from top) */}
        {showEyeLine && (
          <g filter="url(#guideGlow)">
            <line
              x1="20"
              y1="230"
              x2="380"
              y2="230"
              stroke="#10B981"
              strokeWidth="1.5"
              strokeDasharray="6 4"
              opacity="0.8"
            />
            <rect x="25" y="218" width="60" height="15" rx="3" fill="#047857" opacity="0.85" />
            <text x="32" y="229" fill="#ECFDF5" fontSize="9" fontWeight="bold" fontFamily="monospace">
              EYE LEVEL
            </text>
          </g>
        )}

        {/* Face Oval Guide (Centered at X=200, Y=240, rx=85, ry=120) */}
        {showOval && (
          <g filter="url(#guideGlow)">
            <ellipse
              cx="200"
              cy="245"
              rx="85"
              ry="125"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="1.5"
              strokeDasharray="6 4"
              opacity="0.8"
            />
          </g>
        )}

        {/* Chin Level Line (72% from top = 360) */}
        <line
          x1="30"
          y1="360"
          x2="370"
          y2="360"
          stroke="#38BDF8"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.6"
          filter="url(#guideGlow)"
        />

        {/* Shoulder Line Curve (84% from top = 420) */}
        {showShoulderLine && (
          <g filter="url(#guideGlow)">
            <path
              d="M 40 460 Q 200 400 360 460"
              fill="none"
              stroke="#A855F7"
              strokeWidth="1.5"
              strokeDasharray="5 5"
              opacity="0.75"
            />
            <rect x="160" y="408" width="80" height="15" rx="3" fill="#6B21A8" opacity="0.85" />
            <text x="168" y="419" fill="#FAF5FF" fontSize="9" fontWeight="bold" fontFamily="monospace">
              SHOULDER LINE
            </text>
          </g>
        )}

        {/* Center Vertical Axis */}
        <line
          x1="200"
          y1="15"
          x2="200"
          y2="485"
          stroke="#94A3B8"
          strokeWidth="0.8"
          strokeDasharray="3 3"
          opacity="0.4"
        />
      </svg>

      {/* Floating Headroom & Compliance Badge */}
      {showHeadroom && (
        <div className="absolute top-3 right-3 bg-neutral-900/90 backdrop-blur-sm border border-neutral-700/80 rounded-lg px-2.5 py-1 flex items-center space-x-2 shadow-lg text-[10px]">
          <span
            className={`w-2 h-2 rounded-full ${
              isOptimal ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            }`}
          />
          <span className="font-mono text-neutral-300">
            Headroom: <strong className={isOptimal ? "text-emerald-400" : "text-amber-400"}>{currentHeadroom}%</strong>
          </span>
          <span className="text-[9px] text-neutral-500 font-mono">
            {isOptimal ? "(ICAO Optimal)" : "(8-16% Ideal)"}
          </span>
        </div>
      )}
    </div>
  );
};
