import { ImageResponse } from "next/og";

export const alt = "Quran Observatory - Interactive Quranic linguistic exploration";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a1013 0%, #0e161a 45%, #142026 78%, #1a2b33 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(86,166,151,0.16) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-80px",
            left: "-80px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(232,146,74,0.12) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            background: "linear-gradient(90deg, #56a697, #e8924a)",
            backgroundClip: "text",
            color: "transparent",
            display: "flex",
            marginBottom: 20,
          }}
        >
          Quran Observatory
        </div>
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.7)",
            display: "flex",
            marginBottom: 40,
          }}
        >
          Interactive Quranic Linguistic Exploration
        </div>
        <div
          style={{
            display: "flex",
            gap: "16px",
          }}
        >
          {["Root Networks", "Morphology", "Visualizations", "Arabic and English"].map((label) => (
            <div
              key={label}
              style={{
                padding: "10px 24px",
                borderRadius: "999px",
                border: "1px solid rgba(86,166,151,0.35)",
                color: "rgba(255,255,255,0.8)",
                fontSize: 18,
                display: "flex",
                background: "rgba(86,166,151,0.1)",
              }}
            >
              {label}
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 30,
            fontSize: 20,
            color: "rgba(255,255,255,0.4)",
            display: "flex",
          }}
        >
          quranobservatory.org
        </div>
      </div>
    ),
    { ...size }
  );
}
