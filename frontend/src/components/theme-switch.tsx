"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useSaveTheme } from "@/hooks/useSaveTheme";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

import { ThemeOption } from "@/types";

const themes: { value: ThemeOption; icon: React.ComponentType<any> }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const { mutate: saveTheme } = useSaveTheme();
  const t = useTranslations('components.header_buttons');
  const [mounted, setMounted] = React.useState(false);
  const debounceTimer = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => setMounted(true), []);

  const handleThemeChange = (newTheme: ThemeOption) => {
    if (theme === newTheme) return;

    setTheme(newTheme);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      saveTheme(newTheme);
    }, 2000);
  };

  React.useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-1">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex h-8 w-8 items-center justify-center">
            <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const activeThemeIndex = themes.findIndex((t) => t.value === theme);

  return (
    <div className="relative flex w-full items-center justify-between bg-transparent">
      {/* Moving Highlight */}
      <div
        className="absolute h-8 w-1/3 rounded-md bg-muted transition-transform duration-300 ease-in-out"
        style={{
          transform: `translateX(${activeThemeIndex * 100}%)`,
        }}
      />
      {themes.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => handleThemeChange(value)}
          className={cn(
            "relative z-10 flex flex-1 items-center justify-center rounded-md p-1.5 text-sm font-medium transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            theme === value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}

