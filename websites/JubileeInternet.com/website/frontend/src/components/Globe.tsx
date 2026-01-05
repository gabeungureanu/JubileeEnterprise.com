'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
  lat?: number;
  lng?: number;
}

interface Connection {
  from: Point3D;
  to: Point3D;
  progress: number;
  speed: number;
  color: string;
}

// Major world cities for realistic node placement
const WORLD_CITIES: { lat: number; lng: number; name: string }[] = [
  // Americas
  { lat: 40.7128, lng: -74.006, name: 'New York' },
  { lat: 34.0522, lng: -118.2437, name: 'Los Angeles' },
  { lat: 41.8781, lng: -87.6298, name: 'Chicago' },
  { lat: 29.7604, lng: -95.3698, name: 'Houston' },
  { lat: 49.2827, lng: -123.1207, name: 'Vancouver' },
  { lat: 19.4326, lng: -99.1332, name: 'Mexico City' },
  { lat: -23.5505, lng: -46.6333, name: 'São Paulo' },
  { lat: -34.6037, lng: -58.3816, name: 'Buenos Aires' },
  { lat: 45.5017, lng: -73.5673, name: 'Montreal' },
  { lat: 25.7617, lng: -80.1918, name: 'Miami' },
  // Europe
  { lat: 51.5074, lng: -0.1278, name: 'London' },
  { lat: 48.8566, lng: 2.3522, name: 'Paris' },
  { lat: 52.52, lng: 13.405, name: 'Berlin' },
  { lat: 41.9028, lng: 12.4964, name: 'Rome' },
  { lat: 40.4168, lng: -3.7038, name: 'Madrid' },
  { lat: 52.3676, lng: 4.9041, name: 'Amsterdam' },
  { lat: 59.9139, lng: 10.7522, name: 'Oslo' },
  { lat: 55.6761, lng: 12.5683, name: 'Copenhagen' },
  { lat: 50.0755, lng: 14.4378, name: 'Prague' },
  { lat: 47.4979, lng: 19.0402, name: 'Budapest' },
  // Asia
  { lat: 35.6762, lng: 139.6503, name: 'Tokyo' },
  { lat: 31.2304, lng: 121.4737, name: 'Shanghai' },
  { lat: 22.3193, lng: 114.1694, name: 'Hong Kong' },
  { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
  { lat: 37.5665, lng: 126.978, name: 'Seoul' },
  { lat: 39.9042, lng: 116.4074, name: 'Beijing' },
  { lat: 19.076, lng: 72.8777, name: 'Mumbai' },
  { lat: 28.6139, lng: 77.209, name: 'Delhi' },
  { lat: 13.7563, lng: 100.5018, name: 'Bangkok' },
  { lat: 3.139, lng: 101.6869, name: 'Kuala Lumpur' },
  // Middle East & Africa
  { lat: 25.2048, lng: 55.2708, name: 'Dubai' },
  { lat: 31.7683, lng: 35.2137, name: 'Jerusalem' },
  { lat: 32.0853, lng: 34.7818, name: 'Tel Aviv' },
  { lat: -33.9249, lng: 18.4241, name: 'Cape Town' },
  { lat: -1.2921, lng: 36.8219, name: 'Nairobi' },
  { lat: 30.0444, lng: 31.2357, name: 'Cairo' },
  { lat: 6.5244, lng: 3.3792, name: 'Lagos' },
  // Oceania
  { lat: -33.8688, lng: 151.2093, name: 'Sydney' },
  { lat: -37.8136, lng: 144.9631, name: 'Melbourne' },
  { lat: -36.8485, lng: 174.7633, name: 'Auckland' },
];

// Convert lat/lng to 3D point on sphere
function latLngToPoint(lat: number, lng: number): Point3D {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  return {
    x: -(Math.sin(phi) * Math.cos(theta)),
    y: Math.cos(phi),
    z: Math.sin(phi) * Math.sin(theta),
    lat,
    lng,
  };
}

// Generate continent outline points (simplified)
function generateContinentPoints(): Point3D[] {
  const points: Point3D[] = [];

  // North America outline
  const northAmerica = [
    [70, -140], [65, -170], [60, -165], [55, -165], [50, -130], [45, -125],
    [40, -125], [35, -120], [30, -115], [25, -110], [20, -105], [15, -90],
    [20, -87], [25, -80], [30, -85], [35, -75], [40, -70], [45, -65],
    [50, -60], [55, -60], [60, -65], [65, -75], [70, -90], [75, -100],
    [70, -120], [70, -140],
  ];

  // South America outline
  const southAmerica = [
    [10, -75], [5, -80], [0, -80], [-5, -80], [-10, -75], [-15, -75],
    [-20, -70], [-25, -65], [-30, -70], [-35, -72], [-40, -73], [-45, -75],
    [-50, -73], [-55, -68], [-50, -58], [-45, -60], [-40, -55], [-35, -55],
    [-30, -50], [-25, -45], [-20, -40], [-15, -40], [-10, -35], [-5, -35],
    [0, -50], [5, -60], [10, -75],
  ];

  // Europe outline
  const europe = [
    [70, 25], [65, 10], [60, 5], [55, -5], [50, -10], [45, -10],
    [40, -10], [35, -5], [35, 5], [40, 10], [45, 15], [50, 20],
    [55, 25], [60, 30], [65, 35], [70, 30], [70, 25],
  ];

  // Africa outline
  const africa = [
    [35, -5], [30, -10], [25, -15], [20, -17], [15, -17], [10, -15],
    [5, -5], [0, 10], [-5, 15], [-10, 20], [-15, 25], [-20, 30],
    [-25, 33], [-30, 30], [-35, 20], [-35, 25], [-30, 30], [-25, 35],
    [-20, 40], [-15, 45], [-10, 45], [-5, 50], [0, 45], [5, 42],
    [10, 50], [15, 55], [20, 55], [25, 50], [30, 35], [35, 10],
    [35, -5],
  ];

  // Asia outline (simplified)
  const asia = [
    [70, 60], [65, 80], [60, 100], [55, 120], [50, 130], [45, 140],
    [40, 140], [35, 135], [30, 130], [25, 120], [20, 110], [15, 100],
    [10, 100], [5, 100], [0, 105], [-5, 110], [-10, 120], [-10, 130],
    [-5, 135], [5, 135], [15, 145], [25, 145], [35, 140], [45, 150],
    [55, 160], [65, 170], [70, 150], [75, 100], [70, 60],
  ];

  // Australia outline
  const australia = [
    [-15, 130], [-20, 115], [-25, 115], [-30, 120], [-35, 135],
    [-35, 145], [-30, 150], [-25, 155], [-20, 145], [-15, 145],
    [-10, 140], [-15, 130],
  ];

  const continents = [northAmerica, southAmerica, europe, africa, asia, australia];

  continents.forEach(continent => {
    // Add more interpolated points for smoother outlines
    for (let i = 0; i < continent.length - 1; i++) {
      const [lat1, lng1] = continent[i];
      const [lat2, lng2] = continent[i + 1];
      const steps = 3;
      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        const lat = lat1 + (lat2 - lat1) * t;
        const lng = lng1 + (lng2 - lng1) * t;
        points.push(latLngToPoint(lat, lng));
      }
    }
  });

  return points;
}

export function Globe({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const rotationRef = useRef(0);
  const connectionsRef = useRef<Connection[]>([]);
  const cityPointsRef = useRef<Point3D[]>([]);
  const continentPointsRef = useRef<Point3D[]>([]);

  const rotatePoint = useCallback((point: Point3D, rotationY: number, rotationX: number = 0.1): Point3D => {
    // Rotate around Y axis
    let x = point.x * Math.cos(rotationY) - point.z * Math.sin(rotationY);
    let z = point.x * Math.sin(rotationY) + point.z * Math.cos(rotationY);
    let y = point.y;

    // Slight tilt (rotate around X axis)
    const newY = y * Math.cos(rotationX) - z * Math.sin(rotationX);
    const newZ = y * Math.sin(rotationX) + z * Math.cos(rotationX);

    return { x, y: newY, z: newZ };
  }, []);

  const projectPoint = useCallback((point: Point3D, centerX: number, centerY: number, radius: number): { x: number; y: number; scale: number; visible: boolean } => {
    const perspective = 2.5;
    const scale = perspective / (perspective + point.z);
    return {
      x: centerX + point.x * radius * scale,
      y: centerY - point.y * radius * scale,
      scale: scale,
      visible: point.z > -0.5,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Convert cities to 3D points
    cityPointsRef.current = WORLD_CITIES.map(city => latLngToPoint(city.lat, city.lng));

    // Generate continent outline points
    continentPointsRef.current = generateContinentPoints();

    // Initialize connections between cities
    const initConnections = () => {
      const cities = cityPointsRef.current;
      const colors = [
        'rgba(37, 99, 235, 0.9)',   // Blue
        'rgba(59, 130, 246, 0.9)',  // Light blue
        'rgba(99, 102, 241, 0.8)',  // Indigo
        'rgba(139, 92, 246, 0.7)',  // Purple
      ];

      const newConnections: Connection[] = [];
      for (let i = 0; i < 12; i++) {
        const fromIdx = Math.floor(Math.random() * cities.length);
        let toIdx = Math.floor(Math.random() * cities.length);
        while (toIdx === fromIdx) {
          toIdx = Math.floor(Math.random() * cities.length);
        }
        newConnections.push({
          from: cities[fromIdx],
          to: cities[toIdx],
          progress: Math.random(),
          speed: 0.003 + Math.random() * 0.004,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
      connectionsRef.current = newConnections;
    };

    initConnections();

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const drawGlobe = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.42;

      ctx.clearRect(0, 0, width, height);

      // Rotate globe slowly
      rotationRef.current += 0.003;

      // Draw outer glow
      const outerGlow = ctx.createRadialGradient(
        centerX, centerY, radius * 0.9,
        centerX, centerY, radius * 1.6
      );
      outerGlow.addColorStop(0, 'rgba(37, 99, 235, 0.12)');
      outerGlow.addColorStop(0.4, 'rgba(59, 130, 246, 0.06)');
      outerGlow.addColorStop(1, 'rgba(37, 99, 235, 0)');
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Draw atmosphere ring
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.lineWidth = radius * 0.08;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.08, 0, Math.PI * 2);
      ctx.stroke();

      // Draw globe base (ocean)
      const oceanGradient = ctx.createRadialGradient(
        centerX - radius * 0.3, centerY - radius * 0.3, 0,
        centerX, centerY, radius
      );
      oceanGradient.addColorStop(0, '#1e3a5f');
      oceanGradient.addColorStop(0.5, '#1e3a5f');
      oceanGradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = oceanGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw grid lines (latitude/longitude)
      ctx.strokeStyle = 'rgba(100, 150, 200, 0.08)';
      ctx.lineWidth = 0.5;

      // Latitude lines
      for (let lat = -60; lat <= 60; lat += 30) {
        const points: { x: number; y: number; visible: boolean }[] = [];
        for (let lng = -180; lng <= 180; lng += 10) {
          const p = latLngToPoint(lat, lng);
          const rotated = rotatePoint(p, rotationRef.current);
          points.push(projectPoint(rotated, centerX, centerY, radius));
        }

        ctx.beginPath();
        let started = false;
        points.forEach((p, i) => {
          if (p.visible) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            started = false;
          }
        });
        ctx.stroke();
      }

      // Longitude lines
      for (let lng = -180; lng < 180; lng += 30) {
        const points: { x: number; y: number; visible: boolean }[] = [];
        for (let lat = -90; lat <= 90; lat += 5) {
          const p = latLngToPoint(lat, lng);
          const rotated = rotatePoint(p, rotationRef.current);
          points.push(projectPoint(rotated, centerX, centerY, radius));
        }

        ctx.beginPath();
        let started = false;
        points.forEach((p) => {
          if (p.visible) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            started = false;
          }
        });
        ctx.stroke();
      }

      // Draw continent outlines
      const continentPoints = continentPointsRef.current.map(p => {
        const rotated = rotatePoint(p, rotationRef.current);
        return {
          ...projectPoint(rotated, centerX, centerY, radius),
          z: rotated.z,
        };
      });

      ctx.fillStyle = 'rgba(100, 180, 130, 0.25)';
      continentPoints.forEach(p => {
        if (p.visible && p.z > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.5 + p.scale, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw connections (data streams) - behind cities
      const cities = cityPointsRef.current;
      connectionsRef.current.forEach(conn => {
        const fromRotated = rotatePoint(conn.from, rotationRef.current);
        const toRotated = rotatePoint(conn.to, rotationRef.current);
        const fromProj = projectPoint(fromRotated, centerX, centerY, radius);
        const toProj = projectPoint(toRotated, centerX, centerY, radius);

        if (fromProj.visible && toProj.visible && fromRotated.z > 0 && toRotated.z > 0) {
          // Calculate arc path
          const midX = (fromProj.x + toProj.x) / 2;
          const midY = (fromProj.y + toProj.y) / 2;
          const dist = Math.sqrt(Math.pow(toProj.x - fromProj.x, 2) + Math.pow(toProj.y - fromProj.y, 2));
          const arcHeight = Math.min(dist * 0.4, radius * 0.3);

          // Draw path with gradient
          const pathGradient = ctx.createLinearGradient(fromProj.x, fromProj.y, toProj.x, toProj.y);
          pathGradient.addColorStop(0, 'rgba(59, 130, 246, 0.1)');
          pathGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.25)');
          pathGradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');

          ctx.strokeStyle = pathGradient;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(fromProj.x, fromProj.y);
          ctx.quadraticCurveTo(midX, midY - arcHeight, toProj.x, toProj.y);
          ctx.stroke();

          // Animated particle on path
          const t = conn.progress;
          const bezierX = (1-t)*(1-t)*fromProj.x + 2*(1-t)*t*midX + t*t*toProj.x;
          const bezierY = (1-t)*(1-t)*fromProj.y + 2*(1-t)*t*(midY - arcHeight) + t*t*toProj.y;

          // Draw particle with glow
          const particleGlow = ctx.createRadialGradient(bezierX, bezierY, 0, bezierX, bezierY, 12);
          particleGlow.addColorStop(0, conn.color);
          particleGlow.addColorStop(0.3, conn.color.replace('0.9', '0.4').replace('0.8', '0.3').replace('0.7', '0.2'));
          particleGlow.addColorStop(1, 'rgba(59, 130, 246, 0)');
          ctx.fillStyle = particleGlow;
          ctx.beginPath();
          ctx.arc(bezierX, bezierY, 12, 0, Math.PI * 2);
          ctx.fill();

          // Bright center
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.beginPath();
          ctx.arc(bezierX, bezierY, 2, 0, Math.PI * 2);
          ctx.fill();

          // Update progress
          conn.progress += conn.speed;
          if (conn.progress > 1) {
            conn.progress = 0;
            const fromIdx = Math.floor(Math.random() * cities.length);
            let toIdx = Math.floor(Math.random() * cities.length);
            while (toIdx === fromIdx) {
              toIdx = Math.floor(Math.random() * cities.length);
            }
            conn.from = cities[fromIdx];
            conn.to = cities[toIdx];
          }
        }
      });

      // Draw city nodes
      const projectedCities = cities.map((city, idx) => {
        const rotated = rotatePoint(city, rotationRef.current);
        return {
          ...projectPoint(rotated, centerX, centerY, radius),
          z: rotated.z,
          name: WORLD_CITIES[idx].name,
        };
      });

      // Sort by depth for proper rendering
      projectedCities.sort((a, b) => a.z - b.z);

      projectedCities.forEach(city => {
        if (city.visible && city.z > 0) {
          const alpha = 0.4 + (city.z + 1) / 2 * 0.6;
          const size = 2 + city.scale * 2;

          // Outer glow
          const cityGlow = ctx.createRadialGradient(city.x, city.y, 0, city.x, city.y, size * 4);
          cityGlow.addColorStop(0, `rgba(59, 130, 246, ${alpha * 0.5})`);
          cityGlow.addColorStop(1, 'rgba(59, 130, 246, 0)');
          ctx.fillStyle = cityGlow;
          ctx.beginPath();
          ctx.arc(city.x, city.y, size * 4, 0, Math.PI * 2);
          ctx.fill();

          // City dot
          ctx.fillStyle = `rgba(147, 197, 253, ${alpha})`;
          ctx.beginPath();
          ctx.arc(city.x, city.y, size, 0, Math.PI * 2);
          ctx.fill();

          // Bright center
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
          ctx.beginPath();
          ctx.arc(city.x, city.y, size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw specular highlight
      const specular = ctx.createRadialGradient(
        centerX - radius * 0.4, centerY - radius * 0.4, 0,
        centerX - radius * 0.4, centerY - radius * 0.4, radius * 0.8
      );
      specular.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
      specular.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
      specular.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = specular;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw rim light
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(drawGlobe);
    };

    drawGlobe();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, [rotatePoint, projectPoint]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ display: 'block' }}
      aria-label="Interactive globe visualization showing the Worldwide Bible Web network connecting major cities around the world"
      role="img"
    />
  );
}
