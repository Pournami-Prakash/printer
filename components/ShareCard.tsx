
'use client';
import { toPng } from 'html-to-image';

export async function downloadCard(nodeId:string) {
  const node = document.getElementById(nodeId);
  if (!node) return;
  const dataUrl = await toPng(node, { pixelRatio: 2 });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'guilttrip.png';
  a.click();
}
