import { isSupabaseConfigured, supabase } from './supabase';

export type NotificationStatus = 'unread' | 'read';

export interface MobileNotification {
    notificationId: number;
    recipientType: string;
    recipientAccountId: number;
    businessOwnerId: number;
    businessId: number;
    stallNumber: string;
    billingCycleId: number;
    billingMonth: string;
    notificationType: string;
    title: string;
    message: string;
    status: NotificationStatus;
    createdAt: string;
    readAt: string | null;
}

interface NotificationRow {
    notification_id: number;
    recipient_type: string;
    recipient_account_id: number;
    business_owner_id: number;
    business_id: number;
    stall_number: string;
    billing_cycle_id: number;
    billing_month: string;
    notification_type: string;
    title: string;
    message: string;
    status: NotificationStatus;
    created_at: string;
    read_at: string | null;
}

const NOTIFICATION_COLUMNS = [
    'notification_id',
    'recipient_type',
    'recipient_account_id',
    'business_owner_id',
    'business_id',
    'stall_number',
    'billing_cycle_id',
    'billing_month',
    'notification_type',
    'title',
    'message',
    'status',
    'created_at',
    'read_at',
].join(', ');

const toMobileNotification = (row: NotificationRow): MobileNotification => ({
    notificationId: row.notification_id,
    recipientType: row.recipient_type,
    recipientAccountId: row.recipient_account_id,
    businessOwnerId: row.business_owner_id,
    businessId: row.business_id,
    stallNumber: row.stall_number,
    billingCycleId: row.billing_cycle_id,
    billingMonth: row.billing_month,
    notificationType: row.notification_type,
    title: row.title,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    readAt: row.read_at,
});

export const fetchNotifications = async (
    accountId?: number,
    status?: NotificationStatus,
): Promise<MobileNotification[]> => {
    if (!accountId || !isSupabaseConfigured || !supabase) {
        return [];
    }

    let query = supabase
        .from('notifications')
        .select(NOTIFICATION_COLUMNS)
        .eq('recipient_account_id', accountId)
        .eq('recipient_type', 'business_owner')
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error || !data) {
        if (__DEV__ && error) {
            console.error('[NOTIFICATIONS_DEBUG] Failed to fetch notifications:', error.message);
        }

        return [];
    }

    return (data as unknown as NotificationRow[]).map(toMobileNotification);
};

export const fetchUnreadNotificationCount = async (accountId?: number): Promise<number> => {
    if (!accountId || !isSupabaseConfigured || !supabase) {
        return 0;
    }

    const { count, error } = await supabase
        .from('notifications')
        .select('notification_id', { count: 'exact', head: true })
        .eq('recipient_account_id', accountId)
        .eq('recipient_type', 'business_owner')
        .eq('status', 'unread');

    if (error) {
        if (__DEV__) {
            console.error('[NOTIFICATIONS_DEBUG] Failed to fetch unread count:', error.message);
        }

        return 0;
    }

    return count ?? 0;
};

export const markNotificationAsRead = async (notificationId: number, accountId?: number): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
        return false;
    }

    let query = supabase
        .from('notifications')
        .update({
            status: 'read',
            read_at: new Date().toISOString(),
        })
        .eq('notification_id', notificationId)
        .eq('recipient_type', 'business_owner');

    if (accountId) {
        query = query.eq('recipient_account_id', accountId);
    }

    const { error } = await query;

    if (error) {
        if (__DEV__) {
            console.error('[NOTIFICATIONS_DEBUG] Failed to mark notification as read:', error.message);
        }

        return false;
    }

    return true;
};
