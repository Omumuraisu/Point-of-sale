import {
    formatNotificationTitle,
    getBillNavigationParams,
    getNotificationType,
    getReadNotificationAction,
} from '../src/lib/notificationPresentation';
import type { MobileNotification } from '../src/lib/mobileNotifications';

const notification = (notificationType: string): MobileNotification => ({
    notificationId: 1,
    recipientType: 'business_owner',
    recipientAccountId: 10,
    businessOwnerId: 20,
    businessId: 30,
    stallNumber: 'A-1',
    billingCycleId: 40,
    billingMonth: '2026-10-01',
    notificationType,
    title: '',
    message: 'Message',
    status: 'read',
    createdAt: '2026-10-01T08:00:00',
    readAt: '2026-10-02T08:00:00',
});

describe('billing notification presentation', () => {
    test.each([
        ['billing_submitted', 'Monthly Bill', 'alert'],
        ['billing_payment_reminder', 'Billing payment reminder', 'warning'],
        ['billing_due_soon', 'Bill Due Soon', 'alert'],
        ['billing_due_today', 'Bill Due Today', 'warning'],
        ['billing_overdue', 'Billing Overdue', 'danger'],
        ['billing_payment_received', 'Payment Received', 'success'],
        ['billing_paid', 'Bill Paid', 'success'],
    ])('%s gets a title, style, and View Bill action', (type, title, style) => {
        const item = notification(type);
        expect(formatNotificationTitle(item)).toContain(title);
        expect(getNotificationType(item)).toBe(style);
        expect(getReadNotificationAction(item)).toBe('View Bill');
    });

    test('preserves compliance behavior outside billing actions', () => {
        expect(getReadNotificationAction(notification('vendor_compliance_requested'))).toBeUndefined();
    });

    test('passes authoritative cycle and month context to Rent navigation', () => {
        expect(getBillNavigationParams(notification('billing_submitted'))).toEqual({
            billingCycleId: '40',
            billingMonth: '2026-10-01',
        });
    });
});
