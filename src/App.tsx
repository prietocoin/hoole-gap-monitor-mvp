import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, Landmark, Wallet, Activity, AlertTriangle, ShieldCheck, Volume2, VolumeX, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MarketData {
  precio_pivote_bcv: string;
  precio_paralelo_usdt: string;
  brecha_bs: string;
  brecha_porcentaje: string;
  timestamp: string;
  status: 'stable' | 'devaluation' | 'appreciation';
}

const App: React.FC = () => {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('https://n8n.jairokov.com/webhook/gap-data');
  const [tempUrl, setTempUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  const lastStatusRef = useRef<'stable' | 'devaluation' | 'appreciation' | null>(null);

  // --- Audio Synthesis Engine ---
  const playMarketSound = useCallback(async (type: 'up' | 'down' | 'welcome') => {
    if (muted) return;

    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const context = new AudioContextClass();
      if (context.state === 'suspended') await context.resume();

      if (type === 'up') {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, context.currentTime);
        osc.frequency.linearRampToValueAtTime(880, context.currentTime + 0.15);
        osc.frequency.linearRampToValueAtTime(440, context.currentTime + 0.3);
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, context.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.4);
        osc.connect(gain); gain.connect(context.destination);
        osc.start(); osc.stop(context.currentTime + 0.4);
      } else if (type === 'down') {
        const notes = [523.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, context.currentTime + i * 0.08);
          gain.gain.setValueAtTime(0, context.currentTime + i * 0.08);
          gain.gain.linearRampToValueAtTime(0.08, context.currentTime + i * 0.08 + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + i * 0.08 + 0.5);
          osc.connect(gain); gain.connect(context.destination);
          osc.start(context.currentTime + i * 0.08); osc.stop(context.currentTime + i * 0.08 + 0.5);
        });
      } else if (type === 'welcome') {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.5);
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(0.05, context.currentTime + 0.1);
        gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.5);
        osc.connect(gain); gain.connect(context.destination);
        osc.start(); osc.stop(context.currentTime + 0.5);
      }
    } catch (e) { console.error("Audio error:", e); }
  }, [muted]);

  // --- Real-time Data Fetching ---
  const fetchData = useCallback(async () => {
    if (isDemo) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(webhookUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const result = await response.json();

      if (!result.analisis || !result.analisis.brecha_porcentaje) {
        throw new Error('Formato de datos n8n no reconocido');
      }

      // Determine status based on variation (Logic from USDTVES)
      const parseGap = (val: string) => parseFloat(val.replace('%', '').replace(',', '.'));
      const newGap = parseGap(result.analisis.brecha_porcentaje);

      let status: 'stable' | 'devaluation' | 'appreciation' = 'stable';
      if (newGap > 9) status = 'devaluation';
      else if (newGap < 6) status = 'appreciation';

      const marketData: MarketData = {
        ...result.analisis,
        timestamp: result.timestamp || new Date().toLocaleTimeString(),
        status
      };

      setData(marketData);
      setLoading(false);
      setError(null);

      // Play sound only on status change
      if (status !== lastStatusRef.current) {
        if (status === 'devaluation') playMarketSound('up');
        else if (status === 'appreciation') playMarketSound('down');
        lastStatusRef.current = status;
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
      if (err.name === 'AbortError') {
        setError("TIEMPO DE ESPERA AGOTADO (Timeout)");
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setError("ERROR DE RED O CORS (Habilita CORS en n8n)");
      } else {
        setError(err.message || "ERROR DE CONEXIÓN");
      }
      setLoading(false);
    }
  }, [isDemo, playMarketSound, webhookUrl]);

  // Demo Scenarios for fallback/testing
  const demoScenarios: MarketData[] = [
    { precio_pivote_bcv: "Bs. 51,20", precio_paralelo_usdt: "Bs. 54,80", brecha_bs: "Bs. 3,60", brecha_porcentaje: "7.03%", timestamp: "Modo Demo", status: 'stable' },
    { precio_pivote_bcv: "Bs. 51,20", precio_paralelo_usdt: "Bs. 56,10", brecha_bs: "Bs. 4,90", brecha_porcentaje: "9.57%", timestamp: "Alerta de Subida", status: 'devaluation' },
    { precio_pivote_bcv: "Bs. 51,20", precio_paralelo_usdt: "Bs. 53,90", brecha_bs: "Bs. 2,70", brecha_porcentaje: "5.27%", timestamp: "Aviso de Bajada", status: 'appreciation' }
  ];

  useEffect(() => {
    if (isDemo) {
      let step = 0;
      const interval = setInterval(() => {
        setData(demoScenarios[step]);
        setLoading(false);
        setLoading(false);
        if (demoScenarios[step].status === 'devaluation') playMarketSound('up');
        else if (demoScenarios[step].status === 'appreciation') playMarketSound('down');
        step = (step + 1) % demoScenarios.length;
      }, 6000);
      return () => clearInterval(interval);
    } else if (hasInteracted) {
      fetchData();
      const interval = setInterval(fetchData, 30000); // Poll every 30s
      return () => clearInterval(interval);
    }
  }, [isDemo, fetchData, playMarketSound, hasInteracted]);

  const parseGap = (val: string | undefined) => val ? parseFloat(val.replace('%', '').replace(',', '.')) : 0;
  const currentGap = parseGap(data?.brecha_porcentaje);
  const isVariationAlert = data?.status !== 'stable';
  const trend = data?.status === 'devaluation' ? 'SUBIDA' : 'BAJADA';

  const alertTheme = data?.status === 'devaluation' ? {
    bg: 'bg-hoole-rose', text: 'text-hoole-rose', shadow: 'shadow-[0_0_60px_rgba(244,63,94,0.7)]',
    msg: '¡ALERTA DE DEVALUACIÓN!', sub: 'El mercado se escapa (+2.5%)', icon: <AlertTriangle className="w-5 h-5" />
  } : data?.status === 'appreciation' ? {
    bg: 'bg-hoole-emerald', text: 'text-hoole-emerald', shadow: 'shadow-[0_0_60px_rgba(16,185,129,0.7)]',
    msg: '¡REUPERACIÓN DEL BOLÍVAR!', sub: 'La brecha retrocede (-4.3%)', icon: <ShieldCheck className="w-5 h-5" />
  } : null;

  const maxGap = 20;
  const percentageOfMax = Math.min((currentGap / maxGap) * 100, 100);

  const enableAudio = () => {
    setMuted(false);
    setHasInteracted(true);
    playMarketSound('welcome');
  };

  return (
    <div className="min-h-screen bg-hoole-black text-white font-sans selection:bg-hoole-gold selection:text-black">
      {!hasInteracted && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 text-center">
          <div className="glass p-12 rounded-[3.5rem] border border-hoole-gold/40 shadow-2xl shadow-hoole-gold/10 max-w-sm w-full">
            <div className="w-24 h-24 bg-hoole-gold/20 rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-hoole-gold/30">
              <Zap className="w-12 h-12 text-hoole-gold animate-pulse" />
            </div>

            {!showUrlInput ? (
              <>
                <h2 className="text-3xl font-black mb-4 tracking-tighter">Hoole Engine</h2>
                <p className="text-sm text-gray-400 mb-10 leading-relaxed font-bold opacity-70 italic">Sincroniza el monitor con el mercado de Venezuela en tiempo real.</p>
                <div className="flex flex-col gap-3">
                  <button onClick={enableAudio} className="w-full bg-hoole-gold text-black font-black py-6 rounded-2xl active:scale-95 transition-all shadow-2xl shadow-hoole-gold/50 text-xl tracking-tighter uppercase">
                    CONECTAR LOCAL
                  </button>
                  <button
                    onClick={() => { setShowUrlInput(true); setTempUrl(webhookUrl); }}
                    className="w-full bg-white/5 border-2 border-white/10 text-white font-black py-4 rounded-2xl active:scale-95 transition-all text-sm tracking-tighter uppercase"
                  >
                    CONFIGURAR VPS
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-6">
                <h2 className="text-2xl font-black tracking-tighter">Configurar VPS</h2>
                <div className="text-left">
                  <label className="text-[10px] text-hoole-gold font-black tracking-widest uppercase mb-2 block">Webhook URL de n8n</label>
                  <input
                    type="text"
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                    placeholder="http://tu-vps-ip:5678/webhook/..."
                    className="w-full bg-black/50 border-2 border-white/10 rounded-xl px-4 py-4 text-xs font-bold text-white focus:border-hoole-gold outline-none transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => { setWebhookUrl(tempUrl); setShowUrlInput(false); enableAudio(); }}
                    className="w-full bg-hoole-gold text-black font-black py-5 rounded-2xl active:scale-95 transition-all shadow-2xl shadow-hoole-gold/50 text-lg tracking-tighter uppercase"
                  >
                    GUARDAR Y CONECTAR
                  </button>
                  <button onClick={() => setShowUrlInput(false)} className="text-[10px] text-gray-550 font-black tracking-widest uppercase">Cancelar</button>
                </div>
              </div>
            )}

            <button onClick={() => { setIsDemo(true); enableAudio(); }} className="mt-8 text-[10px] text-gray-600 font-black tracking-widest uppercase hover:text-hoole-gold transition-colors">Modo Demostración</button>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {isVariationAlert && alertTheme && (
          <motion.div key={data?.status} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={`${alertTheme.bg} text-white py-8 px-4 flex flex-col items-center justify-center gap-1.5 overflow-hidden z-50 sticky top-0 ${alertTheme.shadow}`}>
            <div className="flex items-center gap-4">
              <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.3 }}><AlertTriangle className="w-5 h-5" /></motion.div>
              <span className="text-sm font-black tracking-[0.2em]">{alertTheme.msg}</span>
              <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.3 }}><AlertTriangle className="w-5 h-5" /></motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-6 py-8">
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-hoole-gold rounded-[1.2rem] flex items-center justify-center shadow-2xl shadow-hoole-gold/20 text-black font-black text-4xl">H</div>
            <div className="flex flex-col text-left">
              <h1 className="text-2xl font-black tracking-tighter leading-none text-white">HOOLE</h1>
              <span className="text-[11px] text-hoole-gold font-black tracking-[0.3em] uppercase italic opacity-80">GAP MONITOR</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMuted(!muted)} className={`p-4 rounded-2xl transition-all border-2 ${!muted ? 'bg-hoole-gold/20 border-hoole-gold/40' : 'bg-white/5 border-white/5'}`}>
              {muted ? <VolumeX className="w-6 h-6 text-gray-500" /> : <Volume2 className="w-6 h-6 text-hoole-gold" />}
            </button>
          </div>
        </header>

        <main className="max-w-md mx-auto relative cursor-default pb-32">
          <AnimatePresence mode="wait">
            {!data ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20">
                <Activity className="w-16 h-16 text-hoole-gold animate-pulse mb-6" />
                <p className="text-[10px] text-gray-550 font-black tracking-widest text-center">{error || 'ESTABLECIENDO CONEXIÓN SEGURA...'}</p>
                {error && <button onClick={fetchData} className="mt-4 text-[11px] text-hoole-gold font-bold underline">Reintentar</button>}
              </motion.div>
            ) : (
              <motion.div key={data.timestamp} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="space-y-12">
                <div className="relative flex flex-col items-center py-6">
                  <div className={`absolute inset-0 rounded-full blur-[140px] opacity-30 transition-colors duration-1000 ${isVariationAlert && alertTheme ? alertTheme.bg : 'bg-hoole-gold'}`} />
                  <svg className="w-80 h-80 transform -rotate-90 relative z-10">
                    <circle cx="160" cy="160" r="140" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-white/5" />
                    <motion.circle cx="160" cy="160" r="140" stroke="currentColor" strokeWidth="16" fill="transparent"
                      strokeDasharray={2 * Math.PI * 140}
                      initial={{ strokeDashoffset: 2 * Math.PI * 140 }}
                      animate={{ strokeDashoffset: (2 * Math.PI * 140) * (1 - percentageOfMax / 100) }}
                      transition={{ duration: 1.5, ease: "circOut" }}
                      strokeLinecap="round"
                      className={`${isVariationAlert && alertTheme ? alertTheme.text : 'text-hoole-gold'} transition-colors duration-1000 drop-shadow-[0_0_15px_rgba(196,163,88,0.3)]`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center mt-8 z-20">
                    <span className="text-gray-500 text-[12px] font-black uppercase tracking-[0.5em] mb-2 opacity-50 italic">DIFERENCIAL</span>
                    <span className={`text-8xl font-black tracking-tighter ${isVariationAlert && alertTheme ? alertTheme.text : 'text-white'} transition-colors duration-1000`}>{data?.brecha_porcentaje}</span>
                    <div className={`mt-10 px-8 py-3 rounded-full text-[12px] font-black flex items-center gap-3 border shadow-3xl transition-all duration-500 ${isVariationAlert && alertTheme ? `${alertTheme.bg} text-white border-white/20` : 'glass text-gray-500 border-white/5'}`}>
                      {trend === 'SUBIDA' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      {data?.status === 'devaluation' ? 'ALERTA ROJA' : data?.status === 'appreciation' ? 'TENDENCIA VERDE' : 'MERCADO ESTABLE'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className={`glass rounded-[3rem] p-8 flex items-center justify-between border-l-8 transition-all duration-700 ${data?.status === 'devaluation' ? 'border-hoole-rose shadow-[0_0_50px_rgba(244,63,94,0.4)]' : 'border-hoole-gold'}`}>
                    <div className="flex items-center gap-6">
                      <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-colors duration-700 ${data?.status === 'devaluation' ? 'bg-hoole-rose/15' : 'bg-hoole-gold/20'}`}><Wallet className={`w-8 h-8 ${data?.status === 'devaluation' ? 'text-hoole-rose' : 'text-hoole-gold'}`} /></div>
                      <div>
                        <p className="text-[12px] font-black text-gray-500 uppercase tracking-widest leading-none mb-2 opacity-60">Dólar Binance</p>
                        <h3 className={`text-4xl font-black tracking-tight transition-colors ${data?.status === 'devaluation' ? 'text-hoole-rose' : 'text-white'}`}>{data?.precio_paralelo_usdt}</h3>
                      </div>
                    </div>
                  </div>
                  <div className={`glass rounded-[3rem] p-8 flex items-center justify-between border-l-8 transition-all duration-700 ${data?.status === 'appreciation' ? 'border-hoole-emerald shadow-[0_0_50px_rgba(16,185,129,0.4)]' : 'border-gray-800'}`}>
                    <div className="flex items-center gap-6">
                      <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-colors duration-700 ${data?.status === 'appreciation' ? 'bg-hoole-emerald/15' : 'bg-white/5'}`}><Landmark className={`w-8 h-8 ${data?.status === 'appreciation' ? 'text-hoole-emerald' : 'text-gray-500'}`} /></div>
                      <div>
                        <p className="text-[12px] font-black text-gray-500 uppercase tracking-widest leading-none mb-2 opacity-60">Oficial BCV</p>
                        <h3 className={`text-4xl font-black tracking-tight transition-colors ${data?.status === 'appreciation' ? 'text-hoole-emerald' : 'text-gray-300'}`}>{data?.precio_pivote_bcv}</h3>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-8 px-2 text-center">
                  <div className="flex justify-between items-center text-[10px] text-gray-500 font-extrabold uppercase tracking-[0.4em] opacity-60">
                    <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-hoole-gold animate-pulse" />ACTIVO</div>
                    <div>{data?.timestamp}</div>
                  </div>
                  <p className="text-[11px] font-black tracking-[0.6em] text-white uppercase italic opacity-20 py-10 border-t border-white/10">Diseñado por Jairokov</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="fixed bottom-6 left-6 right-6 z-40 max-w-md mx-auto">
          <div className="glass rounded-[3rem] p-7 flex justify-around items-center border border-white/10 shadow-3xl backdrop-blur-3xl">
            <Activity className="w-8 h-8 text-hoole-gold" />
            <Landmark className="w-8 h-8 text-white/10" />
            <Wallet className="w-8 h-8 text-white/10" />
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
