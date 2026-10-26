import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "default" | "danger" | "active";
}

const tones = {
  default: "border-white/15 bg-white/10 hover:bg-white/20",
  danger: "border-red-300/25 bg-red-400/10 hover:bg-red-400/20 text-red-100",
  active: "border-teal-200/60 bg-teal-300/25 hover:bg-teal-300/30",
};

export function Button({ tone = "default", className = "", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`h-9 rounded-lg border px-3 text-xs font-medium text-white/90 transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
