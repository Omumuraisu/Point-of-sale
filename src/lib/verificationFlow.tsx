import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';

import type { VerificationPurpose } from './authFlow';

type VerificationStage = 'otp' | 'password';
export type VerificationOrigin = 'activation' | 'forgot-password' | 'security' | 'developer-test';

export interface VerificationFlow {
    phone: string;
    purpose: VerificationPurpose;
    origin: VerificationOrigin;
    stage: VerificationStage;
}

interface VerificationFlowContextValue {
    flow: VerificationFlow | null;
    startFlow: (phone: string, purpose: VerificationPurpose, origin: VerificationOrigin) => void;
    markOtpVerified: () => void;
    clearFlow: () => void;
}

const VerificationFlowContext = createContext<VerificationFlowContextValue | null>(null);

export const VerificationFlowProvider = ({ children }: { children: ReactNode }) => {
    const [flow, setFlow] = useState<VerificationFlow | null>(null);

    const value = useMemo<VerificationFlowContextValue>(() => ({
        flow,
        startFlow: (phone, purpose, origin) => setFlow({ phone, purpose, origin, stage: 'otp' }),
        markOtpVerified: () => setFlow((current) => (
            current ? { ...current, stage: 'password' } : null
        )),
        clearFlow: () => setFlow(null),
    }), [flow]);

    return (
        <VerificationFlowContext.Provider value={value}>
            {children}
        </VerificationFlowContext.Provider>
    );
};

export const useVerificationFlow = () => {
    const context = useContext(VerificationFlowContext);
    if (!context) {
        throw new Error('useVerificationFlow must be used within VerificationFlowProvider');
    }
    return context;
};
