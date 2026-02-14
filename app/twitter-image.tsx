import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Quran Corpus Visualizer – Interactive Quranic linguistic exploration';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function TwitterImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 40%, #16213e 70%, #0f3460 100%)',
                    fontFamily: 'system-ui, sans-serif',
                }}
            >
                {/* Decorative circles */}
                <div
                    style={{
                        position: 'absolute',
                        top: '-100px',
                        right: '-100px',
                        width: '400px',
                        height: '400px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(99,179,237,0.15) 0%, transparent 70%)',
                        display: 'flex',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        bottom: '-80px',
                        left: '-80px',
                        width: '300px',
                        height: '300px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(129,140,248,0.12) 0%, transparent 70%)',
                        display: 'flex',
                    }}
                />

                {/* Arabic bismillah */}
                <div
                    style={{
                        fontSize: 36,
                        color: 'rgba(255,255,255,0.3)',
                        marginBottom: 20,
                        display: 'flex',
                    }}
                >
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                </div>

                {/* Title */}
                <div
                    style={{
                        fontSize: 64,
                        fontWeight: 800,
                        background: 'linear-gradient(90deg, #63b3ed, #818cf8)',
                        backgroundClip: 'text',
                        color: 'transparent',
                        display: 'flex',
                        marginBottom: 16,
                    }}
                >
                    Quran Corpus Visualizer
                </div>

                {/* Subtitle */}
                <div
                    style={{
                        fontSize: 28,
                        color: 'rgba(255,255,255,0.7)',
                        display: 'flex',
                        marginBottom: 40,
                    }}
                >
                    Interactive Quranic Linguistic Exploration
                </div>

                {/* Feature pills */}
                <div
                    style={{
                        display: 'flex',
                        gap: '16px',
                    }}
                >
                    {['Root Networks', 'Morphology', 'Visualizations', 'Arabic & English'].map(
                        (label) => (
                            <div
                                key={label}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: '999px',
                                    border: '1px solid rgba(99,179,237,0.3)',
                                    color: 'rgba(255,255,255,0.8)',
                                    fontSize: 18,
                                    display: 'flex',
                                    background: 'rgba(99,179,237,0.08)',
                                }}
                            >
                                {label}
                            </div>
                        )
                    )}
                </div>

                {/* Domain */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 30,
                        fontSize: 20,
                        color: 'rgba(255,255,255,0.4)',
                        display: 'flex',
                    }}
                >
                    quran.pluragate.org
                </div>
            </div>
        ),
        { ...size }
    );
}
