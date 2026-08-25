import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Redirect } from 'expo-router';
import Login from '../components/login/login';
import { useAuthSession } from '../lib/authSession';

export default function Index() {
    const { currentUser, isHydrating } = useAuthSession();
    const [startupFinished, setStartupFinished] = useState(false);

    if (isHydrating) return null;
    if (currentUser) return <Redirect href="/(tabs)/home" />;
    if (!startupFinished) return <StartupVideo onFinished={() => setStartupFinished(true)} />;
    return <Login />;
}

function StartupVideo({ onFinished }: { onFinished: () => void }) {
    const player = useVideoPlayer(require('../../assets/pos-startup.mp4'), (videoPlayer) => {
        videoPlayer.loop = false;
        videoPlayer.muted = true;
        videoPlayer.play();
    });

    useEventListener(player, 'playToEnd', onFinished);
    useEventListener(player, 'statusChange', ({ status }) => {
        if (status === 'error') onFinished();
    });

    return (
        <View style={startupStyles.screen}>
            <VideoView player={player} style={startupStyles.video} contentFit="cover" nativeControls={false} />
        </View>
    );
}

const startupStyles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#f0f2ff' },
    video: { flex: 1 },
});
