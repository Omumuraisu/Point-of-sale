import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import TransactionDetail from '../components/pos/TransactionDetail';
import { loadSavedTransactions } from '../components/pos/transactionsStore';
import { TransactionRecord } from '../lib/types';

const TransactionDetailRoute = () => {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id?: string | string[] }>();
    const transactionId = useMemo(
        () => (typeof id === 'string' ? id : Array.isArray(id) ? id[0] : ''),
        [id],
    );

    const [transaction, setTransaction] = useState<TransactionRecord | null>(null);

    useEffect(() => {
        let isMounted = true;

        const hydrateTransaction = async () => {
            const allTransactions = await loadSavedTransactions();
            const matched = allTransactions.find((entry) => entry.id === transactionId) ?? null;

            if (isMounted) {
                setTransaction(matched);
            }
        };

        hydrateTransaction();

        return () => {
            isMounted = false;
        };
    }, [transactionId]);

    return (
        <TransactionDetail
            transaction={transaction}
            onBack={() => router.back()}
        />
    );
};

export default TransactionDetailRoute;
