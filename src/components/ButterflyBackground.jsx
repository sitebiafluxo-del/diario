import React, { useEffect, useRef } from 'react';

export default function ButterflyBackground({ paused = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, cx, cy, time = 0;
    const particles = [];
    const MAX_PARTICLES = 160;
    let animationFrameId;

    // ========== BUTTERFLY MOVEMENT PATH ==========
    const PADDING = 120;
    const butterflyPath = {
      x: 0, y: 0,
      update(t) {
        const speedMultiplier = 1.6; // Increased speed
        const st = t * speedMultiplier;
        const rangeX = (W / 2) - PADDING;
        const rangeY = (H / 2) - PADDING;
        // Lissajous figure-8 with drift
        this.x = cx + Math.sin(st * 0.276) * rangeX * 0.7
                     + Math.sin(st * 0.132 + 1.2) * rangeX * 0.3;
        this.y = cy + Math.sin(st * 0.204 + 0.5) * rangeY * 0.6
                     + Math.cos(st * 0.108 + 2.1) * rangeY * 0.35;
      }
    };

    // --- Colors ---
    const GOLD = '#FFD700';
    const PINK = '#FF1493';
    const CYAN = '#E0FFFF';
    const WHITE = '#FFFFFF';
    const PARTICLE_COLORS = [GOLD, PINK, CYAN, WHITE, '#FFB6C1', '#DDA0DD'];

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      cx = W / 2;
      cy = H / 2;
    }
    window.addEventListener('resize', resize);
    resize();

    // ========== BUTTERFLY DRAWING ==========
    function drawWing(ctx, side, flapScale, glowAlpha) {
      const s = side; // 1 = right, -1 = left
      ctx.save();
      ctx.scale(s * flapScale, 1);

      // Upper wing
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(28, -50, 65, -65, 50, -30);
      ctx.bezierCurveTo(72, -55, 80, -20, 45, -5);
      ctx.bezierCurveTo(55, -15, 60, 5, 30, 5);
      ctx.closePath();

      const ugrd = ctx.createRadialGradient(30, -30, 2, 30, -30, 55);
      ugrd.addColorStop(0, `rgba(200, 162, 232, ${0.9 * glowAlpha})`);
      ugrd.addColorStop(0.4, `rgba(140, 80, 200, ${0.7 * glowAlpha})`);
      ugrd.addColorStop(0.7, `rgba(90, 20, 150, ${0.5 * glowAlpha})`);
      ugrd.addColorStop(1, `rgba(40, 0, 80, ${0.3 * glowAlpha})`);
      ctx.fillStyle = ugrd;
      ctx.fill();

      // Wing veins
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * glowAlpha})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(3, -2);
      ctx.quadraticCurveTo(30, -40, 55, -35);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(3, -1);
      ctx.quadraticCurveTo(35, -25, 60, -10);
      ctx.stroke();

      // Lower wing
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.bezierCurveTo(20, 10, 50, 25, 38, 35);
      ctx.bezierCurveTo(50, 30, 35, 45, 20, 30);
      ctx.bezierCurveTo(25, 40, 10, 35, 5, 15);
      ctx.closePath();

      const lgrd = ctx.createRadialGradient(22, 22, 2, 22, 22, 35);
      lgrd.addColorStop(0, `rgba(255, 180, 220, ${0.85 * glowAlpha})`);
      lgrd.addColorStop(0.5, `rgba(180, 80, 180, ${0.6 * glowAlpha})`);
      lgrd.addColorStop(1, `rgba(60, 10, 90, ${0.3 * glowAlpha})`);
      ctx.fillStyle = lgrd;
      ctx.fill();

      // Wing spots
      ctx.beginPath();
      ctx.arc(35, -30, 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.12 * glowAlpha})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(25, 22, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 255, ${0.15 * glowAlpha})`;
      ctx.fill();

      ctx.restore();
    }

    function drawButterfly(t) {
      butterflyPath.update(t);
      const levY = Math.sin(t * 1.2) * 8;
      const levX = Math.sin(t * 0.7) * 5;
      const bodyX = butterflyPath.x + levX;
      const bodyY = butterflyPath.y + levY;

      const prevT = t - 0.016;
      const prevX = cx + Math.sin(prevT * 0.276) * ((W/2)-PADDING) * 0.7
                       + Math.sin(prevT * 0.132 + 1.2) * ((W/2)-PADDING) * 0.3;
      const dx = bodyX - prevX;
      const moveAngle = dx * 0.015;

      const flapSpeed = 3.5;
      const flapBase = 0.55;
      const flapAmp = 0.45;
      const flapScale = flapBase + flapAmp * Math.abs(Math.sin(t * flapSpeed));

      const glowPulse = 0.7 + 0.3 * Math.sin(t * 2);

      ctx.save();
      ctx.globalAlpha = 0.5; // Butterfly transparency
      ctx.translate(bodyX, bodyY);
      ctx.scale(0.5, 0.5); // Reduce size by 50%

      // Outer Glow
      const glowRadius = 85 + 15 * Math.sin(t * 1.8);
      const outerGlow = ctx.createRadialGradient(0, 0, 10, 0, 0, glowRadius);
      outerGlow.addColorStop(0, `rgba(200, 162, 232, ${0.18 * glowPulse})`);
      outerGlow.addColorStop(0.4, `rgba(180, 140, 255, ${0.08 * glowPulse})`);
      outerGlow.addColorStop(0.7, `rgba(255, 255, 255, ${0.03 * glowPulse})`);
      outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Rotation removed as requested
      // const tilt = moveAngle + Math.sin(t * 0.9) * 0.04;
      // ctx.rotate(tilt);

      drawWing(ctx, 1, flapScale, glowPulse);
      drawWing(ctx, -1, flapScale, glowPulse);

      ctx.beginPath();
      ctx.ellipse(0, 0, 2.5, 18, 0, 0, Math.PI * 2);
      const bodyGrd = ctx.createLinearGradient(0, -18, 0, 18);
      bodyGrd.addColorStop(0, `rgba(220, 200, 255, ${0.9 * glowPulse})`);
      bodyGrd.addColorStop(0.5, `rgba(140, 100, 180, ${0.8 * glowPulse})`);
      bodyGrd.addColorStop(1, `rgba(80, 40, 120, ${0.7 * glowPulse})`);
      ctx.fillStyle = bodyGrd;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, -19, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 180, 230, ${0.85 * glowPulse})`;
      ctx.fill();

      ctx.strokeStyle = `rgba(200, 180, 230, ${0.6 * glowPulse})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-1, -22);
      ctx.quadraticCurveTo(-12, -38, -15 + Math.sin(t * 2) * 2, -42);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(1, -22);
      ctx.quadraticCurveTo(12, -38, 15 + Math.sin(t * 2 + 1) * 2, -42);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-15 + Math.sin(t * 2) * 2, -42, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * glowPulse})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(15 + Math.sin(t * 2 + 1) * 2, -42, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      return { x: bodyX, y: bodyY + 18 };
    }

    // ========== PARTICLE SYSTEM ==========
    function draw4PointStar(ctx, x, y, r, alpha, color) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i;
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        const midAngle = angle + Math.PI / 4;
        ctx.lineTo(Math.cos(midAngle) * r * 0.3, Math.sin(midAngle) * r * 0.3);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill();

      ctx.globalAlpha = alpha * 0.5;
      // Removed expensive shadowBlur for performance
      ctx.fill();
      ctx.restore();
    }

    class Particle {
      constructor(x, y) {
        this.reset(x, y);
      }
      reset(x, y) {
        this.x = x + (Math.random() - 0.5) * 10;
        this.y = y;
        this.originX = this.x;
        this.age = 0;
        this.maxAge = 120 + Math.random() * 160;
        this.speed = 0.6 + Math.random() * 1.2;
        this.size = 1 + Math.random() * 3;
        this.color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
        this.isStar = Math.random() < 0.3;
        this.sFreq = 0.015 + Math.random() * 0.02;
        this.sAmp = 30 + Math.random() * 50;
        this.sPhase = Math.random() * Math.PI * 2;
        this.flickerSpeed = 3 + Math.random() * 5;
        this.flickerOffset = Math.random() * Math.PI * 2;
        this.alive = true;
      }
      update() {
        this.age++;
        if (this.age >= this.maxAge) {
          this.alive = false;
          return;
        }
        this.y += this.speed;
        const progress = this.age / this.maxAge;
        this.x = this.originX + Math.sin(this.age * this.sFreq + this.sPhase) * this.sAmp * progress;
        this.originX += Math.sin(time * 0.5 + this.sPhase) * 0.15;
      }
      draw(ctx) {
        const progress = this.age / this.maxAge;
        let alpha = 1 - progress;
        alpha = alpha * alpha;
        const flicker = 0.5 + 0.5 * Math.sin(time * this.flickerSpeed + this.flickerOffset);
        alpha *= (0.5 + 0.5 * flicker);

        if (alpha < 0.01) return;

        const size = this.size * (1 - progress * 0.5);

        if (this.isStar) {
          draw4PointStar(ctx, this.x, this.y, size * 2, alpha, this.color);
        } else {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
          // Removed expensive shadowBlur for performance
          ctx.fillStyle = this.color;
          ctx.fill();

          ctx.globalAlpha = alpha * 0.8;
          ctx.beginPath();
          ctx.arc(this.x, this.y, size * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = WHITE;
          ctx.fill();
          ctx.restore();
        }
      }
    }

    function spawnParticles(baseX, baseY) {
      const count = Math.random() < 0.6 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        if (particles.length < MAX_PARTICLES) {
          particles.push(new Particle(baseX, baseY));
        } else {
          const dead = particles.find(p => !p.alive);
          if (dead) dead.reset(baseX, baseY);
        }
      }
    }

    // ========== AMBIENT STARS ==========
    const ambientStars = [];
    function initAmbientStars() {
      for (let i = 0; i < 60; i++) {
        ambientStars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: 0.3 + Math.random() * 1.2,
          speed: 1 + Math.random() * 3,
          offset: Math.random() * Math.PI * 2,
        });
      }
    }
    initAmbientStars();

    function drawAmbientStars() {
      ambientStars.forEach(s => {
        const alpha = 0.2 + 0.3 * Math.sin(time * s.speed + s.offset);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // ========== MAIN LOOP ==========
    function drawBackground() {
      ctx.save();
      // Background is now solid (1.0 alpha)
      ctx.globalAlpha = 1.0;
      const bgGrd = ctx.createRadialGradient(
        butterflyPath.x, butterflyPath.y, 30,
        cx, cy, Math.max(W, H) * 0.7
      );
      bgGrd.addColorStop(0, '#0d0618');
      bgGrd.addColorStop(0.3, '#08030f');
      bgGrd.addColorStop(0.6, '#030108');
      bgGrd.addColorStop(1, '#000000');
      ctx.fillStyle = bgGrd;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    function animate() {
      if (paused) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      time += 0.016;
      ctx.clearRect(0, 0, W, H);
      drawBackground();
      drawAmbientStars();

      const base = drawButterfly(time);
      spawnParticles(base.x, base.y);

      ctx.save();
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (!p.alive) continue;
        p.update();
        p.draw(ctx);
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [paused]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        zIndex: 0, 
        pointerEvents: 'none',
        width: '100vw',
        height: '100dvh'
      }} 
    />
  );
}
