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
        setTransaction(null);

        const hydrateTransaction = async () => {
            if (!currentUser?.accountId || !currentUser.businessId) {
                return;
            }
            const scope = { accountId: currentUser.accountId, businessId: currentUser.businessId };
            const localTransactions = await loadSavedTransactions(scope);
            const remoteTransactions = await loadRemoteSalesTransactions({ businessId: scope.businessId });
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
    }, [currentUser?.accountId, currentUser?.businessId, transactionId]);

    return (
        <TransactionDetail
            transaction={transaction}
            onBack={() => router.back()}
        />
    );
};

export default TransactionDetailRoute;
