import Login from '../components/login/login';
import { Redirect } from 'expo-router';
import { useAuthSession } from '../lib/authSession';

export default function Index() {
    const { currentUser, isHydrating } = useAuthSession();

    if (isHydrating) {
        return null;
    }

    if (currentUser) {
        return <Redirect href="/(tabs)/home" />;
    }

    return <Login />;
}
