export type SessionMetrics = {
    exercise: string;
    reps: number;
    durationSeconds: number;
    improperReps: number;
    peakAngle?: number;
};

export interface DailySummaryData {
  exercises: {
    name: string;
    sets: { reps: number; incomplete: number }[];
  }[];
  durationSeconds: number;
}

export const getDailyCoachRecommendations = (data: DailySummaryData): string => {
  const { exercises, durationSeconds } = data;
  const totalReps = exercises.reduce((acc, ex) => acc + ex.sets.reduce((sAcc, s) => sAcc + s.reps, 0), 0);
  const totalIncomplete = exercises.reduce((acc, ex) => acc + ex.sets.reduce((sAcc, s) => sAcc + s.incomplete, 0), 0);
  
  let md = `# Pulse Күнделікті Есебі\n\n`;
  md += `**Жалпы көлемі:** ${totalReps} рет · **Жаттығу уақыты:** ${Math.floor(durationSeconds/60)} мин\n\n`;
  
  md += `### Жаттығулар Жиынтығы\n`;
  exercises.forEach(ex => {
    const exReps = ex.sets.reduce((a, b) => a + b.reps, 0);
    const exInc = ex.sets.reduce((a, b) => a + b.incomplete, 0);
    const displayName = ex.name === 'bicep_curl' ? 'Бицепске арналған жаттығу' : 'Отырып-тұру (Squats)';
    md += `- **${displayName.toUpperCase()}**: ${ex.sets.length} сет · ${exReps} рет орындалды (${exInc} қате немесе толық емес)\n`;
  });

  md += `\n### Тереңдетілген AI Талдауы\n`;
  if (totalIncomplete > totalReps * 0.2) {
    md += `Қозғалыс техникасын орындау сапасы төмен деңгейде. Шаршау соңғы сеттердегі техникаңызға айтарлықтай әсер еткен сияқты. Ертең сапаға көбірек көңіл бөліңіз.`;
  } else {
    md += `Тамаша техникалық тұрақтылық! Жүктеме кезінде де қозғалыс техникаңыз тұрақты болды. Сіз жүктемені арттыруға дайынсыз.`;
  }

  md += `\n\n### Келесі Ұсыныстар\n`;
  md += `- **Бицепс**: Төмен түсіру фазасын (эксцентрикті) 2 секундқа баяулату арқылы бұлшықет кернеуін арттырыңыз.\n`;
  md += `- **Отырып-тұру**: Отырудың ең төменгі нүктесінен жоғарыға серпінді қозғалыс жасаңыз.`;

  return md;
};

export const getCoachRecommendations = (metrics: SessionMetrics): string => {
    const { exercise, reps, durationSeconds, improperReps } = metrics;
    
    const displayExercise = exercise.toLowerCase() === 'bicep_curl' ? 'Бицепс' : 'Отырып-тұру (Squats)';
    let summary = `### ${displayExercise} Жаттығу Сетінің Қорытындысы\n\n`;
    summary += `**Жалпы қайталау саны:** ${reps}\n`;
    summary += `**Тиімділік:** ${reps > 0 ? Math.round(((reps - improperReps) / reps) * 100) : 0}%\n\n`;

    const intensity = reps / (durationSeconds / 60);

    if (reps === 0) {
        return "Ешқандай әрекет анықталмады. Денеңіз камераға толық көрінетініне көз жеткізіңіз.";
    }

    summary += `#### Талдау\n`;
    
    if (improperReps > 0) {
        summary += `- **Форма Ескертуі:** Сізде толық амплитудасыз орындалған ${improperReps} қайталау болды. Келесі жолы толық созылуға назар аударыңыз.\n`;
    } else {
        summary += `- **Мінсіз Орындалу:** Сет бойында тамаша қалып пен толық диапазон сақталды.\n`;
    }

    if (intensity < 10) {
        summary += `- **Қарқын:** Жаттығуды тым баяу орындап жатырсыз. Кардио тиімділігін арттыру үшін қарқынды сәл көтеріңіз.\n`;
    } else if (intensity > 30) {
        summary += `- **Қарқын:** Өте жоғары қарқын! Жақсы жылдамдық, бірақ жылдамдық үшін техниканы құрбан етпеңіз.\n`;
    }

    summary += `\n#### Маңызды кеңестер\n`;
    
    if (exercise.toLowerCase() === 'squat' || exercise.toLowerCase() === 'squats' || exercise.toLowerCase() === 'отырып-тұру') {
        summary += `- Өз салмағыңызды өкшеңізге түсіруге тырысыңыз.\n- Қозғалыс кезінде кеудеңізді тік ұстаңыз.`;
    } else {
        summary += `- Шынтақтарыңызды бүйіріңізге бекітіп ұстаңыз.\n- Көтеру кезінде арқаның инерциясын қолданбаңыз.`;
    }

    return summary;
};
