/**
 * OMNISCAN TITAN X - Professional Built-In Background Backdrops
 * Crisp, standalone SVG Data-URLs with photographic gradients, bokeh filters,
 * studio lighting vignettes, and micro-textures.
 *
 * Categorized per Biometric & Studio specifications:
 * - Passport Official: Plain White, Off-White, Light Grey, Light Blue, Cream
 * - Studio Portraits: Grey Textured, Blue Studio, Slate Dark, Warm Studio
 * - Corporate: Modern Office Blur, Gradient Blue, Bookshelf Blur, Clean Interior
 * - Creative/Casual: Outdoor Bokeh, Urban Blur, Nature Soft, Warm Light
 */

export interface LibraryBackdrop {
  id: string;
  name: string;
  category: "official" | "studio" | "corporate" | "creative";
  description: string;
  dataUrl: string;
  thumbnailColor?: string;
  tags: string[];
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

// -------------------------------------------------------------
// 1. PASSPORT OFFICIAL
// -------------------------------------------------------------

const plainWhiteSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
</svg>`;

const offWhiteSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <radialGradient id="ow" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F8FAFC"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#ow)"/>
</svg>`;

const lightGreySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <radialGradient id="lg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="#F1F5F9"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#lg)"/>
</svg>`;

const lightBlueSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <radialGradient id="lb" cx="50%" cy="35%" r="75%">
      <stop offset="0%" stop-color="#F0F9FF"/>
      <stop offset="100%" stop-color="#BAE6FD"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#lb)"/>
</svg>`;

const creamSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <radialGradient id="cr" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#FFFBEB"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#cr)"/>
</svg>`;

// -------------------------------------------------------------
// 2. STUDIO PORTRAITS
// -------------------------------------------------------------

const greyTexturedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <radialGradient id="gt" cx="50%" cy="36%" r="65%">
      <stop offset="0%" stop-color="#F8FAFC"/>
      <stop offset="55%" stop-color="#CBD5E1"/>
      <stop offset="100%" stop-color="#64748B"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.055 0"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#gt)"/>
  <rect width="100%" height="100%" filter="url(#grain)"/>
</svg>`;

const blueStudioSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <radialGradient id="bs" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#2563EB"/>
      <stop offset="50%" stop-color="#1E3A8A"/>
      <stop offset="100%" stop-color="#0B132B"/>
    </radialGradient>
    <filter id="softVignette">
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.04 0"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bs)"/>
  <rect width="100%" height="100%" filter="url(#softVignette)"/>
</svg>`;

const slateDarkSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <radialGradient id="sd" cx="50%" cy="36%" r="65%">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="65%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#sd)"/>
</svg>`;

const warmStudioSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <radialGradient id="ws" cx="50%" cy="38%" r="68%">
      <stop offset="0%" stop-color="#D97706"/>
      <stop offset="45%" stop-color="#78350F"/>
      <stop offset="100%" stop-color="#1C1917"/>
    </radialGradient>
    <filter id="warmGrain">
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.05 0"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#ws)"/>
  <rect width="100%" height="100%" filter="url(#warmGrain)"/>
</svg>`;

// -------------------------------------------------------------
// 3. CORPORATE
// -------------------------------------------------------------

const modernOfficeBlurSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <linearGradient id="offSky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#CBD5E1"/>
      <stop offset="40%" stop-color="#94A3B8"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
    <filter id="heavyBlur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="22"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#offSky)"/>
  <g filter="url(#heavyBlur)" opacity="0.85">
    <!-- Window mullions and distant high-rise light pillars -->
    <rect x="40" y="50" width="130" height="500" fill="#E2E8F0" opacity="0.7"/>
    <rect x="230" y="30" width="140" height="540" fill="#F8FAFC" opacity="0.8"/>
    <rect x="430" y="60" width="120" height="480" fill="#E2E8F0" opacity="0.6"/>
    <!-- Distant warm interior glow -->
    <circle cx="160" cy="450" r="100" fill="#FEF08A" opacity="0.4"/>
    <circle cx="480" cy="400" r="120" fill="#93C5FD" opacity="0.4"/>
    <rect x="0" y="520" width="600" height="230" fill="#1E293B" opacity="0.75"/>
  </g>
</svg>`;

const gradientBlueSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <linearGradient id="gb" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E40AF"/>
      <stop offset="50%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#60A5FA"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#gb)"/>
</svg>`;

const bookshelfBlurSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <linearGradient id="wood" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#451A03"/>
      <stop offset="50%" stop-color="#292524"/>
      <stop offset="100%" stop-color="#1C1917"/>
    </linearGradient>
    <filter id="bokehBook" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="20"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#wood)"/>
  <g filter="url(#bokehBook)" opacity="0.9">
    <!-- Shelves & colorful book spine vertical strips -->
    <rect x="30" y="40" width="540" height="24" fill="#78350F"/>
    <rect x="50" y="70" width="40" height="150" fill="#B91C1C"/>
    <rect x="100" y="70" width="35" height="150" fill="#1D4ED8"/>
    <rect x="145" y="70" width="50" height="150" fill="#D97706"/>
    <rect x="210" y="70" width="45" height="150" fill="#047857"/>
    <rect x="380" y="70" width="60" height="150" fill="#A855F7"/>
    <rect x="460" y="70" width="50" height="150" fill="#F8FAFC"/>

    <!-- Middle shelf -->
    <rect x="30" y="260" width="540" height="24" fill="#78350F"/>
    <rect x="60" y="290" width="70" height="170" fill="#991B1B"/>
    <rect x="140" y="290" width="55" height="170" fill="#CA8A04"/>
    <rect x="370" y="290" width="80" height="170" fill="#0369A1"/>
    <rect x="470" y="290" width="60" height="170" fill="#334155"/>

    <!-- Warm desk lamp glow -->
    <circle cx="500" cy="380" r="140" fill="#FDE047" opacity="0.5"/>
  </g>
</svg>`;

const cleanInteriorSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <linearGradient id="arch" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#F8FAFC"/>
      <stop offset="70%" stop-color="#E2E8F0"/>
      <stop offset="100%" stop-color="#CBD5E1"/>
    </linearGradient>
    <filter id="archBlur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="24"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#arch)"/>
  <g filter="url(#archBlur)">
    <!-- Soft architectural column and plant bokeh -->
    <rect x="80" y="0" width="180" height="750" fill="#FFFFFF" opacity="0.9"/>
    <rect x="400" y="200" width="160" height="550" fill="#E2E8F0" opacity="0.7"/>
    <!-- Subtle natural olive plant bokeh -->
    <circle cx="480" cy="500" r="110" fill="#15803D" opacity="0.25"/>
    <circle cx="520" cy="420" r="90" fill="#4ADE80" opacity="0.2"/>
    <!-- Soft floor reflection -->
    <rect x="0" y="600" width="600" height="150" fill="#D97706" opacity="0.12"/>
  </g>
</svg>`;

// -------------------------------------------------------------
// 4. CREATIVE / CASUAL
// -------------------------------------------------------------

const outdoorBokehSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <linearGradient id="foliage" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#14532D"/>
      <stop offset="40%" stop-color="#166534"/>
      <stop offset="100%" stop-color="#15803D"/>
    </linearGradient>
    <filter id="bokehBlur">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#foliage)"/>
  <!-- Dappled sunlight orbs -->
  <g filter="url(#bokehBlur)">
    <circle cx="120" cy="140" r="65" fill="#FEF08A" opacity="0.35"/>
    <circle cx="180" cy="220" r="90" fill="#86EFAC" opacity="0.3"/>
    <circle cx="450" cy="160" r="75" fill="#FEF9C3" opacity="0.4"/>
    <circle cx="490" cy="280" r="110" fill="#BBF7D0" opacity="0.35"/>
    <circle cx="280" cy="380" r="130" fill="#FDE047" opacity="0.25"/>
    <circle cx="90" cy="520" r="100" fill="#4ADE80" opacity="0.25"/>
    <circle cx="510" cy="580" r="85" fill="#FEF08A" opacity="0.3"/>
  </g>
</svg>`;

const urbanBlurSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <linearGradient id="twilight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="50%" stop-color="#1E1B4B"/>
      <stop offset="100%" stop-color="#311042"/>
    </linearGradient>
    <filter id="cityBokeh">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#twilight)"/>
  <g filter="url(#cityBokeh)">
    <circle cx="110" cy="200" r="45" fill="#F59E0B" opacity="0.45"/>
    <circle cx="160" cy="320" r="70" fill="#EC4899" opacity="0.35"/>
    <circle cx="420" cy="180" r="50" fill="#38BDF8" opacity="0.4"/>
    <circle cx="480" cy="290" r="85" fill="#F59E0B" opacity="0.4"/>
    <circle cx="270" cy="450" r="110" fill="#F43F5E" opacity="0.3"/>
    <circle cx="80" cy="550" r="90" fill="#60A5FA" opacity="0.35"/>
    <circle cx="490" cy="540" r="75" fill="#FBBF24" opacity="0.45"/>
  </g>
</svg>`;

const natureSoftSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <linearGradient id="meadow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#BAE6FD"/>
      <stop offset="45%" stop-color="#E0F2FE"/>
      <stop offset="70%" stop-color="#BBF7D0"/>
      <stop offset="100%" stop-color="#86EFAC"/>
    </linearGradient>
    <filter id="meadowBlur" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="16"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#meadow)"/>
  <g filter="url(#meadowBlur)">
    <ellipse cx="300" cy="480" rx="350" ry="160" fill="#FDE68A" opacity="0.4"/>
    <circle cx="150" cy="280" r="100" fill="#FFFFFF" opacity="0.6"/>
  </g>
</svg>`;

const warmLightSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750">
  <defs>
    <linearGradient id="goldenWall" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFBEB"/>
      <stop offset="50%" stop-color="#FEF3C7"/>
      <stop offset="100%" stop-color="#FDE68A"/>
    </linearGradient>
    <filter id="sunbeam" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#goldenWall)"/>
  <g filter="url(#sunbeam)">
    <!-- Golden hour diagonal sunbeam stripes -->
    <polygon points="100,0 260,0 450,750 290,750" fill="#FFFFFF" opacity="0.55"/>
    <polygon points="320,0 460,0 600,500 500,500" fill="#F59E0B" opacity="0.25"/>
    <!-- Warm floor wash -->
    <rect x="0" y="580" width="600" height="170" fill="#D97706" opacity="0.2"/>
  </g>
</svg>`;

// -------------------------------------------------------------
// EXPORTED LIBRARY BACKDROPS LIST
// -------------------------------------------------------------

export const LIBRARY_BACKDROPS: LibraryBackdrop[] = [
  // 1. Passport Official
  {
    id: "lib-plain-white",
    name: "Plain White",
    category: "official",
    description: "ICAO 9303 official passport standard pure white",
    dataUrl: svgToDataUrl(plainWhiteSvg),
    thumbnailColor: "#FFFFFF",
    tags: ["ICAO", "US Passport", "Schengen", "Universal"],
  },
  {
    id: "lib-off-white",
    name: "Off-White",
    category: "official",
    description: "Soft high-key neutral off-white with gentle depth",
    dataUrl: svgToDataUrl(offWhiteSvg),
    thumbnailColor: "#F8FAFC",
    tags: ["High-Key", "Neutral", "Visa", "Professional"],
  },
  {
    id: "lib-light-grey",
    name: "Light Grey",
    category: "official",
    description: "UK, Canadian, and Australian official light grey standard",
    dataUrl: svgToDataUrl(lightGreySvg),
    thumbnailColor: "#E2E8F0",
    tags: ["UK", "Canada", "Australia", "ICAO"],
  },
  {
    id: "lib-light-blue",
    name: "Light Blue",
    category: "official",
    description: "US Consular & Malaysian photo requirement light blue",
    dataUrl: svgToDataUrl(lightBlueSvg),
    thumbnailColor: "#BAE6FD",
    tags: ["US Visa", "Consular", "Malaysia", "Formal"],
  },
  {
    id: "lib-cream",
    name: "Cream",
    category: "official",
    description: "Warm consular ivory tone for formal ID badges",
    dataUrl: svgToDataUrl(creamSvg),
    thumbnailColor: "#FFFBEB",
    tags: ["Ivory", "Warm", "Badge", "ID"],
  },

  // 2. Studio Portraits
  {
    id: "lib-grey-textured",
    name: "Grey Textured",
    category: "studio",
    description: "Classic studio portrait spotlight with subtle texture",
    dataUrl: svgToDataUrl(greyTexturedSvg),
    thumbnailColor: "#CBD5E1",
    tags: ["Portrait", "Spotlight", "Texture", "Classic"],
  },
  {
    id: "lib-blue-studio",
    name: "Blue Studio",
    category: "studio",
    description: "Executive radial blue portrait illumination",
    dataUrl: svgToDataUrl(blueStudioSvg),
    thumbnailColor: "#1E3A8A",
    tags: ["Executive", "Corporate", "Portrait", "Dramatic"],
  },
  {
    id: "lib-slate-dark",
    name: "Slate Dark",
    category: "studio",
    description: "Modern charcoal and slate portrait backdrop",
    dataUrl: svgToDataUrl(slateDarkSvg),
    thumbnailColor: "#1E293B",
    tags: ["Modern", "Dark", "Slate", "High-Contrast"],
  },
  {
    id: "lib-warm-studio",
    name: "Warm Studio",
    category: "studio",
    description: "Warm amber spotlight with studio portrait depth",
    dataUrl: svgToDataUrl(warmStudioSvg),
    thumbnailColor: "#78350F",
    tags: ["Warm", "Amber", "Spotlight", "Dramatic"],
  },

  // 3. Corporate
  {
    id: "lib-modern-office-blur",
    name: "Modern Office Blur",
    category: "corporate",
    description: "Contemporary high-rise office architectural bokeh",
    dataUrl: svgToDataUrl(modernOfficeBlurSvg),
    thumbnailColor: "#94A3B8",
    tags: ["Office", "Architecture", "Bokeh", "LinkedIn"],
  },
  {
    id: "lib-gradient-blue",
    name: "Gradient Blue",
    category: "corporate",
    description: "Professional corporate executive gradient backdrop",
    dataUrl: svgToDataUrl(gradientBlueSvg),
    thumbnailColor: "#2563EB",
    tags: ["Corporate", "Executive", "Badge", "Gradient"],
  },
  {
    id: "lib-bookshelf-blur",
    name: "Bookshelf Blur",
    category: "corporate",
    description: "Executive library and bookshelf soft bokeh blur",
    dataUrl: svgToDataUrl(bookshelfBlurSvg),
    thumbnailColor: "#451A03",
    tags: ["Library", "Books", "Executive", "Academic"],
  },
  {
    id: "lib-clean-interior",
    name: "Clean Interior",
    category: "corporate",
    description: "Minimalist modern interior with clean ambient blur",
    dataUrl: svgToDataUrl(cleanInteriorSvg),
    thumbnailColor: "#E2E8F0",
    tags: ["Minimalist", "Interior", "Contemporary", "Bright"],
  },

  // 4. Creative/Casual
  {
    id: "lib-outdoor-bokeh",
    name: "Outdoor Bokeh",
    category: "creative",
    description: "Dappled sunlight through outdoor foliage bokeh",
    dataUrl: svgToDataUrl(outdoorBokehSvg),
    thumbnailColor: "#166534",
    tags: ["Outdoor", "Nature", "Bokeh", "Sunlight"],
  },
  {
    id: "lib-urban-blur",
    name: "Urban Blur",
    category: "creative",
    description: "Evening city dusk with ambient street bokeh circles",
    dataUrl: svgToDataUrl(urbanBlurSvg),
    thumbnailColor: "#1E1B4B",
    tags: ["Urban", "City", "Night", "Vibrant"],
  },
  {
    id: "lib-nature-soft",
    name: "Nature Soft",
    category: "creative",
    description: "Pastel meadow and soft natural sky horizon",
    dataUrl: svgToDataUrl(natureSoftSvg),
    thumbnailColor: "#86EFAC",
    tags: ["Pastel", "Meadow", "Soft", "Calm"],
  },
  {
    id: "lib-warm-light",
    name: "Warm Light",
    category: "creative",
    description: "Golden hour window wash and warm ambient sunbeams",
    dataUrl: svgToDataUrl(warmLightSvg),
    thumbnailColor: "#FEF3C7",
    tags: ["Golden Hour", "Sunbeam", "Warm", "Natural"],
  },
];
