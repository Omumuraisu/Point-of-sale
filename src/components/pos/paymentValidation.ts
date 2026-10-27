export interface PaymentChangeResult {
    isValid: boolean;
    changeAmount: number;
}

export const calculatePaymentChange = (totalDue: number, paidAmount: number): PaymentChangeResult => {
    const isValid = Number.isFinite(totalDue)
        && totalDue > 0
        && Number.isFinite(paidAmount)
        && paidAmount >= totalDue;

    return {
        isValid,
        changeAmount: isValid ? paidAmount - totalDue : 0,
    };
};
