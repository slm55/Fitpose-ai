import { useEffect, useRef, useState, useCallback } from 'react';
import { calculateAngle } from '../lib/pose';
import { speak, playTone, playCorrectSound, playAlertSound } from '../services/voiceService';

export type ExerciseType = 'squat' | 'bicep_curl';

export interface RepStats {
  reps: number;
  incomplete: number;
  lastRepStatus: 'perfect' | 'incomplete' | 'none';
}

const KAZAKH_NUMBERS: string[] = [
  "нөл", "бір", "екі", "үш", "төрт", "бес", "алты", "жеті", "сегіз", "тоғыз", "он",
  "он бір", "он екі", "он үш", "он төрт", "он бес", "он алты", "он жеті", "он сегіз", "он тоғыз", "жиырма",
  "жиырма бір", "жиырма екі", "жиырма үш", "жиырма төрт", "жиырма бес", "жиырма алты", "жиырма жеті", "жиырма сегіз", "жиырма тоғыз", "отыз"
];

const toKazakhNumber = (num: number): string => {
  if (num >= 0 && num < KAZAKH_NUMBERS.length) {
    return KAZAKH_NUMBERS[num];
  }
  return String(num);
};

export const useExerciseCounter = (landmarks: any[], exerciseType: ExerciseType, isActive: boolean) => {
  const [stats, setStats] = useState<RepStats>({
    reps: 0,
    incomplete: 0,
    lastRepStatus: 'none',
  });
  
  const [currentAngle, setCurrentAngle] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const stageRef = useRef<'up' | 'down'>('up');
  const maxDepthRef = useRef<number>(0);

  const resetStats = useCallback(() => {
    setStats({
      reps: 0,
      incomplete: 0,
      lastRepStatus: 'none',
    });
    setProgress(0);
    setCurrentAngle(0);
    stageRef.current = 'up';
    maxDepthRef.current = 0;
  }, []);

  useEffect(() => {
    if (!landmarks || landmarks.length === 0 || !isActive) return;
    const pose = landmarks[0];

    // Determine the dominant visible side of the body
    let scoreLeft = 0;
    let scoreRight = 0;

    if (exerciseType === 'squat') {
      scoreLeft = (pose[24]?.score || 0) + (pose[26]?.score || 0) + (pose[28]?.score || 0);
      scoreRight = (pose[23]?.score || 0) + (pose[25]?.score || 0) + (pose[27]?.score || 0);
    } else {
      scoreLeft = (pose[11]?.score || 0) + (pose[13]?.score || 0) + (pose[15]?.score || 0);
      scoreRight = (pose[12]?.score || 0) + (pose[14]?.score || 0) + (pose[16]?.score || 0);
    }

    const side = scoreLeft >= scoreRight ? 'left' : 'right';

    let angle = 0;
    let upBound = 160;
    let downBound = 90;

    if (exerciseType === 'squat') {
      const hip = pose[side === 'left' ? 24 : 23];
      const knee = pose[side === 'left' ? 26 : 25];
      const ankle = pose[side === 'left' ? 28 : 27];
      if (hip && knee && ankle) {
        angle = calculateAngle(hip, knee, ankle);
        upBound = 165; downBound = 120; // range for detection
      }
    } else if (exerciseType === 'bicep_curl') {
      const shoulder = pose[side === 'left' ? 11 : 12];
      const elbow = pose[side === 'left' ? 13 : 14];
      const wrist = pose[side === 'left' ? 15 : 16];
      if (shoulder && elbow && wrist) {
        angle = calculateAngle(shoulder, elbow, wrist);
        upBound = 150; downBound = 90; // range for detection
      }
    }

    if (angle === 0) return;

    const currentSideAngle = Math.round(angle);
    setCurrentAngle(currentSideAngle);

    // Normalized progress bar progress
    const isSquat = exerciseType === 'squat';
    let normProg = 0;
    if (isSquat) {
      normProg = Math.min(100, Math.max(0, ((170 - angle) / (170 - 90)) * 100));
    } else {
      normProg = Math.min(100, Math.max(0, ((160 - angle) / (160 - 45)) * 100));
    }
    setProgress(normProg);

    // Track max depth / contraction during the execution phase
    if (stageRef.current === 'down') {
      maxDepthRef.current = Math.min(maxDepthRef.current || 180, angle);
    }

    // Single counter triggers
    const isFullyUp = angle > upBound - 10;
    const isGoingDown = angle < downBound;

    if (isFullyUp) {
      if (stageRef.current === 'down') {
        const depthAchieved = maxDepthRef.current;
        const isPerfect = isSquat ? depthAchieved <= 100 : depthAchieved <= 60;
        
        setStats(prev => {
          const updated = { ...prev };
          if (isPerfect) {
            updated.reps += 1;
            updated.lastRepStatus = 'perfect';
            playCorrectSound();
            speak(toKazakhNumber(updated.reps));
          } else {
            updated.incomplete += 1;
            updated.lastRepStatus = 'incomplete';
            playAlertSound();
            speak("Тереңірек"); // Kazakh for 'go deeper' or 'deeper'
          }
          return updated;
        });

        setTimeout(() => {
          setStats(prev => ({ ...prev, lastRepStatus: 'none' }));
        }, 1200);
      }
      stageRef.current = 'up';
    } else if (isGoingDown) {
      if (stageRef.current === 'up') {
        maxDepthRef.current = angle;
      }
      stageRef.current = 'down';
    }

  }, [landmarks, exerciseType, isActive]);

  return { stats, currentAngle, progress, resetStats };
};
export { toKazakhNumber };
