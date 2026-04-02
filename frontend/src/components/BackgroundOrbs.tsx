"use client";

const orbs = [
  { x: 10, y: 12, size: 44, color: "#FF007A", blur: 30 },
  { x: 28, y: 25, size: 38, color: "#40B66B", blur: 25 },
  { x: 75, y: 8, size: 40, color: "#627EEA", blur: 28 },
  { x: 88, y: 35, size: 36, color: "#2775CA", blur: 22 },
  { x: 15, y: 55, size: 42, color: "#4C82FB", blur: 26 },
  { x: 50, y: 65, size: 50, color: "#40B66B", blur: 35 },
  { x: 80, y: 58, size: 34, color: "#FF5F52", blur: 20 },
  { x: 30, y: 78, size: 40, color: "#F09242", blur: 25, mobileHidden: true },
  { x: 65, y: 82, size: 38, color: "#8B5CF6", blur: 24, mobileHidden: true },
  { x: 5, y: 42, size: 30, color: "#FF007A", blur: 18, mobileHidden: true },
  { x: 92, y: 72, size: 36, color: "#627EEA", blur: 22, mobileHidden: true },
  { x: 45, y: 40, size: 32, color: "#F09242", blur: 20, mobileHidden: true },
  { x: 70, y: 42, size: 28, color: "#8B5CF6", blur: 16, mobileHidden: true },
  { x: 20, y: 90, size: 34, color: "#FC72FF", blur: 22, mobileHidden: true },
  { x: 55, y: 92, size: 30, color: "#2775CA", blur: 18, mobileHidden: true },
];

export function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {orbs.map((orb, i) => (
        <div
          key={i}
          className={orb.mobileHidden ? "hidden md:block" : ""}
          style={{
            position: "absolute",
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            width: orb.size,
            height: orb.size,
            borderRadius: "50%",
            backgroundColor: orb.color,
            filter: `blur(${orb.blur}px)`,
            opacity: 0.35,
          }}
        />
      ))}
    </div>
  );
}
