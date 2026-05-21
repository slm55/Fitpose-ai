import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Flame, User, Zap, Clock, Dumbbell, Trophy, History, Play, CircleStop as StopCircle } from 'lucide-react';
import { CameraView } from './components/CameraView';
import { useExerciseCounter, ExerciseType, RepStats, toKazakhNumber } from './hooks/useExerciseCounter';
import { getCoachRecommendations, getDailyCoachRecommendations, SessionMetrics } from './services/coachService';
import ReactMarkdown from 'react-markdown';
import { speak } from './services/voiceService';

const EXERCISES: { id: ExerciseType; label: string }[] = [
  { id: 'squat', label: 'Отырып-тұру (Squats)' },
  { id: 'bicep_curl', label: 'Бицепс (Curls)' },
];

interface WorkoutSession {
  date: string;
  exercises: {
    name: string;
    sets: { reps: number; incomplete: number }[];
  }[];
}

export default function App() {
  const [isWorkoutDayActive, setIsWorkoutDayActive] = useState(false);
  const [isSetActive, setIsSetActive] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType>('squat');
  const [landmarks, setLandmarks] = useState<any[]>([]);
  
  const { stats, currentAngle, progress, resetStats } = useExerciseCounter(landmarks, selectedExercise, isSetActive);
  
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [currentSessionExercises, setCurrentSessionExercises] = useState<Record<string, { reps: number; incomplete: number }[]>>({});
  
  const [timer, setTimer] = useState(0);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pulse_fit_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (isWorkoutDayActive) {
      timerInterval.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerInterval.current) clearInterval(timerInterval.current);
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [isWorkoutDayActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startWorkoutDay = () => {
    setIsWorkoutDayActive(true);
    setCurrentSessionExercises({});
    setTimer(0);
    setSessionSummary(null);
    speak("Жаттығу күні басталды. Бірінші жаттығу түрін таңдаңыз.");
  };

  const endWorkoutDay = () => {
    const newSession: WorkoutSession = {
      date: new Date().toLocaleDateString('kk-KZ'),
      exercises: Object.entries(currentSessionExercises).map(([name, sets]) => ({ name, sets }))
    };
    
    const updatedHistory = [newSession, ...history].slice(0, 5);
    setHistory(updatedHistory);
    localStorage.setItem('pulse_fit_history', JSON.stringify(updatedHistory));
    
    setIsWorkoutDayActive(false);
    setIsSetActive(false);
    
    // Generate Kazakh Final AI Recommendation
    const rec = getDailyCoachRecommendations({
      exercises: newSession.exercises,
      durationSeconds: timer
    });
    
    setSessionSummary(rec);
    speak("Бүгінгі жаттығу күні аяқталды. Толық талдау есебі дайын.");
  };

  const toggleSet = () => {
    if (!isSetActive) {
      setIsSetActive(true);
      resetStats();
      const exerciseNameText = selectedExercise === 'squat' ? 'Отырып-тұру' : 'Бицепс қол бүгу';
      speak(`${exerciseNameText} жаттығуы басталды. Сәттілік!`);
    } else {
      const totalReps = stats.reps;
      const totalIncomplete = stats.incomplete;
      
      setCurrentSessionExercises(prev => ({
        ...prev,
        [selectedExercise]: [...(prev[selectedExercise] || []), { reps: totalReps, incomplete: totalIncomplete }]
      }));
      
      setIsSetActive(false);
      speak(`Сет аяқталды. Жалпы ${toKazakhNumber(totalReps)} рет тамаша орындалды!`);
    }
  };

  const getBackgroundClass = () => {
    if (stats.lastRepStatus === 'perfect') return 'bg-emerald-950/40';
    if (stats.lastRepStatus === 'incomplete') return 'bg-amber-950/40';
    return 'bg-slate-950';
  };

  return (
    <div className={`h-screen text-slate-100 flex flex-col font-sans overflow-hidden select-none transition-colors duration-300 ${getBackgroundClass()}`}>
      {/* Top Navigation Bar */}
      <nav className="h-16 flex items-center justify-between px-8 bg-slate-900/50 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity className="w-5 h-5 text-slate-950" />
          </div>
          <span className="font-bold text-xl tracking-tight uppercase">PULSE <span className="text-cyan-400">VISION</span></span>
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 uppercase tracking-widest tracking-tighter">Уақыт</span>
            <span className="text-lg font-mono text-cyan-400">{formatTime(timer)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Dumbbell className={`w-4 h-4 ${isSetActive ? 'text-cyan-400 animate-bounce' : 'text-slate-500'}`} />
            <span className="text-xs text-slate-400 uppercase tracking-widest tracking-tighter">Ағымдағы</span>
            <span className="text-lg font-mono text-cyan-400 uppercase">
              {selectedExercise === 'squat' ? 'Отырып-тұру' : 'Бицепс'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
            <User className="w-4 h-4" />
            ПРОФИЛЬ
          </button>
        </div>
      </nav>

      <main className="flex-1 lg:grid lg:grid-cols-12 relative overflow-hidden bg-slate-950">
        {/* Camera View - Takes up full screen on mobile, 8-columns on desktop */}
        <div className="absolute inset-0 lg:relative lg:col-span-8 bg-black flex flex-col overflow-hidden z-0">
          <div className="flex-1 relative h-full w-full">
            <CameraView onLandmarks={setLandmarks} active={true} />
            
            <div className="absolute top-20 lg:top-6 left-6 flex flex-col gap-2 pointer-events-none z-20">
              <span className="bg-slate-900/80 backdrop-blur-md border border-slate-700 px-3 py-1 rounded text-xs text-cyan-400 font-bold uppercase tracking-tighter/50 italic">Камера белсенді</span>
              {isSetActive && (
                <div className="flex gap-2">
                   <div className="px-3 py-1 bg-cyan-500/20 border border-cyan-500 rounded backdrop-blur-sm">
                    <span className="text-[10px] text-cyan-400 font-black uppercase">Тікелей талдау қосылды</span>
                  </div>
                </div>
              )}
            </div>

            {/* Rep Status UI Overlays */}
            <AnimatePresence>
              {stats.lastRepStatus !== 'none' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                >
                  <div className={`px-12 py-6 rounded-full border-4 backdrop-blur-md ${
                    stats.lastRepStatus === 'perfect'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                    : 'bg-amber-500/20 border-amber-500 text-amber-400'
                  }`}>
                    <span className="text-4xl font-black italic uppercase tracking-tighter">
                      {stats.lastRepStatus === 'perfect' ? 'КЕРЕМЕТ!' : 'ТЕРЕҢІРЕК ТҮСІҢІЗ'}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!isWorkoutDayActive && !sessionSummary && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-6 text-center z-30">
              <div className="max-w-md bg-slate-900 p-10 rounded-[32px] border border-white/10 shadow-3xl">
                <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Flame className="w-8 h-8 text-cyan-400" />
                </div>
                <h2 className="text-4xl font-black italic tracking-tighter mb-4">ЖАТТЫҒУДЫ БАСТАУ?</h2>
                <p className="text-slate-400 text-sm mb-10 leading-relaxed uppercase font-bold tracking-widest">Компьютерлік көру технологиясы арқылы қозғалыс техникаңызды бақылаңыз.</p>
                <button 
                  onClick={startWorkoutDay}
                  className="w-full py-5 bg-white text-slate-950 font-black rounded-2xl uppercase tracking-[0.2em] hover:bg-cyan-400 hover:scale-[1.02] transition-all shadow-2xl active:scale-95"
                >
                  Жаттықтыруды бастау
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Sidebar (Only seen on large screens) */}
        <aside className="hidden lg:flex lg:col-span-4 bg-slate-900/30 border-l border-slate-800 flex-col overflow-hidden h-full z-10">
          {isWorkoutDayActive && !sessionSummary && (
            <div className="flex flex-col h-full bg-slate-900/10">
              {/* Exercise Selection */}
              {!isSetActive && (
                <div className="p-6 border-b border-slate-800 shrink-0">
                  <h2 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-4 font-bold">Жаттығу Түрін Таңдаңыз</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {EXERCISES.map((ex) => (
                      <button
                        key={ex.id}
                        onClick={() => setSelectedExercise(ex.id)}
                        className={`p-4 rounded-2xl border text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-2 ${
                          selectedExercise === ex.id 
                            ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400' 
                            : 'bg-slate-800/20 border-white/5 text-slate-500 hover:border-white/10'
                        }`}
                      >
                        <Zap className={selectedExercise === ex.id ? 'text-cyan-400 w-4 h-4' : 'text-slate-700 w-4 h-4'} />
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Single Side Metric Block */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {selectedExercise === 'squat' ? 'Отырып-тұру бақылауы' : 'Қол бүгу бақылауы'}
                    </span>
                  </div>
                  
                  <div className="bg-slate-800/40 p-6 rounded-3xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-slate-850">
                      <motion.div 
                        className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="relative z-10 flex justify-between items-center">
                      <div>
                        <div className="text-6xl font-black italic tracking-tighter text-white mb-1">{stats.reps}</div>
                        <div className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">Дұрыс қайталау</div>
                      </div>
                      
                      {stats.incomplete > 0 && (
                        <div className="text-right">
                          <div className="text-3xl font-black text-amber-500 italic tracking-tighter">{stats.incomplete}</div>
                          <div className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">Толық емес</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <div className="bg-slate-800/20 p-3 rounded-2xl border border-white/5 flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Буын бұрышы:</span>
                      <span className="text-xs font-mono text-cyan-400 font-bold">{currentAngle}°</span>
                    </div>
                    <div className="bg-slate-800/20 p-3 rounded-2xl border border-white/5 flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Барысы:</span>
                      <span className="text-xs font-mono text-cyan-400 font-bold">{Math.round(progress)}%</span>
                    </div>
                  </div>
                </div>

                {/* History Quick View */}
                {history.length > 0 && !isSetActive && (
                  <div className="mt-8 pt-8 border-t border-slate-800">
                    <h2 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-4 font-bold flex items-center gap-2">
                      <History className="w-3 h-3" /> Соңғы нәтижелер
                    </h2>
                    <div className="space-y-3">
                      {history[0].exercises.map((ex, i) => {
                        const displayName = ex.name === 'bicep_curl' ? 'Бицепс' : 'Отырып-тұру';
                        return (
                          <div key={i} className="flex justify-between items-center text-xs bg-slate-800/20 p-3 rounded-xl border border-white/5">
                            <span className="text-slate-400 uppercase font-black">{displayName}</span>
                            <span className="font-mono text-cyan-400">{ex.sets.reduce((a, b) => a + b.reps, 0)} Қайталау</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Area */}
              <div className="p-6 bg-slate-900/50 border-t border-slate-800 flex flex-col gap-3">
                <button 
                  onClick={toggleSet}
                  className={`w-full py-5 font-black rounded-2xl uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 ${
                    isSetActive 
                      ? 'bg-rose-500 text-white hover:bg-rose-600 animate-pulse' 
                      : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                  }`}
                >
                  {isSetActive ? <StopCircle className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                  {isSetActive ? 'Сетті аяқтау' : 'Сетті бастау'}
                </button>
                {!isSetActive && (
                  <button 
                    onClick={endWorkoutDay}
                    className="w-full py-4 text-rose-500 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-rose-500/10 rounded-2xl transition-all"
                  >
                    Бүгінгі жаттығуды аяқтау
                  </button>
                )}
              </div>
            </div>
          )}

          {sessionSummary && (
            <div className="p-8 h-full flex flex-col overflow-y-auto bg-slate-900/50">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6">
                <Trophy className="text-emerald-500" />
              </div>
              <div className="markdown-body prose prose-invert overflow-y-auto flex-1">
                <ReactMarkdown>{sessionSummary}</ReactMarkdown>
              </div>
              <button 
                onClick={() => setSessionSummary(null)}
                className="mt-8 py-5 bg-white text-slate-950 font-black rounded-2xl uppercase tracking-[0.2em] hover:bg-cyan-400 transition-all"
              >
                Жинақтамаға оралу
              </button>
            </div>
          )}
        </aside>

        {/* Mobile / Tablet Fluid Floating Overlays (Covering full camera viewport) */}
        <div className="lg:hidden absolute inset-0 pointer-events-none z-20">
          {isWorkoutDayActive && !sessionSummary && (
            <>
              {/* 1. Floating Top Live Stats badge - Only visible during active exercise */}
              {isSetActive ? (
                <div className="absolute top-20 inset-x-4 p-4 bg-slate-950/85 backdrop-blur-md border border-white/10 rounded-[22px] flex items-center justify-between shadow-2xl pointer-events-auto">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <Dumbbell className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                      <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">
                        {selectedExercise === 'squat' ? 'Отырып-тұру' : 'Бицепс'}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-300">Бұрыш: <span className="text-cyan-400 font-bold">{currentAngle}°</span></div>
                  </div>

                  <div className="flex gap-4 items-center">
                    <div className="text-center bg-cyan-950/40 border border-cyan-400/20 px-4 py-1.5 rounded-xl">
                      <div className="text-2xl font-black italic tracking-tighter text-white leading-none">{stats.reps}</div>
                      <div className="text-[8px] font-bold text-cyan-400 uppercase tracking-widest mt-1">Рет</div>
                    </div>

                    {stats.incomplete > 0 && (
                      <div className="text-center bg-amber-950/40 border border-amber-400/20 px-3 py-1.5 rounded-xl">
                        <div className="text-2xl font-black italic tracking-tighter text-amber-500 leading-none">{stats.incomplete}</div>
                        <div className="text-[8px] font-bold text-amber-400 uppercase tracking-widest mt-1">Қате</div>
                      </div>
                    )}
                  </div>

                  {/* Horizontal visual progress bar */}
                  <div className="absolute bottom-0 inset-x-4 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-cyan-400"
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: 'easeOut', duration: 0.1 }}
                    />
                  </div>
                </div>
              ) : null}

              {/* 2. Floating Dashboard Controls Sheet - Visible when set is NOT running */}
              {!isSetActive ? (
                <div className="absolute bottom-16 inset-x-4 p-5 bg-slate-950/90 backdrop-blur-lg border border-white/10 rounded-[24px] shadow-2xl flex flex-col gap-4 pointer-events-auto max-h-[50%] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div>
                      <h2 className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">Жаттығу Түрін Таңдаңыз</h2>
                      <p className="text-xs text-slate-300 uppercase font-bold mt-0.5">Келбетті тік ұстаңыз</p>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-cyan-400 text-xs font-bold bg-cyan-950/20 border border-cyan-500/20 px-2.5 py-1 rounded-full">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTime(timer)}
                    </div>
                  </div>

                  {/* Exercise choice panel */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {EXERCISES.map((ex) => (
                      <button
                        key={ex.id}
                        onClick={() => setSelectedExercise(ex.id)}
                        className={`p-3.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1.5 ${
                          selectedExercise === ex.id 
                            ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400' 
                            : 'bg-slate-800/10 border-white/5 text-slate-500 hover:border-white/10'
                        }`}
                      >
                        <Zap className={selectedExercise === ex.id ? 'text-cyan-400 w-3.5 h-3.5' : 'text-slate-700 w-3.5 h-3.5'} />
                        {ex.label}
                      </button>
                    ))}
                  </div>

                  {/* Core Action triggers */}
                  <div className="flex flex-col gap-2 mt-1">
                    <button 
                      onClick={toggleSet}
                      className="w-full py-4 bg-cyan-500 text-slate-950 font-black rounded-xl uppercase tracking-[0.15em] text-xs hover:bg-cyan-400 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Сетті бастау
                    </button>
                    <button 
                      onClick={endWorkoutDay}
                      className="w-full py-2 text-rose-500 text-[10px] font-black uppercase tracking-[0.15em] hover:bg-rose-500/10 rounded-xl transition-all"
                    >
                      Бүгінгі жаттығуды аяқтау
                    </button>
                  </div>
                </div>
              ) : (
                /* 3. Floating Stop button - Visible during active exercising set */
                <div className="absolute bottom-20 inset-x-4 flex justify-center pointer-events-auto">
                  <button
                    onClick={toggleSet}
                    className="w-full max-w-sm py-4 bg-rose-500 text-white font-black rounded-xl uppercase tracking-[0.15em] text-xs hover:bg-rose-600 transition-all shadow-2xl active:scale-[0.98] flex items-center justify-center gap-2 animate-pulse"
                  >
                    <StopCircle className="w-4 h-4" />
                    Сетті аяқтау
                  </button>
                </div>
              )}
            </>
          )}

          {/* 4. Full screen Kazakh Summary Overlay Report for mobile users */}
          {sessionSummary && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl z-40 p-6 flex flex-col overflow-y-auto pointer-events-auto">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 shrink-0">
                <Trophy className="text-emerald-500 w-6 h-6" />
              </div>
              <div className="markdown-body prose prose-invert overflow-y-auto flex-1 text-slate-100 mb-6 max-w-none">
                <ReactMarkdown>{sessionSummary}</ReactMarkdown>
              </div>
              <button 
                onClick={() => setSessionSummary(null)}
                className="w-full py-4 bg-white text-slate-950 font-black rounded-xl uppercase tracking-[0.15em] text-xs hover:bg-cyan-400 transition-all shrink-0 active:scale-95"
              >
                Жинақтамаға оралу
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Toolbar */}
      <footer className="h-10 bg-slate-900 border-t border-slate-800 flex items-center px-8 justify-between shrink-0">
        <div className="flex gap-1 items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse mr-2"></div>
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">AI ТАЛДАУ ЖҮЙЕСІ V3.0 • ДАЙЫН</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[9px] text-slate-600 font-mono font-bold tracking-widest uppercase italic">Камера кідірісісіз жылдам талдау</span>
        </div>
      </footer>
    </div>
  );
}
