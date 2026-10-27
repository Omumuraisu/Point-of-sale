import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';

import type { VerificationChannel, VerificationPurpose } from './authFlow';

type VerificationStage = 'otp' | 'password';
export type VerificationOrigin = 'activation' | 'forgot-password' | 'security' | 'developer-test';

export interface VerificationFlow {
    identifier: string;
    channel: VerificationChannel;
    purpose: VerificationPurpose;
    origin: VerificationOrigin;
    stage: VerificationStage;
    verifiedAccessToken: string | null;
}

interface VerificationFlowContextValue {
    flow: VerificationFlow | null;
    startFlow: (identifier: string, channel: VerificationChannel, purpose: VerificationPurpose, origin: VerificationOrigin) => void;
    markOtpVerified: (accessToken: string) => void;
    clearFlow: () => void;
}

const VerificationFlowContext = createContext<VerificationFlowContextValue | null>(null);

export const VerificationFlowProvider = ({ children }: { children: ReactNode }) => {
    const [flow, setFlow] = useState<VerificationFlow | null>(null);

    const value = useMemo<VerificationFlowContextValue>(() => ({
        flow,
        startFlow: (identifier, channel, purpose, origin) => setFlow({
            identifier,
            channel,
            purpose,
            origin,
            stage: 'otp',
            verifiedAccessToken: null,
        }),
        markOtpVerified: (accessToken) => setFlow((current) => (
            current ? { ...current, stage: 'password', verifiedAccessToken: accessToken } : null
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
