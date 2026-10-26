import type { InteractionMode } from "@/config/pond.config";

interface ModeIconProps {
  mode: InteractionMode;
  size?: number;
  className?: string;
}

/** Line icons shared by the mode picker and the custom cursor. */
export function ModeIcon({ mode, size = 24, className }: ModeIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (mode) {
    case "ripple":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="6" opacity="0.8" />
          <circle cx="12" cy="12" r="10" opacity="0.45" />
        </svg>
      );
    case "trail":
      return (
        <svg {...common}>
          <path d="M3 17c3-1 4-6 8-6s5 4 10 2" />
          <circle cx="20" cy="13" r="2" fill="currentColor" stroke="none" />
          <path d="M4 20c3-1 4-4 7-4" opacity="0.45" />
        </svg>
      );
    case "feed":
      return (
        <svg {...common}>
          <circle cx="9" cy="10" r="2" fill="currentColor" stroke="none" />
          <circle cx="15" cy="9" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="12" cy="15" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="9" opacity="0.45" />
        </svg>
      );
    case "attract":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" opacity="0.6" />
          <path d="M8.5 5.5 12 9l3.5-3.5M8.5 18.5 12 15l3.5 3.5" />
        </svg>
      );
    case "scatter":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
          <path d="M12 7V3M12 21v-4M7 12H3M21 12h-4M8.5 8.5 6 6M18 18l-2.5-2.5M15.5 8.5 18 6M6 18l2.5-2.5" />
        </svg>
      );
    case "hand":
      return (
        <svg {...common}>
          <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-.6a6 6 0 0 1-4.6-2.2L4.6 15a1.5 1.5 0 0 1 2.3-1.9L9 15" />
        </svg>
      );
    case "remove":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="m9 9 6 6M15 9l-6 6" />
        </svg>
      );
  }
}
