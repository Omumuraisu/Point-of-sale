import type { MobileNotification } from './mobileNotifications';

export type NotificationType = 'warning' | 'alert' | 'danger' | 'success';

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

const formatBillingMonthLabel = (value: string | null) => {
    if (!value) return null;
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? value : MONTH_FORMATTER.format(date);
};

export const formatNotificationTitle = (notification: MobileNotification) => {
    if (notification.notificationType === 'vendor_compliance_requested') {
        return notification.title || 'Vendor compliance request';
    }
    if (notification.notificationType === 'billing_payment_reminder') {
        const month = formatBillingMonthLabel(notification.billingMonth);
        const title = notification.title || 'Billing payment reminder';
        return month ? `${title} - ${month}` : title;
    }
    if (notification.notificationType === 'billing_submitted') {
        const month = formatBillingMonthLabel(notification.billingMonth);
        return month ? `Monthly Bill - ${month}` : 'Monthly Bill';
    }
    const titles: Record<string, string> = {
        billing_due_soon: 'Bill Due Soon',
        billing_due_today: 'Bill Due Today',
        billing_overdue: 'Billing Overdue',
    };
    const title = titles[notification.notificationType];
    if (!title) return notification.title;
    const month = formatBillingMonthLabel(notification.billingMonth);
    return month ? `${title} - ${month}` : title;
};

export const getNotificationType = (notification: MobileNotification): NotificationType => {
    if (notification.notificationType === 'billing_overdue') return 'danger';
    if (
        notification.notificationType === 'vendor_compliance_requested'
        || notification.notificationType === 'billing_payment_reminder'
        || notification.notificationType === 'billing_due_today'
    ) return 'warning';
    return 'alert';
};

export const getReadNotificationAction = (notification: MobileNotification) => (
    [
        'billing_submitted',
        'billing_payment_reminder',
        'billing_due_soon',
        'billing_due_today',
        'billing_overdue',
    ].includes(notification.notificationType) ? 'View Bill' : undefined
);

export const getBillNavigationParams = (notification: MobileNotification) => ({
    ...(notification.billingCycleId ? { billingCycleId: String(notification.billingCycleId) } : {}),
    ...(notification.billingMonth ? { billingMonth: notification.billingMonth } : {}),
});
