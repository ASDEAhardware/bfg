"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { useSaveTheme } from "@/hooks/useSaveTheme";

export function ModeToggle() {
    const { theme, setTheme } = useTheme(); //theme = tema corrente, setTheme = funzione per cambiare tema
    const { mutate: saveTheme } = useSaveTheme(); //hook per salvare la preferenza del tema del DB

    // Logica del cambio tema ciclico
    const handleThemeToggle = () => {
        let newTheme: "light" | "dark" | "system";

        // Cicla tra i temi: light -> dark -> system -> light
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

        setTheme(newTheme); // Viene aggiornato il tema lato client
        saveTheme(newTheme); // Viene chiamato l'hook che esegue una chiamata API per aggiornare il tema nel Database
    };

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

    return (
        <Button variant="outline" size="icon" onClick={handleThemeToggle}>
            {theme === "light" && <Sun className="h-[1.2rem] w-[1.2rem]" />}
            {theme === "dark" && <Moon className="h-[1.2rem] w-[1.2rem]" />}
            {theme === "system" && <Monitor className="h-[1.2rem] w-[1.2rem]" />}
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}

