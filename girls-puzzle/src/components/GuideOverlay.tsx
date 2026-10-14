import { useEffect, useRef } from 'react';

interface GuideOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

// 挂载共享库 XP_Kit.guide（与 story/meow 完全同款 xg-* 皮肤：
// 底部胶囊 4 按钮 + 横线 + 左对齐结构化正文）。
// 内容源走本游戏 md（--- front-matter / [zh] / # 标题 / ! 小节 / - 项）。
export function GuideOverlay({ isOpen, onClose }: GuideOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const root = ref.current;
    const kit = (window as any).XP_Kit;
    if (!root || !kit) return;

    // 关闭态：彻底清空 host，避免残留空遮罩拦截首页点击
    if (!isOpen) {
      root.className = '';
      root.innerHTML = '';
      return;
    }

    const api = kit.guide(root, {
      mdPath: '/games/girls-puzzle/md/girls.md',
      title: 'Girls Puzzle',
      onClose: () => {
        onCloseRef.current();
      },
    });

    return () => {
      root.className = '';
      root.innerHTML = '';
      if (api && api.close) api.close();
    };
  }, [isOpen]);

  return <div ref={ref} />;
}
