"use client";
import React from "react";
import { useUserInfo } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Playfair_Display } from 'next/font/google';
import DynamicSiteMap from "@/components/map/DynamicSiteMap";

const playfairDisplay = Playfair_Display({ subsets: ['latin'] });

export default function DashboardPage() {
    const { data, isLoading, error } = useUserInfo();

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

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-center">
                <h2 className={`${playfairDisplay.className} text-4xl m-5`}>
                    Benvenuto <i>{data?.username ?? ""}</i>
                </h2>
            </div>

            <div className="flex-grow p-4">
                <DynamicSiteMap />
            </div>
        </div>
    );
}