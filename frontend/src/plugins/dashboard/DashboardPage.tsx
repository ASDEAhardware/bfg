"use client";
import React, { useState } from "react";
import { useUserInfo } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Lightbulb, Puzzle, Wrench, BarChart3 } from "lucide-react";

import { Playfair_Display } from 'next/font/google';

const playfairDisplay = Playfair_Display({ subsets: ['latin'] });

const tips = [
    {
        icon: Puzzle,
        title: "Modularità",
        description: "BFG è progettato come sistema modulare da ASDEA. Ogni funzionalità è un plugin indipendente che può essere attivato o disattivato secondo le tue esigenze."
    },
    {
        icon: Wrench,
        title: "Personalizzazione",
        description: "Componi la tua dashboard ingegneristica scegliendo solo i moduli che ti servono. Ogni progetto può avere una configurazione diversa."
    },
    {
        icon: BarChart3,
        title: "Sviluppo Futuro",
        description: "Nuovi moduli vengono continuamente sviluppati da ASDEA. Potrai espandere le funzionalità del sistema quando saranno disponibili."
    },
    {
        icon: Lightbulb,
        title: "Flessibilità",
        description: "Il sistema si adatta alle tue necessità ingegneristiche, permettendo integrazioni personalizzate e workflow specifici per ogni progetto."
    }
];

export default function DashboardPage() {
    const { data, isLoading, error } = useUserInfo();
    const [currentTip, setCurrentTip] = useState(0);
    const [showWizard, setShowWizard] = useState(true);

    if (isLoading) {
        return (
            <div className="flex justify-center">
                <Skeleton className="h-10 w-48 mt-3" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center">
                <span className="text-red-500 mt-3">
                    Errore nel caricamento dei dati utente.
                </span>
            </div>
        );
    }

    const nextTip = () => {
        setCurrentTip((prev) => (prev + 1) % tips.length);
    };

    const prevTip = () => {
        setCurrentTip((prev) => (prev - 1 + tips.length) % tips.length);
    };

    const closeWizard = () => {
        setShowWizard(false);
    };

    const currentTipData = tips[currentTip];
    const IconComponent = currentTipData.icon;

    return (
        <>
            <div className="flex justify-center">
                <h2 className={`${playfairDisplay.className} text-4xl m-5`}>
                    Benvenuto <i>{data?.username ?? ""}</i>
                </h2>
            </div>

            {showWizard && (
                <div className="flex justify-center mx-10 mb-6">
                    <Card className="w-full max-w-2xl">
                        <CardHeader className="text-center">
                            <div className="flex justify-center mb-4">
                                <IconComponent className="h-12 w-12 text-blue-500" />
                            </div>
                            <CardTitle className="text-2xl">
                                {currentTipData.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription className="text-center text-lg mb-6">
                                {currentTipData.description}
                            </CardDescription>

                            <div className="flex justify-between items-center">
                                <Button
                                    variant="outline"
                                    onClick={prevTip}
                                    disabled={currentTip === 0}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-2" />
                                    Precedente
                                </Button>

                                <div className="flex space-x-2">
                                    {tips.map((_, index) => (
                                        <div
                                            key={index}
                                            className={`h-2 w-2 rounded-full ${
                                                index === currentTip ? 'bg-blue-500' : 'bg-gray-300'
                                            }`}
                                        />
                                    ))}
                                </div>

                                {currentTip === tips.length - 1 ? (
                                    <Button onClick={closeWizard}>
                                        Inizia ad usare BFG
                                    </Button>
                                ) : (
                                    <Button onClick={nextTip}>
                                        Successivo
                                        <ChevronRight className="h-4 w-4 ml-2" />
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {!showWizard && (
                <div className="flex justify-center mx-10">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>
                                Dashboard BFG
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                La tua dashboard ingegneristica modulare è pronta per essere personalizzata. <br />
                                Esplora i moduli disponibili nel menu laterale per iniziare.
                            </CardDescription>
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    );
}