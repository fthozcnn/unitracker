import React from 'react'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={`animate-pulse rounded-md bg-gray-200/50 dark:bg-gray-800/50 ${className}`}
            {...props}
        />
    )
}

// Preset: Dashboard or general stat cards
export function CardSkeleton() {
    return (
        <div className="p-4 md:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-6 w-1/2" />
                </div>
            </div>
        </div>
    )
}

// Preset: Lists like Leaderboard, Friends, Assignments
export function ListSkeleton() {
    return (
        <div className="space-y-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4 p-3 border border-transparent rounded-xl">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    )
}

// Preset: Badge showcase items
export function GridSkeleton() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="p-4 border rounded-2xl bg-white dark:bg-gray-800 shadow-sm flex flex-col items-center">
                    <Skeleton className="h-16 w-16 text-3xl mb-3 rounded-full" />
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-3 w-32" />
                </div>
            ))}
        </div>
    )
}
