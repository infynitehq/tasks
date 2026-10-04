import { ImageResponse } from 'next/og'

export const alt = 'Tasks — A minimal, local-first daily todo app by Soham Datta'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: '80px',
          background: '#faf9f6',
          color: '#222222',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <svg
            width="88"
            height="88"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#222222"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 5h8" />
            <path d="M13 12h8" />
            <path d="M13 19h8" />
            <path d="m3 17 2 2 4-4" />
            <rect x="3" y="4" width="6" height="6" rx="1" />
          </svg>
          <div style={{ display: 'flex', fontSize: 100, fontWeight: 700 }}>tasks<span style={{ color: '#d10001' }}>.</span></div>
        </div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 42 }}>
          A small space for everything on your mind.
        </div>
        <div style={{ display: 'flex', marginTop: 32, fontSize: 26, color: '#666666' }}>
          Minimal. Local-first. Powered by WebRTC.
        </div>
        <div style={{ display: 'flex', marginTop: 16, fontSize: 26, color: '#666666' }}>
          Built by Soham Datta.
        </div>
      </div>
    ),
    size,
  )
}
