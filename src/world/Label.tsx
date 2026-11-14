import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

export function Label({ lines, width, height, color, background, fontSize, left = false, maxLines = 1 }: {
  lines: string[];
  width: number;
  height: number;
  color: string;
  background?: string;
  fontSize: number;
  left?: boolean;
  maxLines?: number;
}) {
  const content = lines.join('\n');
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width > 5 ? 1024 : 512;
    canvas.height = Math.max(24, Math.round(canvas.width * height / width));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.fillStyle = color;
      ctx.textAlign = left ? 'left' : 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 ' + fontSize + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
      const x = left ? 10 : canvas.width / 2;
      const allowed = canvas.width - 20;
      const wrapped = content.split('\n').flatMap(line => {
        if (maxLines === 1) return [line];
        const parts = line.split(' ');
        const rows = [parts.shift() ?? ''];
        for (const word of parts) {
          const index = rows.length - 1;
          const next = rows[index] + ' ' + word;
          if (ctx.measureText(next).width > allowed && rows.length < maxLines) rows.push(word);
          else rows[index] = next;
        }
        return rows;
      });
      wrapped.forEach((line, index) => {
        const y = canvas.height / 2 + (index - (wrapped.length - 1) / 2) * fontSize * 1.12;
        ctx.fillText(line, x, y, allowed);
      });
    }
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    result.anisotropy = 4;
    return result;
  }, [background, color, content, fontSize, height, left, maxLines, width]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh>
    <planeGeometry args={[width, height]} />
    <meshBasicMaterial map={texture} transparent={!background} depthWrite={Boolean(background)} toneMapped={false} />
  </mesh>;
}
