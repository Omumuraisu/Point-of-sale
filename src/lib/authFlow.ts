export type VerificationPurpose = 'activation' | 'recovery';

type VerificationDebugLevel = 'info' | 'warn';

export const logVerificationDebug = (
    stage: string,
    details: Record<string, unknown> = {},
    level: VerificationDebugLevel = 'info',
): void => {
    if (!__DEV__) return;
    const message = `[ACCOUNT_VERIFICATION] ${stage}`;
    if (level === 'warn') {
        console.warn(message, details);
    } else {
        console.info(message, details);
    }
};

export const normalizePhilippinePhone = (value: string): string => {
    const digits = value.replace(/\D/g, '');

    if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
    if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
    if (/^639\d{9}$/.test(digits)) return `+${digits}`;

    return '';
};

export const maskPhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 4
        ? `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
        : 'your phone';
};

export const isStrongPassword = (password: string): boolean => (
    password.length >= 8
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
);

type FunctionErrorBody = {
    error?: {
        message?: string;
        retry_after_seconds?: number;
        reason?: string;
        debug_id?: string;
    };
};

export const readFunctionError = async (
    error: unknown,
    fallback: string,
): Promise<{
    message: string;
    retryAfterSeconds: number;
    reason: string | null;
    debugId: string | null;
}> => {
    const functionError = error as { message?: string; context?: Response } | null;
    let body: FunctionErrorBody | null = null;

    if (functionError?.context) {
        try {
            body = await functionError.context.clone().json() as FunctionErrorBody;
        } catch {
            body = null;
        }
    }

    return {
        message: body?.error?.message ?? functionError?.message ?? fallback,
        retryAfterSeconds: body?.error?.retry_after_seconds ?? 0,
        reason: body?.error?.reason ?? null,
        debugId: body?.error?.debug_id ?? null,
    };
};
