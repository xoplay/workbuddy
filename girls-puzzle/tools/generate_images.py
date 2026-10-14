#!/usr/bin/env python3
"""
程序化生成 girls-puzzle 拼图图片资产。

输出规范：public/img/{tier}/{tier}{n:05d}.webp   (9:16 竖屏)
数量：a×10 b×8 c×7 d×6 e×6 f×5 g×7 = 49 张

每个 tier 使用不同的生成算法，保证图块有足够的方向性与细节，
让玩家在拼图时能分辨图块位置（纯渐变会导致拼图无法进行）。

换真图时：把真图按同样命名规范丢进 public/img/{tier}/ 覆盖即可，
或在 getStageImage 里改路径映射。
"""

import os
import math
import numpy as np
from PIL import Image, ImageFilter

W, H = 720, 1280          # 9:16
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "img")

# tier -> 数量
TIERS = {"a": 10, "b": 8, "c": 7, "d": 6, "e": 6, "f": 5, "g": 7}


# ---------- 基础工具 ----------

def vgrad(h, w, stops):
    """垂直渐变。stops = [(pos0-1, (r,g,b)), ...]"""
    ys = np.linspace(0.0, 1.0, h, dtype=np.float32)
    out = np.zeros((h, w, 3), dtype=np.float32)
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        # 最后一段闭合，避免末端留 0
        m = (ys >= p0) & (ys <= p1) if i == len(stops) - 2 else (ys >= p0) & (ys < p1)
        if not m.any():
            continue
        t = ((ys[m] - p0) / max(p1 - p0, 1e-6))[:, None, None]      # (k,1,1)
        c0a = np.array(c0, dtype=np.float32)[None, None, :]          # (1,1,3)
        c1a = np.array(c1, dtype=np.float32)[None, None, :]
        out[m] = c0a + t * (c1a - c0a)                               # -> (k,w,3)
    return out


def ridge(rng, w, base, amp, rough=3, freq=1.0):
    """生成一条山脊线的 y 坐标数组（越小越高）。"""
    xs = np.linspace(0, math.pi * 2 * freq, w)
    y = np.full(w, float(base), dtype=np.float32)
    for k in range(1, rough + 1):
        y += amp / k * np.sin(xs * k + rng.uniform(0, 6.28))
    # 平滑
    k = np.ones(9) / 9.0
    return np.convolve(y, k, mode="same")


def fill_below(img, ys, color, alpha=1.0):
    """把山脊线以下填充为 color。"""
    h, w, _ = img.shape
    xs = np.arange(w)
    mask = np.arange(h)[:, None] >= ys[None, :].astype(int)
    if alpha >= 1.0:
        img[mask] = color
    else:
        img[mask] = img[mask] * (1 - alpha) + np.array(color, dtype=np.float32) * alpha
    return img


def sun(img, rng, cx, cy, r, color, glow=2.2):
    """画一个带光晕的圆。"""
    h, w, _ = img.shape
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    core = np.clip(1 - d / r, 0, 1) ** 0.6
    halo = np.clip(1 - d / (r * glow), 0, 1) ** 2.2 * 0.55
    a = np.clip(core + halo, 0, 1)[:, :, None]
    img[:] = img * (1 - a) + np.array(color, dtype=np.float32) * a
    return img


def stars(img, rng, n, maxr=2.0, bright=(235, 240, 255)):
    h, w, _ = img.shape
    for _ in range(n):
        x, y = rng.integers(0, w), rng.integers(0, h)
        r = rng.uniform(0.5, maxr)
        b = rng.uniform(0.35, 1.0)
        rr = int(r * 3) + 1
        x0, x1 = max(0, x - rr), min(w, x + rr)
        y0, y1 = max(0, y - rr), min(h, y + rr)
        if x1 <= x0 or y1 <= y0:
            continue
        sub = img[y0:y1, x0:x1]
        yy, xx = np.mgrid[y0:y1, x0:x1]
        d = np.sqrt((xx - x) ** 2 + (yy - y) ** 2)
        a = np.clip(1 - d / (r * 2.2), 0, 1) ** 1.6 * b
        c = np.array(bright, dtype=np.float32) * rng.uniform(0.85, 1.0)
        sub[:] = sub * (1 - a[:, :, None]) + c * a[:, :, None]
    return img


def to_img(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def blur(arr, r):
    """对整个数组做高斯模糊（转 PIL 处理再转回）。"""
    im = to_img(arr).filter(ImageFilter.GaussianBlur(r))
    return np.asarray(im, dtype=np.float32)


# ---------- 各 tier 风格 ----------

def gen_a(rng):
    """自然风光：分层山峦 + 天空渐变 + 太阳"""
    palettes = [
        [(18, 32, 58), (58, 84, 122), (232, 168, 120)],   # 晨曦
        [(10, 18, 40), (36, 66, 110), (150, 200, 220)],   # 冷蓝
        [(30, 24, 52), (128, 84, 96), (246, 200, 150)],   # 暮紫
        [(12, 30, 34), (40, 92, 88), (198, 232, 200)],    # 青绿
    ]
    p = palettes[rng.integers(0, len(palettes))]
    img = vgrad(H, W, [(0.0, p[0]), (0.55, p[1]), (1.0, p[2])])
    sun(img, rng, rng.uniform(0.2, 0.8) * W, rng.uniform(0.12, 0.3) * H,
        rng.uniform(38, 66), (255, 238, 205))
    layers = rng.integers(3, 5)
    for i in range(layers):
        t = (i + 1) / (layers + 1)
        base = 0.42 * H + t * 0.5 * H
        ys = ridge(rng, W, base, amp=rng.uniform(26, 62), rough=4, freq=rng.uniform(0.8, 2.0))
        shade = 1.0 - t * 0.62
        c = np.array(p[0], dtype=np.float32) * shade + np.array(p[2], dtype=np.float32) * (1 - shade) * 0.25
        img = fill_below(img, ys, c)
    return img


def gen_b(rng):
    """极光 / 柔光带"""
    sky = vgrad(H, W, [(0.0, (8, 10, 34)), (0.5, (26, 30, 74)), (1.0, (58, 44, 92))])
    img = sky.copy()
    stars(img, rng, 150, 1.8)
    hues = [
        (120, 240, 190), (90, 190, 235), (200, 130, 240),
        (240, 150, 190), (150, 255, 210),
    ]
    for i in range(rng.integers(3, 6)):
        c = np.array(hues[rng.integers(0, len(hues))], dtype=np.float32)
        band = np.zeros_like(img)
        ys0 = rng.uniform(0.12, 0.6) * H
        thick = rng.uniform(40, 130)
        xs = np.arange(W)
        ys = ys0 + ridge(rng, W, 0, amp=rng.uniform(30, 90), rough=3, freq=rng.uniform(0.7, 1.8))
        yy = np.arange(H)
        d = np.abs(yy[:, None] - ys[None, :])
        a = np.clip(1 - d / thick, 0, 1) ** 2.0
        a *= rng.uniform(0.35, 0.85)
        img = img * (1 - a[:, :, None]) + c * a[:, :, None] * 1.0 + band * 0
    img = blur(img, 3)
    return img


def gen_c(rng):
    """大理石流体纹理（粉紫红）"""
    base_pair = [
        ((250, 226, 232), (186, 112, 156)),
        ((246, 232, 240), (150, 96, 190)),
        ((252, 220, 214), (216, 104, 118)),
        ((238, 232, 250), (126, 110, 214)),
        ((250, 236, 222), (206, 136, 96)),
    ]
    c0, c1 = base_pair[rng.integers(0, len(base_pair))]
    img = vgrad(H, W, [(0, c0), (1, c1)]).astype(np.float32)
    # 多层正弦流纹
    yy, xx = np.mgrid[0:H, 0:W]
    fn = (xx / W) * rng.uniform(1.5, 4.0) + (yy / H) * rng.uniform(1.0, 3.0)
    for k in range(4):
        f = fn * (k + 1) * rng.uniform(0.7, 1.4) + rng.uniform(0, 6.28)
        v = np.sin(f) * 0.5 + 0.5
        v = v ** rng.uniform(1.2, 3.0)
        amt = rng.uniform(0.10, 0.30)
        col = np.array(c1 if k % 2 == 0 else c0, dtype=np.float32)
        img = img * (1 - v[:, :, None] * amt) + col * (v[:, :, None] * amt)
    img = blur(img, 1.2)
    return img


def gen_d(rng):
    """深空星云"""
    img = vgrad(H, W, [(0, (4, 4, 14)), (0.6, (12, 10, 34)), (1, (24, 14, 40))])
    neb = [
        (120, 70, 200), (60, 120, 220), (200, 70, 140),
        (80, 190, 200), (220, 130, 70),
    ]
    for _ in range(rng.integers(4, 8)):
        c = np.array(neb[rng.integers(0, len(neb))], dtype=np.float32)
        cx, cy = rng.uniform(0.1, 0.9) * W, rng.uniform(0.1, 0.9) * H
        r = rng.uniform(120, 320)
        yy, xx = np.mgrid[0:H, 0:W]
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        a = np.clip(1 - d / r, 0, 1) ** 2.4 * rng.uniform(0.25, 0.6)
        img = img * (1 - a[:, :, None]) + c * a[:, :, None]
    img = blur(img, 6)
    stars(img, rng, 320, 2.4)
    return img


def gen_e(rng):
    """金色大理石 / 几何线条"""
    img = vgrad(H, W, [(0, (16, 12, 10)), (0.5, (44, 32, 20)), (1, (12, 9, 8))])
    gold = (226, 178, 92)
    yy, xx = np.mgrid[0:H, 0:W]
    # 金色波纹线
    for i in range(rng.integers(8, 16)):
        y0 = (i / 16) * H + rng.uniform(-30, 30)
        amp = rng.uniform(18, 70)
        freq = rng.uniform(0.8, 2.4)
        ys = y0 + np.sin(np.linspace(0, 6.28 * freq, W)) * amp
        d = np.abs(yy - ys[None, :])
        thick = rng.uniform(1.6, 6.0)
        a = np.clip(1 - d / thick, 0, 1) ** 1.4 * rng.uniform(0.35, 0.95)
        img = img * (1 - a[:, :, None]) + np.array(gold, dtype=np.float32) * a[:, :, None]
    # 斜向光泽
    ang = rng.uniform(-0.6, 0.6)
    v = np.sin((xx * 0.006 + yy * 0.004) + ang * 6) * 0.5 + 0.5
    img += v[:, :, None] * 12
    return img


def gen_f(rng):
    """超现实梦境：暗色 + 光柱 / 拱门"""
    pal = [
        ((6, 8, 18), (70, 40, 120)),
        ((8, 6, 16), (30, 90, 130)),
        ((10, 6, 14), (130, 50, 90)),
    ]
    c0, c1 = pal[rng.integers(0, len(pal))]
    img = vgrad(H, W, [(0, c0), (1, c1)])
    yy, xx = np.mgrid[0:H, 0:W]
    glow = np.array((255, 232, 200), dtype=np.float32)
    # 竖直光柱
    for i in range(rng.integers(2, 5)):
        cx = rng.uniform(0.12, 0.88) * W
        wdt = rng.uniform(26, 90)
        d = np.abs(xx - cx)
        a = np.clip(1 - d / wdt, 0, 1) ** 1.8
        a *= np.clip(1 - yy / H, 0, 1) ** 0.7 * rng.uniform(0.4, 0.9)
        img = img * (1 - a[:, :, None]) + glow * a[:, :, None]
    # 拱形
    if rng.random() < 0.7:
        cx, cy = rng.uniform(0.3, 0.7) * W, rng.uniform(0.55, 0.8) * H
        r = rng.uniform(120, 260)
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        ring = np.clip(1 - np.abs(d - r) / rng.uniform(3, 10), 0, 1)
        img = img * (1 - ring[:, :, None] * 0.8) + glow * ring[:, :, None] * 0.8
    # 地平线
    hy = rng.uniform(0.7, 0.88) * H
    a = np.clip(1 - np.abs(yy - hy) / rng.uniform(2, 7), 0, 1)
    img = img * (1 - a[:, :, None] * 0.9) + glow * a[:, :, None] * 0.9
    img = blur(img, 1.5)
    return img


def gen_g(rng):
    """挑战线：山湖倒影 + 日出"""
    sky_pal = [
        ((22, 30, 62), (240, 150, 110)),
        ((14, 26, 48), (120, 190, 210)),
        ((30, 20, 46), (250, 190, 130)),
    ]
    p = sky_pal[rng.integers(0, len(sky_pal))]
    top = vgrad(H // 2, W, [(0, p[0]), (1, p[1])])
    sun(top, rng, rng.uniform(0.25, 0.75) * W, rng.uniform(0.45, 0.8) * (H // 2),
        rng.uniform(34, 62), (255, 240, 210))
    # 山（位于上半部下缘）
    for i in range(rng.integers(2, 4)):
        base = (0.55 + i * 0.12) * (H // 2)
        ys = ridge(rng, W, base, amp=rng.uniform(20, 48), rough=3, freq=rng.uniform(0.9, 1.8))
        fill_below(top, ys, np.array(p[0], dtype=np.float32) * (0.35 + i * 0.2))
    # 下半：水面倒影（垂直翻转 + 行索引正弦扰动做水波）
    rows = np.clip(
        np.arange(H // 2)[:, None]
        + (np.sin(np.arange(W)[None, :] * 0.02) * rng.uniform(3, 9)).astype(int),
        0, H // 2 - 1,
    )
    bot = np.flipud(top)[rows, np.arange(W)[None, :]] * rng.uniform(0.62, 0.82)
    img = np.vstack([top, bot])
    img = blur(img, 0.8)
    return img


GENS = {"a": gen_a, "b": gen_b, "c": gen_c, "d": gen_d, "e": gen_e, "f": gen_f, "g": gen_g}


def main():
    total = 0
    for tier, count in TIERS.items():
        d = os.path.join(OUT_DIR, tier)
        os.makedirs(d, exist_ok=True)
        for n in range(1, count + 1):
            rng = np.random.default_rng(hash((tier, n)) % (2 ** 32))
            arr = GENS[tier](rng)
            im = to_img(arr)
            path = os.path.join(d, f"{tier}{n:05d}.webp")
            im.save(path, "WEBP", quality=82, method=4)
            total += 1
        print(f"  tier {tier}: {count} 张 -> public/img/{tier}/")
    print(f"共生成 {total} 张图片 ({W}x{H})")


if __name__ == "__main__":
    main()
