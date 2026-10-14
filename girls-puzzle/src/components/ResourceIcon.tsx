import React from 'react';
import { assetUrl } from '@/config/assets';

export type ResourceType = 'coin' | 'diamond' | 'pearl' | 'album' | 'video';

interface ResourceIconProps {
  type: ResourceType;
  className?: string;
  id?: string;
}

// 优先复用跨游戏共享内联 SVG 图标（window.XPlay.XP_Icons），
// 去掉对 ui/icon_*.svg 图片文件的依赖，保证与 star/story 视觉一致。
function xpIconSvg(name: 'coin' | 'diamond'): string | null {
  try {
    const svg: string | undefined = (window as any).XPlay?.XP_Icons?.[name];
    return svg || null;
  } catch {
    return null;
  }
}

export function ResourceIcon({ type, className = "w-4 h-4", id }: ResourceIconProps) {
  if (type === 'coin' || type === 'diamond') {
    const svg = xpIconSvg(type);
    if (svg) {
      const html = svg.replace('<svg ', '<svg style="width:100%;height:100%;display:block" ');
      return (
        <span
          id={id}
          className={`inline-block shrink-0 ${className}`}
          style={{ lineHeight: 0 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
  }
  const srcMap: Record<ResourceType, string> = {
    coin: assetUrl('ui/icon_gold.svg'),
    diamond: assetUrl('ui/icon_zuan.svg'),
    pearl: assetUrl('ui/icon_star.svg'),
    album: assetUrl('ui/icon_like.svg'),
    video: assetUrl('ui/icon_ads.svg'),
  };
  return <img id={id} src={srcMap[type]} className={`shrink-0 object-contain ${className}`} alt={type} />;
}
