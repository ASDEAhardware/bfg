"use client";
import React, { useState } from "react";
import { useUserInfo } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Lightbulb, Puzzle, Wrench, BarChart3 } from "lucide-react";

import { Playfair_Display } from 'next/font/google';

import { useTranslations } from 'next-intl';


const playfairDisplay = Playfair_Display({ subsets: ['latin'] });


export default function DashboardPage() {
    const { data, isLoading, error } = useUserInfo();
    const [currentTip, setCurrentTip] = useState(0);
    const [showWizard, setShowWizard] = useState(true);

    const t = useTranslations('dashboard');

    const tips = [
        {
            icon: Puzzle,
            title: t('wizard.tips.modularity.title'),
            description: t('wizard.tips.modularity.description'),
        },
        {
            icon: Wrench,
            title: t('wizard.tips.customization.title'),
            description: t('wizard.tips.customization.description'),
        },
        {
            icon: BarChart3,
            title: t('wizard.tips.development.title'),
            description: t('wizard.tips.development.description'), 
        },
        {
            icon: Lightbulb,
            title: t('wizard.tips.flexibility.title'),
            description: t('wizard.tips.flexibility.description'),
        }
    ];

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
                    {t('loading_error')}
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
                    {t('welcome')} <i>{data?.username ?? ""}</i>
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
                                    {t('wizard.previous_button')}
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
                                        {t('wizard.start_button')}
                                    </Button>
                                ) : (
                                    <Button onClick={nextTip}>
                                        {t('wizard.next_button')}
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
                                {t('main.title')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>
                                {t('main.description')}
                            </CardDescription>
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    );
}