type SyncListener = () => void;

const listeners = new Set<SyncListener>();

export const subscribeToTransactionSyncEvents = (listener: SyncListener) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

export const notifyTransactionSyncChanged = () => {
    listeners.forEach((listener) => listener());
};
