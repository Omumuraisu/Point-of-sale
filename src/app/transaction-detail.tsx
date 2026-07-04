import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import TransactionDetail from '../components/pos/TransactionDetail';
import { loadSavedTransactions } from '../components/pos/transactionsStore';
import { TransactionRecord } from '../lib/types';
import { useAuthSession } from '../lib/authSession';
import { loadRemoteSalesTransactions } from '../lib/transactionsSync';

const TransactionDetailRoute = () => {
    const router = useRouter();
    const { currentUser } = useAuthSession();
    const { id } = useLocalSearchParams<{ id?: string | string[] }>();
    const transactionId = useMemo(
        () => (typeof id === 'string' ? id : Array.isArray(id) ? id[0] : ''),
        [id],
    );

    const [transaction, setTransaction] = useState<TransactionRecord | null>(null);

    useEffect(() => {
        let isMounted = true;

        const hydrateTransaction = async () => {
            const localTransactions = await loadSavedTransactions(currentUser?.accountId);
            const remoteTransactions = await loadRemoteSalesTransactions(currentUser?.accountId);
            const unsyncedLocalTransactions = localTransactions.filter((transaction) => !transaction.synced);
            const allTransactions = [...unsyncedLocalTransactions, ...remoteTransactions];
            const matched = allTransactions.find((entry) => entry.id === transactionId) ?? null;

            if (isMounted) {
                setTransaction(matched);
            }
        };

        hydrateTransaction();

        return () => {
            isMounted = false;
        };
    }, [currentUser?.accountId, transactionId]);

    return (
        <TransactionDetail
            transaction={transaction}
            onBack={() => router.back()}
        />
    );
};

export default TransactionDetailRoute;
