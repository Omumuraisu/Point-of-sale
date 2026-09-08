import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';

import type { VerificationPurpose } from './authFlow';

type VerificationStage = 'otp' | 'password';

export interface VerificationFlow {
    phone: string;
    purpose: VerificationPurpose;
    stage: VerificationStage;
}

interface VerificationFlowContextValue {
    flow: VerificationFlow | null;
    startFlow: (phone: string, purpose: VerificationPurpose) => void;
    markOtpVerified: () => void;
    clearFlow: () => void;
}

const VerificationFlowContext = createContext<VerificationFlowContextValue | null>(null);

export const VerificationFlowProvider = ({ children }: { children: ReactNode }) => {
    const [flow, setFlow] = useState<VerificationFlow | null>(null);

    const value = useMemo<VerificationFlowContextValue>(() => ({
        flow,
        startFlow: (phone, purpose) => setFlow({ phone, purpose, stage: 'otp' }),
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
