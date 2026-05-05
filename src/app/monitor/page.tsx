import dynamic from 'next/dynamic';

const FacePhysMonitor = dynamic(() => import('@/components/FacePhysMonitor'), {
    ssr: false,
    loading: () => (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#F0F3F8' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#475569', fontWeight: 600 }}>
                Initializing Medical Interface...
            </p>
        </div>
    )
});

export default function MonitorPage() {
    return (
        <main>
            <FacePhysMonitor />
        </main>
    );
}
