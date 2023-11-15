import React from 'react';
interface NotFoundBoundaryProps {
    notFound?: React.ReactNode;
    notFoundStyles?: React.ReactNode;
    asNotFound?: boolean;
    children: React.ReactNode;
}
export declare function NotFoundBoundary({ notFound, notFoundStyles, asNotFound, children, }: NotFoundBoundaryProps): React.JSX.Element;
export {};
