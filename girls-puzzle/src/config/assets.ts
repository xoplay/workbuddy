/**
 * 资源路径解析：所有 /ui/*.svg、/img/*、/games/* 资源都走这里，便于统一加 base、CDN、缓存参数。
 * 当前为最小本地实现：直接返回 /<relative>。如需前缀（如 GitHub Pages 子路径），改 BASE 即可。
 */

const BASE = import.meta.env.BASE_URL || "/";

export function assetUrl(rel: string): string {
  const r = rel.startsWith("/") ? rel.slice(1) : rel;
  return `${BASE}${r}`;
}
