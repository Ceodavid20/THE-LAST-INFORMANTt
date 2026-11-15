import { useId, type CSSProperties } from 'react';

type PortraitProps = { id: string; name: string; initials: string; mouthOpen?: number; speaking?: boolean; className?: string };
type Design = { skin: string; shadow: string; hair: string; suit: string; shirt: string; tie: string; style: 'crop' | 'bob' | 'wave' | 'curl' | 'slick' | 'part' };

const designs: Record<string, Design> = {
  marcus_vane: { skin: '#c99c7c', shadow: '#805b4d', hair: '#686b65', suit: '#202929', shirt: '#d8d5c9', tie: '#856247', style: 'slick' },
  elena_cross: { skin: '#d4a588', shadow: '#986955', hair: '#282422', suit: '#25312f', shirt: '#d7d4ca', tie: '#747b6e', style: 'bob' },
  victor_hale: { skin: '#b78363', shadow: '#704937', hair: '#252523', suit: '#252c32', shirt: '#c9c8bf', tie: '#555e63', style: 'crop' },
  nadia_sterling: { skin: '#9d674d', shadow: '#5e392f', hair: '#211d1b', suit: '#33302e', shirt: '#d0c9bb', tie: '#75604f', style: 'curl' },
  adrian_cole: { skin: '#d0a382', shadow: '#87624e', hair: '#403b35', suit: '#252d2c', shirt: '#d6d5cc', tie: '#64716c', style: 'part' },
  silas_reed: { skin: '#c39a7d', shadow: '#765648', hair: '#373b3a', suit: '#292d2e', shirt: '#d6d3ca', tie: '#8c694e', style: 'wave' },
};

const hairShape: Record<Design['style'], string> = {
  crop: 'M91 139 C84 102 97 62 133 48 C172 31 224 54 232 98 L226 128 C206 105 187 101 169 106 C143 113 117 114 91 139Z',
  bob: 'M88 145 C77 106 85 67 115 46 C149 21 204 35 226 67 C241 88 241 127 232 154 L224 260 L206 240 L215 130 C194 108 170 104 149 111 C124 119 105 134 97 165Z',
  wave: 'M91 140 C80 104 91 62 128 45 C169 25 220 45 232 86 L228 137 C211 112 198 101 174 105 C147 110 119 125 91 140Z',
  curl: 'M86 147 C69 119 79 72 111 54 C111 34 141 29 155 41 C174 23 202 41 204 52 C233 55 245 93 232 125 C229 158 234 198 221 233 L209 146 C195 117 177 108 159 112 C137 115 112 132 96 163Z',
  slick: 'M91 139 C82 106 91 67 123 48 C157 29 206 37 229 70 C239 85 238 111 231 133 C205 109 190 99 165 103 C136 107 114 123 91 139Z',
  part: 'M92 141 C81 103 94 63 127 46 C162 28 215 41 232 78 C239 96 237 117 228 137 C207 113 190 104 171 105 C142 107 118 123 92 141Z',
};

export default function CharacterPortrait({ id, name, initials, mouthOpen = 0, speaking = false, className = '' }: PortraitProps) {
  const design = designs[id] || designs.marcus_vane;
  const svgId = useId().replaceAll(':', '');
  const audioSync = speaking && mouthOpen > 0.02;
  const skinStyle = { '--skin': design.skin, '--skin-shadow': design.shadow, '--hair': design.hair, '--suit': design.suit, '--shirt': design.shirt, '--tie': design.tie } as CSSProperties;

  return <div className={`character-portrait ${className} ${speaking ? 'talking' : ''} ${audioSync ? 'audio-sync' : ''}`} style={skinStyle} role="img" aria-label={`Animated fictional mugshot of ${name}`}>
    <svg viewBox="0 0 320 390" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`face-${svgId}`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="var(--skin)"/><stop offset=".68" stopColor="var(--skin)"/><stop offset="1" stopColor="var(--skin-shadow)"/></linearGradient>
        <linearGradient id={`shirt-${svgId}`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="var(--shirt)"/><stop offset="1" stopColor="#8f918b"/></linearGradient>
        <linearGradient id={`coat-${svgId}`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="var(--suit)"/><stop offset="1" stopColor="#11191a"/></linearGradient>
        <radialGradient id={`light-${svgId}`} cx=".48" cy=".27" r=".72"><stop stopColor="#fff" stopOpacity=".23"/><stop offset="1" stopColor="#000" stopOpacity=".3"/></radialGradient>
      </defs>
      <ellipse cx="160" cy="394" rx="137" ry="32" fill="#090c0d" opacity=".8"/>
      <path d="M42 389 C48 314 71 276 121 260 L199 260 C249 277 272 314 279 389Z" fill={`url(#coat-${svgId})`}/>
      <path d="M123 259 L160 294 L197 259 L215 389 L105 389Z" fill={`url(#shirt-${svgId})`}/>
      <path d="M149 292 L160 306 L171 292 L179 389 L141 389Z" fill="var(--tie)"/>
      <path d="M119 254 L160 292 L140 326 L103 278Z" fill="#c8c6bb" opacity=".6"/>
      <path d="M201 254 L160 292 L181 326 L218 278Z" fill="#aaa99f" opacity=".55"/>
      <path className="portrait-neck" d="M131 217 L129 277 Q158 302 191 277 L188 215Z" fill={`url(#face-${svgId})`}/>
      <ellipse cx="95" cy="163" rx="13" ry="24" fill="var(--skin-shadow)"/>
      <ellipse cx="225" cy="163" rx="13" ry="24" fill="var(--skin-shadow)"/>
      <ellipse className="portrait-head" cx="160" cy="157" rx="68" ry="91" fill={`url(#face-${svgId})`}/>
      <path d="M104 148 Q129 128 148 141" fill="none" stroke="var(--skin-shadow)" strokeOpacity=".42" strokeWidth="4"/>
      <path d="M172 141 Q194 129 216 148" fill="none" stroke="var(--skin-shadow)" strokeOpacity=".42" strokeWidth="4"/>
      <g className="portrait-eyes">
        <path d="M119 158 Q136 146 151 159 Q136 170 119 158Z" fill="#ece2d3"/>
        <path d="M169 159 Q185 146 201 158 Q185 170 169 159Z" fill="#ece2d3"/>
        <ellipse cx="136" cy="158" rx="4.5" ry="6" fill="#34302b"/><ellipse cx="185" cy="158" rx="4.5" ry="6" fill="#34302b"/>
        <circle cx="137" cy="156" r="1.5" fill="#fff"/><circle cx="186" cy="156" r="1.5" fill="#fff"/>
      </g>
      <path d="M115 146 Q135 135 153 144" fill="none" stroke="var(--hair)" strokeWidth="5" strokeLinecap="round"/>
      <path d="M168 144 Q188 135 205 146" fill="none" stroke="var(--hair)" strokeWidth="5" strokeLinecap="round"/>
      <path d="M161 157 Q155 182 149 191 Q159 198 171 192" fill="none" stroke="var(--skin-shadow)" strokeOpacity=".63" strokeWidth="4" strokeLinecap="round"/>
      <path d="M135 211 Q160 221 185 210" fill="none" stroke="var(--skin-shadow)" strokeOpacity=".48" strokeWidth="3" strokeLinecap="round"/>
      <g className="portrait-mouth" transform={speaking && mouthOpen > 0 ? `translate(160 204) scale(1 ${.25 + Math.min(1, Math.max(0, mouthOpen)) * 1.15}) translate(-160 -204)` : undefined}>
        <ellipse cx="160" cy="204" rx="17" ry="9" fill="#512820"/>
        <path d="M143 204 Q160 198 177 204" fill="none" stroke="#864f49" strokeWidth="3" strokeLinecap="round"/>
      </g>
      <path d={hairShape[design.style]} fill="var(--hair)"/>
      <path d="M101 130 Q105 88 141 60" fill="none" stroke="#ffffff" strokeOpacity=".12" strokeWidth="5" strokeLinecap="round"/>
      <rect width="320" height="390" fill={`url(#light-${svgId})`}/>
    </svg>
    <span className="portrait-id">{initials}</span>
  </div>;
}
