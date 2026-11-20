import { useState } from "react";

interface AvatarProps {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE_CLASSES = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-lg",
};

export function Avatar({ src, name, size = "md" }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "S";

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`${name} avatar`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${SIZE_CLASSES[size]} rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800`}
      />
    );
  }

  return (
    <div
      aria-label={`${name} initials`}
      className={`${SIZE_CLASSES[size]} rounded-full flex items-center justify-center font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 shrink-0 select-none`}
    >
      {initials}
    </div>
  );
}
