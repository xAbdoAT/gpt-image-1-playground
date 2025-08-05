'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ModeToggleProps = {
    currentMode: 'generate' | 'edit';
    onModeChange: (mode: 'generate' | 'edit') => void;
};

export function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
    return (
        <Tabs
            value={currentMode}
            onValueChange={(value) => onModeChange(value as 'generate' | 'edit')}
            className='w-full md:w-auto'>
            <TabsList className='grid h-auto w-full grid-cols-2 gap-1 rounded-md border-none bg-transparent p-0 md:w-auto'>
                <TabsTrigger
                    value='generate'
                    className={`rounded-md border px-2 py-1 text-xs transition-colors md:px-3 md:text-sm ${
                        currentMode === 'generate'
                            ? 'border-white bg-white text-black'
                            : 'border-dashed border-white/30 bg-transparent text-white/60 hover:border-white/50 hover:text-white/80'
                    } `}>
                    Generate
                </TabsTrigger>
                <TabsTrigger
                    value='edit'
                    className={`rounded-md border px-2 py-1 text-xs transition-colors md:px-3 md:text-sm ${
                        currentMode === 'edit'
                            ? 'border-white bg-white text-black'
                            : 'border-dashed border-white/30 bg-transparent text-white/60 hover:border-white/50 hover:text-white/80'
                    } `}>
                    Edit
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
