import React, { useRef, useEffect } from "react";

export default function AnimatedBackground() {
  const ref1 = useRef();
  const ref2 = useRef();
  const gradientRef1 = useRef();
  const gradientRef2 = useRef();

  useEffect(() => {
    let frame;
    let t = 0;

    function animate() {
      t += 0.015;
      // Prima onda
      let d1 = "M0,300 Q";
      for (let i = 0; i <= 6; i++) {
        const x = (i * 200);
        const y = 300 + Math.sin(t + i) * 40 + Math.cos(t * 0.7 + i) * 30;
        d1 += `${x},${y} `;
      }
      d1 += "1200,300 L1200,600 L0,600 Z";
      if (ref1.current) ref1.current.setAttribute("d", d1);

      // Seconda onda
      let d2 = "M0,320 Q";
      for (let i = 0; i <= 6; i++) {
        const x = (i * 200);
        const y = 320 + Math.cos(t + i) * 30 + Math.sin(t * 0.5 + i) * 20;
        d2 += `${x},${y} `;
      }
      d2 += "1200,320 L1200,600 L0,600 Z";
      if (ref2.current) ref2.current.setAttribute("d", d2);

      // Animazione dei gradienti
      const hue1 = (Math.sin(t * 0.3) * 60 + 180) % 360;
      const hue2 = (Math.cos(t * 0.2) * 60 + 240) % 360;
      
      if (gradientRef1.current) {
        gradientRef1.current.setAttribute("stopColor", `hsl(${hue1}, 100%, 50%)`);
      }
      if (gradientRef2.current) {
        gradientRef2.current.setAttribute("stopColor", `hsl(${hue2}, 100%, 50%)`);
      }

      frame = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <svg
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        filter: "blur(0.5px) brightness(1.1)",
        background: "linear-gradient(45deg, #000428, #004e92)",
      }}
      viewBox="0 0 1200 600"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="wave1" x1="0" y1="0" x2="1" y2="1">
          <stop ref={gradientRef1} offset="0%" stopColor="#00c3ff" />
          <stop offset="100%" stopColor="#ff61f6" />
        </linearGradient>
        <linearGradient id="wave2" x1="1" y1="0" x2="0" y2="1">
          <stop ref={gradientRef2} offset="0%" stopColor="#ffff1c" />
          <stop offset="100%" stopColor="#1cffb3" />
        </linearGradient>
      </defs>
      <path ref={ref1} fill="url(#wave1)" opacity="0.7" />
      <path ref={ref2} fill="url(#wave2)" opacity="0.5" />
    </svg>
  );
}