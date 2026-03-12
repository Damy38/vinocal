import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Camera, Upload, Wine, Utensils, Loader2, RefreshCcw, ChevronRight, Target, Leaf, ShoppingCart, Plus, CheckCircle2, Smartphone, Coffee, Activity as ActivityIcon, Clock, Flame, BarChart3, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell } from 'recharts';
import { analyzePlate, analyzeTextDescription, AnalysisResult } from './services/gemini';

interface Activity {
  id: string;
  sport: string;
  duration: number; // minutes
  calories: number;
  timestamp: string;
}

interface DailyLog {
  date: string; // Format: YYYY-MM-DD
  calories: number;
  protein: number;
  caloriesBurned: number;
  activities: Activity[];
}

const MET_VALUES: Record<string, number> = {
  'marche': 3.5,
  'course': 8.3,
  'vélo': 8.0,
  'natation': 7.0,
  'yoga': 2.5,
  'musculation': 5.0,
  'tennis': 7.3,
  'football': 10.0,
  'basket': 8.0,
  'randonnée': 6.0,
  'danse': 4.5,
  'pilates': 3.0,
  'crossfit': 12.0,
  'squash': 12.0,
  'boxe': 10.0,
  'corde': 11.0,
  'vélo elliptique': 5.0,
  'escalade': 8.0
};

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DailyLog[]>([]);
  const [isAdded, setIsAdded] = useState(false);
  const [showInstallInfo, setShowInstallInfo] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [manualDescription, setManualDescription] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'nutrition' | 'sport' | 'stats'>('nutrition');
  const [sportInput, setSportInput] = useState({ sport: '', duration: '', calories: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-calculate calories based on sport and duration
  useEffect(() => {
    if (sportInput.sport && sportInput.duration) {
      const sportLower = sportInput.sport.toLowerCase();
      let met = 0;
      
      // Find matching sport
      for (const [key, value] of Object.entries(MET_VALUES)) {
        if (sportLower.includes(key)) {
          met = value;
          break;
        }
      }
      
      if (met > 0) {
        const weight = 70; // Assume 70kg average
        const durationHours = parseInt(sportInput.duration) / 60;
        if (!isNaN(durationHours) && durationHours > 0) {
          const calculatedCalories = Math.round(met * weight * durationHours);
          setSportInput(prev => ({ ...prev, calories: calculatedCalories.toString() }));
        }
      }
    }
  }, [sportInput.sport, sportInput.duration]);

  // Detect platform and handle install prompt
  useEffect(() => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    setPlatform(isIOS ? 'ios' : isAndroid ? 'android' : 'other');

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallInfo(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (!isStandalone) {
      const timer = setTimeout(() => {
        setShowInstallInfo(true);
      }, 2000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          setShowInstallInfo(false);
        }
      } catch (err) {
        console.error("Installation failed", err);
        setShowInstructions(true);
      }
    } else {
      setShowInstructions(true);
    }
  };

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('vinoCal_history');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration for new fields
      const migrated = parsed.map((log: any) => ({
        ...log,
        protein: log.protein || 0,
        caloriesBurned: log.caloriesBurned || 0,
        activities: log.activities || []
      }));
      setHistory(migrated);
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('vinoCal_history', JSON.stringify(history));
    }
  }, [history]);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLog = history.find(log => log.date === todayStr) || { date: todayStr, calories: 0, protein: 0, caloriesBurned: 0, activities: [] };

  const getStatsForPeriod = (days: number) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return history
      .filter(log => new Date(log.date) >= cutoff)
      .reduce((acc, log) => ({
        calories: acc.calories + log.calories,
        protein: acc.protein + (log.protein || 0),
        caloriesBurned: acc.caloriesBurned + (log.caloriesBurned || 0)
      }), { calories: 0, protein: 0, caloriesBurned: 0 });
  };

  const statsWeek = getStatsForPeriod(7);
  const statsMonth = getStatsForPeriod(30);
  const statsYear = getStatsForPeriod(365);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
        setIsAdded(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image && !manualDescription) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const data = image 
        ? await analyzePlate(image)
        : await analyzeTextDescription(manualDescription);
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Une erreur est survenue lors de l'analyse. Veuillez réessayer.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addToDaily = () => {
    if (!result || isAdded) return;
    
    setHistory(prev => {
      const existingIdx = prev.findIndex(log => log.date === todayStr);
      if (existingIdx >= 0) {
        const newHistory = [...prev];
        newHistory[existingIdx] = {
          ...newHistory[existingIdx],
          calories: newHistory[existingIdx].calories + result.totalCalories,
          protein: (newHistory[existingIdx].protein || 0) + result.totalProtein
        };
        return newHistory;
      } else {
        return [...prev, {
          date: todayStr,
          calories: result.totalCalories,
          protein: result.totalProtein,
          caloriesBurned: 0,
          activities: []
        }];
      }
    });
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 3000);
  };

  const addActivity = () => {
    if (!sportInput.sport || !sportInput.duration || !sportInput.calories) return;
    
    const newActivity: Activity = {
      id: Math.random().toString(36).substr(2, 9),
      sport: sportInput.sport,
      duration: parseInt(sportInput.duration),
      calories: parseInt(sportInput.calories),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setHistory(prev => {
      const existingIdx = prev.findIndex(log => log.date === todayStr);
      if (existingIdx >= 0) {
        const newHistory = [...prev];
        newHistory[existingIdx] = {
          ...newHistory[existingIdx],
          caloriesBurned: (newHistory[existingIdx].caloriesBurned || 0) + newActivity.calories,
          activities: [...(newHistory[existingIdx].activities || []), newActivity]
        };
        return newHistory;
      }
      return [...prev, { 
        date: todayStr, 
        calories: 0, 
        protein: 0, 
        caloriesBurned: newActivity.calories, 
        activities: [newActivity] 
      }];
    });
    setSportInput({ sport: '', duration: '', calories: '' });
  };

  const chartData = history.slice(-7).map(log => ({
    date: log.date.split('-').slice(1).join('/'),
    consommé: log.calories,
    dépensé: log.caloriesBurned || 0,
    net: log.calories - (log.caloriesBurned || 0)
  }));

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setIsAdded(false);
    setManualDescription('');
    setIsManualMode(false);
  };

  return (
    <div className="min-h-screen bg-[#f5f2ed] text-[#1a1a1a] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="border-b border-black/5 bg-white/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Wine className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">VinoCal</h1>
          </div>
          <div className="flex items-center gap-4">
            {!window.matchMedia('(display-mode: standalone)').matches && (
              <button 
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Installer
              </button>
            )}
            {(image || manualDescription || result) && (
              <button 
                onClick={reset}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
              >
                <RefreshCcw className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showInstallInfo && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="bg-emerald-600 text-white px-6 py-4 text-sm font-bold flex items-center justify-between sticky top-[73px] z-10 shadow-xl cursor-pointer hover:bg-emerald-700 transition-colors border-b border-emerald-500"
            onClick={handleInstallClick}
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Plus className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span>Installer l'application VinoCal</span>
                <span className="text-[10px] opacity-80 font-normal uppercase tracking-wider">Cliquez ici pour un accès rapide</span>
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowInstallInfo(false);
              }} 
              className="bg-black/10 hover:bg-black/20 p-2 rounded-full transition-colors"
            >
              <RefreshCcw className="w-4 h-4 rotate-45" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Installation Instructions Modal */}
      <AnimatePresence>
        {showInstructions && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-white w-full max-w-sm rounded-3xl p-8 space-y-6 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold">Installer VinoCal</h3>
                <p className="text-gray-500 text-sm">
                  {platform === 'ios' 
                    ? "Suivez ces étapes pour installer l'application sur votre iPhone :" 
                    : "Suivez ces étapes pour installer l'application sur votre Android :"}
                </p>
              </div>

              <div className="space-y-4">
                {platform === 'ios' ? (
                  <>
                    <div className="flex items-start gap-4">
                      <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                      <p className="text-sm">Appuyez sur le bouton <strong>Partager</strong> dans Safari.</p>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                      <p className="text-sm">Appuyez sur <strong>Sur l'écran d'accueil</strong>.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-4">
                      <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                      <p className="text-sm">Appuyez sur les <strong>trois points (⋮)</strong> en haut à droite de Chrome.</p>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                      <p className="text-sm">Sélectionnez <strong>Installer l'application</strong> ou <strong>Ajouter à l'écran d'accueil</strong>.</p>
                    </div>
                  </>
                )}
                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{platform === 'ios' ? '3' : '3'}</div>
                  <p className="text-sm">Confirmez en appuyant sur <strong>Ajouter</strong> ou <strong>Installer</strong>.</p>
                </div>
              </div>

              <button
                onClick={() => setShowInstructions(false)}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-colors"
              >
                J'ai compris
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Navigation Tabs */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/80 backdrop-blur-xl border border-black/5 rounded-full p-1.5 shadow-2xl flex items-center gap-1">
        <button
          onClick={() => setActiveTab('nutrition')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all ${activeTab === 'nutrition' ? 'bg-black text-white shadow-lg' : 'text-gray-500 hover:bg-black/5'}`}
        >
          <Utensils className="w-4 h-4" />
          <span className="hidden sm:inline">Nutrition</span>
        </button>
        <button
          onClick={() => setActiveTab('sport')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all ${activeTab === 'sport' ? 'bg-black text-white shadow-lg' : 'text-gray-500 hover:bg-black/5'}`}
        >
          <ActivityIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Sport</span>
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all ${activeTab === 'stats' ? 'bg-black text-white shadow-lg' : 'text-gray-500 hover:bg-black/5'}`}
        >
          <BarChart3 className="w-4 h-4" />
          <span className="hidden sm:inline">Stats</span>
        </button>
      </div>

      <main className="max-w-2xl mx-auto px-6 pt-24 pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'nutrition' && (
            <motion.div
              key="nutrition"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Daily Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Consommé</p>
                  <p className="text-2xl font-medium tracking-tight">{todayLog.calories}<span className="text-xs ml-1 text-gray-400">kcal</span></p>
                </div>
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Dépensé</p>
                  <p className="text-2xl font-medium tracking-tight text-emerald-500">{todayLog.caloriesBurned || 0}<span className="text-xs ml-1 text-gray-400">kcal</span></p>
                </div>
                <div className="bg-black rounded-3xl p-5 shadow-xl">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Net</p>
                  <p className="text-2xl font-medium tracking-tight text-white">{todayLog.calories - (todayLog.caloriesBurned || 0)}<span className="text-xs ml-1 text-white/30">kcal</span></p>
                </div>
              </div>

              {/* Cumulative Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-2xl p-3 border border-black/5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">7 Jours</p>
                  <p className="text-sm font-medium">{statsWeek.calories - statsWeek.caloriesBurned} <span className="text-[10px] text-gray-400">net</span></p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-3 border border-black/5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">30 Jours</p>
                  <p className="text-sm font-medium">{statsMonth.calories - statsMonth.caloriesBurned} <span className="text-[10px] text-gray-400">net</span></p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-3 border border-black/5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Année</p>
                  <p className="text-sm font-medium">{statsYear.calories - statsYear.caloriesBurned} <span className="text-[10px] text-gray-400">net</span></p>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-center text-sm font-medium mb-6">
                  {error}
                </div>
              )}

              {!image && !isManualMode && !result ? (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="text-center space-y-4">
                    <h2 className="text-4xl font-light serif leading-tight">
                      Atteignez vos <span className="italic text-emerald-700">objectifs</span> santé
                    </h2>
                    <p className="text-gray-500 max-w-md mx-auto">
                      Analysez vos repas par photo ou description, suivez vos calories et protéines.
                    </p>
                  </div>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative h-48 border-2 border-dashed border-gray-300 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all cursor-pointer overflow-hidden"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Camera className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">Prendre une photo</p>
                    <p className="text-sm text-gray-400 italic">Analyse visuelle instantanée</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                  />
                </button>

                <button
                  onClick={() => setIsManualMode(true)}
                  className="group relative h-32 bg-white border border-black/5 rounded-3xl flex items-center gap-6 px-8 hover:bg-emerald-50/30 hover:border-emerald-200 transition-all cursor-pointer"
                >
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Utensils className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Saisie manuelle</p>
                    <p className="text-sm text-gray-400">Décrivez votre repas par écrit</p>
                  </div>
                  <ChevronRight className="w-5 h-5 ml-auto text-gray-300 group-hover:text-emerald-500 transition-colors" />
                </button>
              </div>
            </motion.div>
              ) : isManualMode && !result ? (
                <motion.div
                  key="manual"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Utensils className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold">Description du repas</h3>
                </div>
                <textarea
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="Ex: Un pancake protéiné de 50g avec une pâte à tartiner protéinée..."
                  className="w-full h-32 p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 resize-none text-sm"
                />
                <button
                  onClick={handleAnalyze}
                  disabled={!manualDescription || isAnalyzing}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      Analyser la description
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
                <button
                  onClick={() => setIsManualMode(false)}
                  className="w-full py-2 text-gray-400 text-sm hover:text-gray-600 transition-colors"
                >
                  Retour
                </button>
              </div>
            </motion.div>
              ) : image && !result ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-6"
                >
                  {image && (
                    <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/5">
                      <img 
                        src={image} 
                        alt="Votre repas" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {!result && !isAnalyzing && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-[2px]">
                          <button
                            onClick={handleAnalyze}
                            className="bg-white text-black px-8 py-4 rounded-2xl font-semibold shadow-xl hover:scale-105 transition-transform flex items-center gap-2"
                          >
                            Analyser le repas
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      {isAnalyzing && (
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                          <Loader2 className="w-12 h-12 animate-spin mb-4" />
                          <p className="font-medium text-lg">Analyse nutritionnelle...</p>
                          <p className="text-white/70 text-sm">Calcul des protéines et calories</p>
                        </div>
                      )}
                    </div>
                  )}

                  {manualDescription && !image && isAnalyzing && (
                    <div className="h-48 bg-white rounded-3xl flex flex-col items-center justify-center text-gray-500 shadow-sm border border-black/5">
                      <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />
                      <p className="font-medium">Analyse de votre description...</p>
                    </div>
                  )}
                </motion.div>
              ) : result ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Action: Add to Daily */}
                  {!isAdded ? (
                    <button
                      onClick={addToDaily}
                      className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Ajouter au suivi journalier
                    </button>
                  ) : (
                    <div className="w-full py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold border border-emerald-200 flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      Ajouté au suivi
                    </div>
                  )}

                  {/* Calories & Protein Section */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5">
                    <div className="flex items-center gap-2 mb-6">
                      <Utensils className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-semibold text-lg">Détails Nutritionnels</h3>
                    </div>
                    
                    <div className="space-y-4">
                      {result.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-gray-400 italic">{item.portion}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-emerald-700 font-bold">{item.calories} kcal</p>
                            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tighter">{item.protein}g Protéines</p>
                          </div>
                        </div>
                      ))}
                      
                      <div className="pt-6 grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-emerald-50 rounded-xl">
                          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mb-1">Total Calories</p>
                          <p className="text-xl font-mono font-bold text-emerald-900">{result.totalCalories} kcal</p>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-xl">
                          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mb-1">Total Protéines</p>
                          <p className="text-xl font-mono font-bold text-blue-900">{result.totalProtein} g</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Healthy Alternative Section */}
                  <div className="bg-emerald-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Leaf className="w-32 h-32 rotate-12" />
                    </div>
                    
                    <div className="relative z-10 space-y-6">
                      <div className="flex items-center gap-2">
                        <Leaf className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-semibold text-lg">Version Healthy</h3>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                          <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-2">Suggestion d'amélioration</p>
                          <p className="text-lg serif italic leading-snug">{result.healthyAlternative.suggestion}</p>
                        </div>

                        <div>
                          <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-2">Bénéfices</p>
                          <p className="text-sm text-emerald-50/80 leading-relaxed">{result.healthyAlternative.benefits}</p>
                        </div>

                        <div className="pt-2">
                          <div className="flex items-center gap-2 mb-3">
                            <ShoppingCart className="w-4 h-4 text-emerald-400" />
                            <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Liste de courses</p>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {result.healthyAlternative.shoppingList.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-emerald-50/90">
                                <div className="w-1 h-1 bg-emerald-400 rounded-full" />
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Beverage Pairing Section */}
                  <div className="bg-[#1a1a1a] text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Coffee className="w-32 h-32 rotate-12" />
                    </div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-6">
                        <Coffee className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-semibold text-lg">Accord Boisson</h3>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-1">Recommandation</p>
                          <p className="text-2xl serif italic">{result.beveragePairing.recommendation}</p>
                        </div>

                        <div>
                          <p className="text-gray-400 text-xs mb-2 uppercase tracking-widest">Pourquoi cet accord ?</p>
                          <p className="text-gray-200 text-sm leading-relaxed">{result.beveragePairing.reason}</p>
                        </div>

                        {result.beveragePairing.alternatives.length > 0 && (
                          <div>
                            <p className="text-gray-400 text-xs mb-3 uppercase tracking-widest">Alternatives</p>
                            <div className="flex flex-wrap gap-2">
                              {result.beveragePairing.alternatives.map((alt, idx) => (
                                <span key={idx} className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-medium border border-white/5">
                                  {alt}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </motion.div>
              ) : null}
            </motion.div>
          )}

          {activeTab === 'sport' && (
            <motion.div
              key="sport"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-light serif leading-tight">
                  Activité <span className="italic text-emerald-700">Sportive</span>
                </h2>
                <p className="text-gray-500 max-w-md mx-auto">
                  Enregistrez vos séances et suivez les calories dépensées.
                </p>
              </div>

              {/* Activity Form */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5 space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">Sport / Activité</label>
                    <input
                      type="text"
                      list="sports-list"
                      value={sportInput.sport}
                      onChange={(e) => setSportInput({ ...sportInput, sport: e.target.value })}
                      placeholder="Ex: Course à pied, Natation..."
                      className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <datalist id="sports-list">
                      {Object.keys(MET_VALUES).map(sport => (
                        <option key={sport} value={sport.charAt(0).toUpperCase() + sport.slice(1)} />
                      ))}
                    </datalist>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">Durée (min)</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          value={sportInput.duration}
                          onChange={(e) => setSportInput({ ...sportInput, duration: e.target.value })}
                          placeholder="30"
                          className="w-full p-4 pl-12 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">Calories (kcal) - Auto</label>
                      <div className="relative">
                        <Flame className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          value={sportInput.calories}
                          onChange={(e) => setSportInput({ ...sportInput, calories: e.target.value })}
                          placeholder="Calculé..."
                          className="w-full p-4 pl-12 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={addActivity}
                  disabled={!sportInput.sport || !sportInput.duration || !sportInput.calories}
                  className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-gray-900 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl"
                >
                  <Plus className="w-5 h-5" />
                  Enregistrer la séance
                </button>
              </div>

              {/* Today's Activities */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-gray-400" />
                  Séances du jour
                </h3>
                {todayLog.activities && todayLog.activities.length > 0 ? (
                  <div className="space-y-3">
                    {todayLog.activities.map((activity) => (
                      <div key={activity.id} className="bg-white rounded-2xl p-4 border border-black/5 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                            <ActivityIcon className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium">{activity.sport}</p>
                            <p className="text-xs text-gray-400">{activity.duration} min • {activity.timestamp}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">-{activity.calories} kcal</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-3xl p-12 text-center border border-dashed border-gray-200">
                    <p className="text-gray-400 italic">Aucune activité enregistrée aujourd'hui</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-light serif leading-tight">
                  Analyses <span className="italic text-emerald-700">Graphiques</span>
                </h2>
                <p className="text-gray-500 max-w-md mx-auto">
                  Visualisez votre balance énergétique sur les 7 derniers jours.
                </p>
              </div>

              {/* Energy Balance Chart */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Balance Énergétique</h3>
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-black rounded-full" />
                      <span>Consommé</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span>Dépensé</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorConsommé" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#000" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#000" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorDépensé" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Area type="monotone" dataKey="consommé" stroke="#000" fillOpacity={1} fill="url(#colorConsommé)" strokeWidth={2} />
                      <Area type="monotone" dataKey="dépensé" stroke="#10b981" fillOpacity={1} fill="url(#colorDépensé)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Net Calories Bar Chart */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 space-y-6">
                <h3 className="font-semibold">Calories Nettes</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                      />
                      <Tooltip 
                        cursor={{ fill: '#f9fafb' }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.net > 2000 ? '#ef4444' : '#000'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center text-xs text-gray-400 italic">
                  La balance nette idéale dépend de vos objectifs personnels.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-2xl mx-auto px-6 py-12 text-center text-gray-400 text-xs">
        <p>© 2026 VinoCal • Les estimations sont fournies par l'IA et peuvent varier.</p>
      </footer>
    </div>
  );
}
