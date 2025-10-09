"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { useSaveTheme } from "@/hooks/useSaveTheme";
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export function ModeToggle() {
    const { theme, setTheme } = useTheme();
    const { mutate: saveTheme } = useSaveTheme();

    // Usiamo una ref per tenere traccia del timer del debounce
    const debounceTimer = React.useRef<NodeJS.Timeout | null>(null);

    const handleThemeToggle = () => {
        let newTheme: "light" | "dark" | "system";

        switch (theme) {
            case "light":
                newTheme = "dark";
                break;
            case "dark":
                newTheme = "system";
                break;
            case "system":
            default:
                newTheme = "light";
                break;
        }

        // Aggiorna immediatamente il tema lato client per una UX reattiva
        setTheme(newTheme);

        // Pulisci il timer precedente se esiste
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        // Imposta un nuovo timer per salvare il tema dopo 500ms
        debounceTimer.current = setTimeout(() => {
            saveTheme(newTheme);
        }, 2000);
    };

    // Assicurati di pulire il timer quando il componente viene smontato
    React.useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, []);

    // Gestisce lo stato non montato per evitare mismatch SSR/CSR
    // (next-themes gestisce questo internamente, ma un controllo non fa male)
    // in modo tale che il tema venga determinato solo dopo che il componente è stato montato
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    if (!mounted) {
        return (
            <Button variant="outline" size="icon" disabled>
                <Monitor className="h-[1.2rem] w-[1.2rem]" />
            </Button>
        );
    }

    const button =  (
        <Button variant="outline" size="icon" onClick={handleThemeToggle} title="Change Theme">
            {theme === "light" && <Sun className="h-[1.2rem] w-[1.2rem]" />}
            {theme === "dark" && <Moon className="h-[1.2rem] w-[1.2rem]" />}
            {theme === "system" && <Monitor className="h-[1.2rem] w-[1.2rem]" />}
            <span className="sr-only">Toggle theme</span>
        </Button>
    );

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {button}
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center">
                Change Theme
            </TooltipContent>
        </Tooltip>
    )
}

