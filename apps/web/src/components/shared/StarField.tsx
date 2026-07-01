const stars = [
  { x: 5, y: 8, size: 2, duration: 2.1, delay: 0 },
  { x: 12, y: 23, size: 1, duration: 3.4, delay: 0.7 },
  { x: 18, y: 5, size: 3, duration: 1.8, delay: 1.4 },
  { x: 25, y: 67, size: 1, duration: 2.7, delay: 0.3 },
  { x: 31, y: 14, size: 2, duration: 3.9, delay: 2.1 },
  { x: 38, y: 42, size: 1, duration: 1.6, delay: 0.9 },
  { x: 44, y: 78, size: 2, duration: 2.9, delay: 1.7 },
  { x: 50, y: 31, size: 3, duration: 2.3, delay: 0.5 },
  { x: 57, y: 55, size: 1, duration: 3.7, delay: 2.8 },
  { x: 63, y: 19, size: 2, duration: 1.9, delay: 1.2 },
  { x: 70, y: 88, size: 1, duration: 3.1, delay: 0.4 },
  { x: 76, y: 47, size: 3, duration: 2.5, delay: 1.9 },
  { x: 83, y: 3, size: 2, duration: 1.7, delay: 2.6 },
  { x: 89, y: 63, size: 1, duration: 3.3, delay: 0.8 },
  { x: 95, y: 36, size: 2, duration: 2, delay: 1.5 },
  { x: 8, y: 52, size: 1, duration: 3.6, delay: 2.3 },
  { x: 15, y: 81, size: 3, duration: 2.2, delay: 0.1 },
  { x: 22, y: 39, size: 2, duration: 1.5, delay: 1.8 },
  { x: 29, y: 95, size: 1, duration: 3.8, delay: 0.6 },
  { x: 35, y: 27, size: 2, duration: 2.6, delay: 2.4 },
  { x: 42, y: 60, size: 3, duration: 1.9, delay: 1.1 },
  { x: 48, y: 12, size: 1, duration: 3.2, delay: 2.9 },
  { x: 55, y: 73, size: 2, duration: 2.4, delay: 0.2 },
  { x: 61, y: 44, size: 1, duration: 1.7, delay: 1.6 },
  { x: 68, y: 90, size: 3, duration: 3.5, delay: 2.2 },
  { x: 74, y: 21, size: 2, duration: 2.8, delay: 0.7 },
  { x: 81, y: 57, size: 1, duration: 1.6, delay: 1.3 },
  { x: 87, y: 7, size: 2, duration: 3, delay: 2.7 },
  { x: 93, y: 76, size: 3, duration: 2.1, delay: 0.4 },
  { x: 3, y: 44, size: 1, duration: 3.7, delay: 1.9 },
  { x: 10, y: 69, size: 2, duration: 1.8, delay: 0.8 },
  { x: 17, y: 32, size: 1, duration: 2.9, delay: 2.5 },
  { x: 24, y: 85, size: 3, duration: 2.3, delay: 1 },
  { x: 30, y: 16, size: 2, duration: 3.4, delay: 0.3 },
  { x: 37, y: 51, size: 1, duration: 1.9, delay: 2.1 },
  { x: 43, y: 93, size: 2, duration: 2.7, delay: 1.4 },
  { x: 49, y: 25, size: 3, duration: 3.1, delay: 0.9 },
  { x: 56, y: 64, size: 1, duration: 1.7, delay: 2.8 },
  { x: 62, y: 38, size: 2, duration: 2.5, delay: 0.5 },
  { x: 69, y: 79, size: 1, duration: 3.6, delay: 1.7 },
  { x: 75, y: 11, size: 3, duration: 2, delay: 2.4 },
  { x: 82, y: 48, size: 2, duration: 3.3, delay: 0.1 },
  { x: 88, y: 28, size: 1, duration: 1.8, delay: 1.6 },
  { x: 94, y: 55, size: 2, duration: 2.6, delay: 2.9 },
  { x: 6, y: 17, size: 3, duration: 3.9, delay: 0.6 },
  { x: 13, y: 92, size: 1, duration: 2.2, delay: 1.2 },
  { x: 20, y: 48, size: 2, duration: 1.6, delay: 2.7 },
  { x: 27, y: 74, size: 1, duration: 3, delay: 0.2 },
  { x: 33, y: 30, size: 3, duration: 2.8, delay: 1.8 },
  { x: 40, y: 86, size: 2, duration: 1.9, delay: 2.3 },
  { x: 46, y: 9, size: 1, duration: 3.5, delay: 0.8 },
  { x: 53, y: 58, size: 2, duration: 2.1, delay: 1.5 },
  { x: 59, y: 41, size: 3, duration: 3.8, delay: 2.6 },
  { x: 66, y: 96, size: 1, duration: 2.4, delay: 0.3 },
  { x: 72, y: 22, size: 2, duration: 1.7, delay: 1.1 },
  { x: 79, y: 68, size: 1, duration: 3.2, delay: 2 },
  { x: 85, y: 35, size: 3, duration: 2.6, delay: 0.7 },
  { x: 91, y: 83, size: 2, duration: 1.8, delay: 1.9 },
  { x: 97, y: 15, size: 1, duration: 3.4, delay: 2.5 },
  { x: 2, y: 59, size: 2, duration: 2.9, delay: 0.4 },
];

const shootingStars = [
  { top: "10%", left: "4%", delay: "0.4s", duration: "4.8s", length: 138 },
  { top: "24%", left: "22%", delay: "2.9s", duration: "5.6s", length: 112 },
  { top: "38%", left: "48%", delay: "5.8s", duration: "5.2s", length: 128 },
  { top: "7%", left: "66%", delay: "8.1s", duration: "6.1s", length: 96 },
  { top: "56%", left: "13%", delay: "10.7s", duration: "5.4s", length: 118 },
];

export default function StarField() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {stars.map((star, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            borderRadius: "50%",
            backgroundColor: "white",
            animation: `twinkle ${star.duration}s ease-in-out infinite ${star.delay}s`,
          }}
        />
      ))}
      {shootingStars.map((star, index) => (
        <span
          key={`shooting-${index}`}
          className="shooting-star"
          style={{
            top: star.top,
            left: star.left,
            width: `${star.length}px`,
            animationDelay: star.delay,
            animationDuration: star.duration,
          }}
        />
      ))}
    </div>
  );
}
