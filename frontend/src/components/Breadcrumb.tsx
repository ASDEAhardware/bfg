'use client';

import { usePathname } from 'next/navigation';
import {
    Breadcrumb as BreadcrumbComponent,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from './ui/breadcrumb';

export default function Breadcrumb() {
    const pathname = usePathname();
    const pathSegments = pathname.split('/').filter(Boolean);

    // Mappa per titoli personalizzati
    const segmentTitles: Record<string, string> = {
        'datalogger': 'Data Logger',
        'dashboard': 'Dashboard',
        'staff-admin': 'Admin Panel',
        'system': 'System Config'
    };

    return (
        <BreadcrumbComponent>
            <BreadcrumbList>
                {pathSegments.map((segment, index) => {
                    const href = `/${pathSegments.slice(0, index + 1).join('/')}`;
                    const isLast = index === pathSegments.length - 1;
                    const segmentTitle = segmentTitles[segment] ||
                                        segment.charAt(0).toUpperCase() + segment.slice(1);

                    return (
                        <div key={href} className="flex items-center">
                            <BreadcrumbItem>
                                {isLast ? (
                                    <BreadcrumbPage>{segmentTitle}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink href={href}>
                                        {segmentTitle}
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {!isLast && <BreadcrumbSeparator />}
                        </div>
                    );
                })}
            </BreadcrumbList>
        </BreadcrumbComponent>
    );
}
    
