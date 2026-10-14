import { useEffect, useRef } from 'react';

const PASTEL_COLORS = [
  '#FFB3D9', // soft pink
  '#D9B3FF', // soft purple
  '#B3D9FF', // soft blue
  '#B3FFD9', // soft green
  '#FFE6B3', // soft yellow
  '#FFD9B3', // soft orange
  '#CDEB8B', // soft lime
];

interface SquareParticle {
  x: number;
  y: number;
  size: number;
  maxSize: number;
  color: string;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  shrinkSpeed: number;
  alpha: number;
  phase: number;
  amplitude: number;
}

export default function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const maxParticles = 80;
    const particles: SquareParticle[] = [];

    const createParticle = (yPos?: number): SquareParticle => {
      const size = Math.random() * 8 + 4; // 4 to 12
      return {
        x: Math.random() * width,
        y: yPos !== undefined ? yPos : -20 - Math.random() * 100,
        size,
        maxSize: size,
        color: PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)],
        speedY: Math.random() * 2 + 1, // 1 to 3
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        shrinkSpeed: (Math.random() * 0.05 + 0.01) * 0.3, // Slow shrink
        alpha: Math.random() * 0.3 + 0.7, // High visibility
        phase: Math.random() * Math.PI * 2,
        amplitude: Math.random() * 1.5, // gentle sway
      };
    };

    // Initialize with mostly sparse particles
    for (let i = 0; i < maxParticles; i++) {
        particles.push(createParticle(Math.random() * height));
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Draw rotated square
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        
        // Draw square centered at origin
        const halfSize = p.size / 2;
        ctx.fillRect(-halfSize, -halfSize, p.size, p.size);
        
        ctx.restore();

        // Update properties
        p.rotation += p.rotationSpeed;
        p.y += p.speedY;
        p.x += Math.sin(p.phase) * p.amplitude;
        p.phase += 0.02;
        
        // Shrink slightly but stop at minimum
        if (p.size > 2) {
            p.size -= p.shrinkSpeed;
        }

        // Fade towards bottom
        const fadeThreshold = height * 0.6;
        if (p.y > fadeThreshold) {
            p.alpha -= 0.01;
        }

        // Reset if passed screen or faded out entirely
        if (p.y > height + 20 || p.alpha <= 0) {
            particles[i] = createParticle();
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="confetti-canvas"
      className="absolute inset-0 w-full h-full pointer-events-none z-30"
    />
  );
}
