/**
 * OMNISCAN TITAN X - Built-In Background Patterns
 * Crisp SVG Data-URL Patterns for ID & Studio Photo Backdrops
 */

export interface BuiltinPattern {
  id: string;
  name: string;
  description: string;
  dataUrl: string;
  fitMode: "cover" | "tile";
}

// Plain Studio Fine Texture SVG
const plainTextureSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <defs>
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.05 0"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#F8FAFC"/>
  <rect width="100%" height="100%" filter="url(#noise)"/>
</svg>
`.trim();

// Subtle Studio Texture SVG
const subtleTextureSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
  <defs>
    <radialGradient id="grad" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.07 0"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad)"/>
  <rect width="100%" height="100%" filter="url(#grain)"/>
</svg>
`.trim();

// Studio Grey Backdrop SVG
const studioGreySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">
  <defs>
    <radialGradient id="spotlight" cx="50%" cy="38%" r="65%">
      <stop offset="0%" stop-color="#F1F5F9"/>
      <stop offset="60%" stop-color="#CBD5E1"/>
      <stop offset="100%" stop-color="#94A3B8"/>
    </radialGradient>
    <filter id="vignette">
      <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.04 0"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#spotlight)"/>
  <rect width="100%" height="100%" filter="url(#vignette)"/>
</svg>
`.trim();

// Gradient Studio Backdrop SVG
const gradientStudioSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">
  <defs>
    <linearGradient id="studioLin" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="35%" stop-color="#F8FAFC"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#studioLin)"/>
</svg>
`.trim();

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const BUILTIN_PATTERNS: BuiltinPattern[] = [
  {
    id: "pattern-plain",
    name: "Plain Texture",
    description: "Fine grain neutral canvas",
    dataUrl: svgToDataUrl(plainTextureSvg),
    fitMode: "cover",
  },
  {
    id: "pattern-subtle",
    name: "Subtle Studio",
    description: "Soft vignette with micro-grain",
    dataUrl: svgToDataUrl(subtleTextureSvg),
    fitMode: "cover",
  },
  {
    id: "pattern-studio-grey",
    name: "Studio Grey",
    description: "Classic portrait spotlight backdrop",
    dataUrl: svgToDataUrl(studioGreySvg),
    fitMode: "cover",
  },
  {
    id: "pattern-gradient-studio",
    name: "Gradient Studio",
    description: "High-key top lit studio gradient",
    dataUrl: svgToDataUrl(gradientStudioSvg),
    fitMode: "cover",
  },
];
