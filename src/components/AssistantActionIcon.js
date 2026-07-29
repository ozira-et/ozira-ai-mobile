import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// A deliberately small monochrome outline set for the assistant action row.
// Every glyph shares ChatGPT's rounded 1.8px visual weight.
export default function AssistantActionIcon({ name, color, size = 18, strokeWidth = 1.7 }) {
  const common = {
    fill: 'none',
    stroke: color,
    // 1.7 matches the web action row, so the same glyph reads identically in
    // both apps rather than looking heavier on the phone.
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      {name === 'copy' && <>
        <Rect x="9" y="9" width="11" height="11" rx="2" {...common} />
        <Path d="M15 6V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1" {...common} />
      </>}
      {name === 'check' && <Path d="m5 12.5 4.2 4.2L19 7" {...common} />}
      {name === 'volume' && <>
        <Path d="M4 10v4h3l4 3.5v-11L7 10H4Z" {...common} />
        <Path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" {...common} />
      </>}
      {name === 'stop' && <Rect x="6" y="6" width="12" height="12" rx="1.5" {...common} />}
      {name === 'like' && <>
        <Path d="M7.5 10.5 11 4.8c.7-1.1 2.4-.6 2.3.7l-.4 4h5.2a2 2 0 0 1 2 2.4l-1.2 6a2 2 0 0 1-2 1.6H7.5v-9Z" {...common} />
        <Path d="M3.5 10.5h4v9h-4Z" {...common} />
      </>}
      {name === 'dislike' && <>
        <Path d="m7.5 13.5 3.5 5.7c.7 1.1 2.4.6 2.3-.7l-.4-4h5.2a2 2 0 0 0 2-2.4l-1.2-6a2 2 0 0 0-2-1.6H7.5v9Z" {...common} />
        <Path d="M3.5 4.5h4v9h-4Z" {...common} />
      </>}
      {name === 'share' && <>
        <Path d="M12 16V4M7.5 8.5 12 4l4.5 4.5" {...common} />
        <Path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" {...common} />
      </>}
      {name === 'more' && <>
        <Circle cx="5" cy="12" r="1.25" fill={color} />
        <Circle cx="12" cy="12" r="1.25" fill={color} />
        <Circle cx="19" cy="12" r="1.25" fill={color} />
      </>}
    </Svg>
  );
}
