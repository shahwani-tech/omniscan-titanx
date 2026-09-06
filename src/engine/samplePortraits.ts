/**
 * OMNISCAN TITAN X - Built-in Studio Sample Portraits
 * Provides offline, high-quality portrait illustrations for testing passport & biometric tools
 */

export function createSamplePortraitSvg(gender: "male" | "female" | "id_card"): string {
  if (gender === "female") {
    return `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750" width="600" height="750">
        <rect width="600" height="750" fill="#EBF4FF"/>
        <!-- Torso & Blazer -->
        <path d="M120 750 C120 620 180 540 300 540 C420 540 480 620 480 750 Z" fill="#1E293B"/>
        <!-- Inner Shirt -->
        <path d="M250 540 L300 640 L350 540 Z" fill="#FFFFFF"/>
        <!-- Neck -->
        <rect x="260" y="440" width="80" height="120" rx="20" fill="#FBD38D"/>
        <!-- Hair Back -->
        <path d="M180 320 C170 480 180 580 230 620 L370 620 C420 580 430 480 420 320 Z" fill="#4A3728"/>
        <!-- Head -->
        <ellipse cx="300" cy="350" rx="110" ry="140" fill="#FEEBC8"/>
        <!-- Hair Front -->
        <path d="M190 320 C190 200 410 200 410 320 C380 260 320 250 300 250 C280 250 220 260 190 320 Z" fill="#4A3728"/>
        <!-- Eyes -->
        <ellipse cx="255" cy="340" rx="12" ry="8" fill="#FFFFFF"/>
        <circle cx="255" cy="340" r="5" fill="#2D3748"/>
        <ellipse cx="345" cy="340" rx="12" ry="8" fill="#FFFFFF"/>
        <circle cx="345" cy="340" r="5" fill="#2D3748"/>
        <!-- Eyebrows -->
        <path d="M235 320 Q255 310 275 320" stroke="#332418" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M325 320 Q345 310 365 320" stroke="#332418" stroke-width="4" fill="none" stroke-linecap="round"/>
        <!-- Nose -->
        <path d="M300 340 L295 385 L305 385" stroke="#E2B880" stroke-width="3" fill="none" stroke-linecap="round"/>
        <!-- Mouth -->
        <path d="M275 425 Q300 445 325 425" stroke="#E53E3E" stroke-width="4" fill="none" stroke-linecap="round"/>
        <!-- Ears -->
        <circle cx="188" cy="360" r="16" fill="#FEEBC8"/>
        <circle cx="412" cy="360" r="16" fill="#FEEBC8"/>
      </svg>
    `)}`;
  }

  if (gender === "id_card") {
    return `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750" width="600" height="750">
        <rect width="600" height="750" fill="#FFFFFF"/>
        <!-- Suit -->
        <path d="M100 750 C100 600 180 520 300 520 C420 520 500 600 500 750 Z" fill="#0F172A"/>
        <path d="M230 520 L300 660 L370 520 Z" fill="#FFFFFF"/>
        <!-- Tie -->
        <polygon points="290,560 310,560 320,700 300,730 280,700" fill="#B91C1C"/>
        <!-- Neck -->
        <rect x="265" y="420" width="70" height="110" rx="15" fill="#FCD34D"/>
        <!-- Head -->
        <ellipse cx="300" cy="330" rx="105" ry="135" fill="#FDE68A"/>
        <!-- Hair Short -->
        <path d="M195 300 C195 180 405 180 405 300 C405 240 370 210 300 210 C230 210 195 240 195 300 Z" fill="#18181B"/>
        <!-- Eyes -->
        <ellipse cx="260" cy="325" rx="10" ry="7" fill="#FFFFFF"/>
        <circle cx="260" cy="325" r="4.5" fill="#1E293B"/>
        <ellipse cx="340" cy="325" rx="10" ry="7" fill="#FFFFFF"/>
        <circle cx="340" cy="325" r="4.5" fill="#1E293B"/>
        <!-- Eyebrows -->
        <path d="M245 308 Q260 300 275 308" stroke="#18181B" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M325 308 Q340 300 355 308" stroke="#18181B" stroke-width="4" fill="none" stroke-linecap="round"/>
        <!-- Nose -->
        <path d="M300 325 L296 368 L305 368" stroke="#D97706" stroke-width="3" fill="none" stroke-linecap="round"/>
        <!-- Gentle Smile -->
        <path d="M280 405 Q300 420 320 405" stroke="#78350F" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <!-- Ears -->
        <circle cx="192" cy="335" r="16" fill="#FDE68A"/>
        <circle cx="408" cy="335" r="16" fill="#FDE68A"/>
      </svg>
    `)}`;
  }

  // Default Professional Male Portrait
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750" width="600" height="750">
      <rect width="600" height="750" fill="#F1F5F9"/>
      <!-- Suit Jacket -->
      <path d="M110 750 C110 590 190 510 300 510 C410 510 490 590 490 750 Z" fill="#1E3A8A"/>
      <!-- White Shirt -->
      <path d="M240 510 L300 650 L360 510 Z" fill="#FFFFFF"/>
      <!-- Tie -->
      <polygon points="292,540 308,540 316,680 300,710 284,680" fill="#DC2626"/>
      <!-- Neck -->
      <rect x="260" y="420" width="80" height="110" rx="16" fill="#FED7AA"/>
      <!-- Head -->
      <ellipse cx="300" cy="330" rx="110" ry="135" fill="#FFEDD5"/>
      <!-- Hair -->
      <path d="M190 310 C190 170 410 170 410 310 C400 220 350 200 300 200 C250 200 200 220 190 310 Z" fill="#334155"/>
      <!-- Eyes -->
      <ellipse cx="258" cy="325" rx="11" ry="7" fill="#FFFFFF"/>
      <circle cx="258" cy="325" r="5" fill="#0F172A"/>
      <ellipse cx="342" cy="325" rx="11" ry="7" fill="#FFFFFF"/>
      <circle cx="342" cy="325" r="5" fill="#0F172A"/>
      <!-- Eyebrows -->
      <path d="M240 305 Q260 295 280 305" stroke="#1E293B" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M320 305 Q340 295 360 305" stroke="#1E293B" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <!-- Nose -->
      <path d="M300 325 L295 370 L306 370" stroke="#FB923C" stroke-width="3" fill="none" stroke-linecap="round"/>
      <!-- Mouth -->
      <path d="M276 410 Q300 426 324 410" stroke="#9A3412" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <!-- Ears -->
      <circle cx="188" cy="335" r="17" fill="#FFEDD5"/>
      <circle cx="412" cy="335" r="17" fill="#FFEDD5"/>
    </svg>
  `)}`;
}
