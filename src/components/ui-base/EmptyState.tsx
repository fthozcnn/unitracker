import React from 'react'

interface EmptyStateProps {
    icon: React.ElementType;
    title: string;
    description: string;
    action?: React.ReactNode;
    color?: 'blue' | 'indigo' | 'purple' | 'orange' | 'green' | 'gray';
}

export function EmptyState({ icon: Icon, title, description, action, color = 'gray' }: EmptyStateProps) {
    const colorStyles = {
        gray: 'bg-gray-100 dark:bg-gray-800 text-gray-500',
        blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-500',
        indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500',
        purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-500',
        orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-500',
        green: 'bg-green-100 dark:bg-green-900/30 text-green-500'
    }

    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            {/* Glossy / Soft Icon Container */}
            <div className={`p-4 rounded-3xl mb-4 ${colorStyles[color]} relative group transition-transform duration-500 hover:scale-105`}>
                <div className={`absolute inset-0 bg-current opacity-20 blur-xl rounded-full`} />
                <Icon className="h-10 w-10 relative z-10" />
            </div>

            {/* Content */}
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
            <p className="text-sm text-gray-500 max-w-[280px] leading-relaxed mb-6">
                {description}
            </p>

            {/* Optional Call to Action */}
            {action && (
                <div className="mt-2">
                    {action}
                </div>
            )}
        </div>
    )
}
