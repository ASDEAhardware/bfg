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
    const pathSegments = pathname.split('/').filter(Boolean); // Dividiamo l'URL in segmenti

    return (
        <BreadcrumbComponent>
            <BreadcrumbList>
                {pathSegments.map((segment, index) => {
                    const href = `/${pathSegments.slice(0, index + 1).join('/')}`;
                    const isLast = index === pathSegments.length - 1;
                    const segmentTitle = segment === 'datalogger' ? 'Data Logger' :
                                        segment.charAt(0).toUpperCase() + segment.slice(1);

                    return (
                        <div key={href} className="flex items-center">
                            <BreadcrumbItem className="hidden md:block">
                                {isLast ? (
                                    <BreadcrumbPage>{segmentTitle}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink href={href}>
                                        {segmentTitle}
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
                        </div>
                    );
                })}
            </BreadcrumbList>
        </BreadcrumbComponent>
    );
}
    
