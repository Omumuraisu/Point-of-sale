import { isSupabaseConfigured, supabase } from './supabase';

export interface WeeklySalesPattern {
    runId: string;
    dayOfWeek: string;
    dowIndex: number;
    totalQuantityKg: number;
    totalRevenuePhp: number;
    avgDailyQtyKg: number;
    avgDailyRevPhp: number;
    recordCount: number;
    isWeekend: boolean;
    generatedAt: string;
}

interface WeeklySalesPatternRow {
    run_id: string | number;
    day_of_week: string;
    dow_index: number;
    total_quantity_kg: number | string;
    total_revenue_php: number | string;
    avg_daily_qty_kg: number | string;
    avg_daily_rev_php: number | string;
    record_count: number;
    is_weekend: boolean;
    generated_at: string;
}

export interface WeeklySalesPatternResult {
    data: WeeklySalesPattern[];
    error: boolean;
}

const DAY_ORDER: Record<string, number> = {
    monday: 0,
    mon: 0,
    tuesday: 1,
    tue: 1,
    tues: 1,
    wednesday: 2,
    wed: 2,
    thursday: 3,
    thu: 3,
    thur: 3,
    thurs: 3,
    friday: 4,
    fri: 4,
    saturday: 5,
    sat: 5,
    sunday: 6,
    sun: 6,
};

const CALENDAR_DAY_LABELS = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
];

const toNumber = (value: number | string): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toWeeklySalesPattern = (row: WeeklySalesPatternRow): WeeklySalesPattern => {
    const normalizedDay = row.day_of_week.trim().toLowerCase();
    const calendarIndex = DAY_ORDER[normalizedDay];

    return {
        runId: String(row.run_id),
        dayOfWeek: CALENDAR_DAY_LABELS[calendarIndex] ?? row.day_of_week,
        dowIndex: Number(row.dow_index),
        totalQuantityKg: toNumber(row.total_quantity_kg),
        totalRevenuePhp: toNumber(row.total_revenue_php),
        avgDailyQtyKg: toNumber(row.avg_daily_qty_kg),
        avgDailyRevPhp: toNumber(row.avg_daily_rev_php),
        recordCount: Number(row.record_count) || 0,
        isWeekend: Boolean(row.is_weekend),
        generatedAt: row.generated_at,
    };
};

export const loadWeeklySalesPatterns = async (): Promise<WeeklySalesPatternResult> => {
    if (!isSupabaseConfigured || !supabase) {
        return { data: [], error: true };
    }

    const { data, error } = await supabase
        .from('hw_latest_weekly_patterns')
        .select(`
            run_id,
            day_of_week,
            dow_index,
            total_quantity_kg,
            total_revenue_php,
            avg_daily_qty_kg,
            avg_daily_rev_php,
            record_count,
            is_weekend,
            generated_at
        `)
        .order('dow_index', { ascending: true });

    if (error || !data) {
        if (__DEV__) {
            console.error('[WEEKLY_PATTERNS] Unable to load weekly sales patterns:', error);
        }

        return { data: [], error: true };
    }

    const patterns = (data as WeeklySalesPatternRow[])
        .map(toWeeklySalesPattern)
        .sort((first, second) => {
            const firstOrder = DAY_ORDER[first.dayOfWeek.trim().toLowerCase()] ?? first.dowIndex;
            const secondOrder = DAY_ORDER[second.dayOfWeek.trim().toLowerCase()] ?? second.dowIndex;
            return firstOrder - secondOrder;
        });

    return { data: patterns, error: false };
};

export const verifyHoltWintersReadAccess = async (): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
        return false;
    }

    const [{ error: patternsError }, { error: runsError }] = await Promise.all([
        supabase.from('hw_latest_weekly_patterns').select('run_id').limit(1),
        supabase.from('hw_forecast_runs').select('status').limit(1),
    ]);

    if (patternsError || runsError) {
        if (__DEV__) {
            console.error('[WEEKLY_PATTERNS] Read permission verification failed:', {
                weeklyPatterns: patternsError,
                forecastRuns: runsError,
            });
        }

        return false;
    }

    return true;
};
