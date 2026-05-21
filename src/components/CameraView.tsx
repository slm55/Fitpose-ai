import React, { useEffect, useRef, useState } from 'react';
import { initPoseDetection } from '../lib/pose';
import { PoseLandmarker } from '@mediapipe/tasks-vision';

interface CameraViewProps {
  onLandmarks: (landmarks: any[]) => void;
  active: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({ onLandmarks, active }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  useEffect(() => {
    let animationFrameId: number;

    const startCamera = async () => {
      try {
        const landmarker = await initPoseDetection();
        landmarkerRef.current = landmarker;
        setLoading(false);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera Error:', err);
        setError('Could not access camera or load AI model. Please check permissions.');
        setLoading(false);
      }
    };

    if (active) {
      startCamera();
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [active]);

  useEffect(() => {
    let animationFrameId: number;
    
    const processFrame = () => {
      if (!active || !videoRef.current || !landmarkerRef.current || videoRef.current.readyState !== 4) {
        animationFrameId = requestAnimationFrame(processFrame);
        return;
      }

      const results = landmarkerRef.current.detectForVideo(videoRef.current, performance.now());
      
      if (results.landmarks) {
        onLandmarks(results.landmarks);
        drawSkeleton(results.landmarks);
      }

      animationFrameId = requestAnimationFrame(processFrame);
    };

    const drawSkeleton = (landmarks: any[]) => {
      if (!canvasRef.current || !videoRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const { width: containerWidth, height: containerHeight } = videoRef.current.getBoundingClientRect();
      canvasRef.current.width = containerWidth;
      canvasRef.current.height = containerHeight;

      ctx.clearRect(0, 0, containerWidth, containerHeight);

      const videoWidth = videoRef.current.videoWidth || 1280;
      const videoHeight = videoRef.current.videoHeight || 720;

      const scale = Math.max(containerWidth / videoWidth, containerHeight / videoHeight);
      const renderedWidth = videoWidth * scale;
      const renderedHeight = videoHeight * scale;

      const offsetX = (containerWidth - renderedWidth) / 2;
      const offsetY = (containerHeight - renderedHeight) / 2;

      landmarks.forEach((pose) => {
        ctx.strokeStyle = '#22c55e'; // green-500
        ctx.lineWidth = 3;

        pose.forEach((landmark: any) => {
          ctx.beginPath();
          const cx = landmark.x * renderedWidth + offsetX;
          const cy = landmark.y * renderedHeight + offsetY;
          ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
          ctx.fillStyle = '#22c55e';
          ctx.fill();
        });
      });
    };

    if (active && !loading) {
      animationFrameId = requestAnimationFrame(processFrame);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [active, loading, onLandmarks]);

  return (
    <div className="relative w-full h-full bg-zinc-950 overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80 backdrop-blur-sm z-20">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-emerald-500 font-medium animate-pulse">Initializing Pulse AI...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-20 p-6 text-center">
          <p className="text-red-400 font-medium mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover -scale-x-100"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none -scale-x-100"
      />
      
      {!loading && !error && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-zinc-900/60 backdrop-blur-md rounded-full border border-white/10">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Live Tracking</span>
        </div>
      )}
    </div>
  );
};
