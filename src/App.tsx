import { useCallback, useEffect, useRef, useState } from "react";
import happySrc from "./assets/bunny_happy.png";
import stareSrc from "./assets/bunny_stare.png";
import horrorSrc from "./assets/bunny_horror.png";
import carrotSrc from "./assets/carrot.png";
import meadowSrc from "./assets/meadow.jpg";
import { removeBackground } from "./lib/removeBg";
import { audio } from "./lib/audio";
import { getScript, HIDE_MSGS, SORRY_REPLIES } from "./game/script";
import Typer from "./components/Typer";

type Assets = { happy: string; stare: string; horror: string; carrot: string };
type Phase = "loading" | "title" | "name" | "daycard" | "game" | "hide" | "found" | "finale" | "jumpscare" | "crash";
type Action = "feed" | "pet" | "play";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BASE_TITLE = "ぴょんぴょん ハッピーガーデン♪";

const deviceName = () => {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "タブレット";
  if (/iPhone|Android|Mobile/i.test(ua)) return "スマホ";
  return "パソコン";
};
const timeText = () => {
  const d = new Date();
  const h = d.getHours();
  const period = h < 4 ? "よなか の" : h < 11 ? "あさ の" : h < 17 ? "ひる の" : "よる の";
  return `${period} ${h % 12 === 0 ? 12 : h % 12}じ ${d.getMinutes()}ふん`;
};

export default function App() {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [loop, setLoop] = useState(() => Number(localStorage.getItem("pyon_loop") || 0));
  const [name, setName] = useState(() => localStorage.getItem("pyon_name") || "");
  const [nameInput, setNameInput] = useState("");
  const [day, setDay] = useState(1);
  const [used, setUsed] = useState<Action[]>([]);
  const [stats, setStats] = useState({ hunger: 40, love: 20, energy: 50 });
  const [speech, setSpeech] = useState("");
  const [busy, setBusy] = useState(false);
  const [effect, setEffect] = useState<{ kind: Action; id: number } | null>(null);
  const [flash, setFlash] = useState(false);
  const [stareFlick, setStareFlick] = useState(false);
  const [forceStare, setForceStare] = useState(false);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const [bunnyScale, setBunnyScale] = useState(1);
  const [bunnyHidden, setBunnyHidden] = useState(false);
  const [finaleStep, setFinaleStep] = useState(0);
  const [finaleButtons, setFinaleButtons] = useState(false);
  const [shuffle, setShuffle] = useState(0);
  const [hideMsg, setHideMsg] = useState("");
  const [hideReady, setHideReady] = useState(false);
  const [bushes, setBushes] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [shakeBush, setShakeBush] = useState<number | null>(null);
  const [foundShow, setFoundShow] = useState(false);
  const [titleHover, setTitleHover] = useState(false);
  const [crashDone, setCrashDone] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const hideCount = useRef(0);

  const c = phase === "title" || phase === "name" || phase === "loading" ? (loop > 0 && phase !== "loading" ? 1 : 0) : Math.min(4, day - 1);
  const speed = c >= 4 ? 85 : c >= 3 ? 70 : 50;
  const n = name || "ともだち";

  // ---------- 画像の背景透過（コード処理）
  useEffect(() => {
    Promise.all([
      removeBackground(happySrc),
      removeBackground(stareSrc),
      removeBackground(horrorSrc, { tolerance: 34 }),
      removeBackground(carrotSrc),
    ])
      .then(([happy, stare, horror, carrot]) => {
        setAssets({ happy, stare, horror, carrot });
        setPhase("title");
      })
      .catch(() => {
        setAssets({ happy: happySrc, stare: stareSrc, horror: horrorSrc, carrot: carrotSrc });
        setPhase("title");
      });
  }, []);

  useEffect(() => {
    audio.corruption = c;
  }, [c]);

  // ---------- タブを離れると…
  useEffect(() => {
    document.title = BASE_TITLE;
    const onVis = () => {
      if (document.hidden && c >= 1) {
        document.title = c >= 3 ? `${n}ちゃん、にげないで` : `${n}ちゃん、どこいくの？`;
      } else {
        document.title = BASE_TITLE;
        if (!document.hidden && c >= 2 && phase === "game" && !busyRef.current) {
          setSpeech("……どこ いってたの？ ずっと ここで まってたのに。");
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [c, n, phase]);

  // ---------- サブリミナル
  useEffect(() => {
    if (!(phase === "game" || phase === "finale") || c < 1) return;
    let t: number;
    const schedule = () => {
      t = window.setTimeout(() => {
        setStareFlick(true);
        setTimeout(() => setStareFlick(false), c >= 2 ? 180 : 110);
        if (c >= 2) {
          setFlash(true);
          if (c >= 3) audio.glitch();
          setTimeout(() => setFlash(false), 70);
        }
        if (c >= 3 && Math.random() < 0.5) audio.whisper(1.2);
        schedule();
      }, (c >= 3 ? 4000 : 7000) + Math.random() * 9000);
    };
    schedule();
    return () => clearTimeout(t);
  }, [phase, c]);

  const onMove = useCallback((e: React.PointerEvent) => {
    setMouse({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
  }, []);

  const say = useCallback(
    async (text: string, hold = 900) => {
      setSpeech(text);
      await sleep(text.length * speed + hold);
    },
    [speed]
  );

  // ---------- 進行
  const startDay = async (d: number, nm = n) => {
    setDay(d);
    setUsed([]);
    setSpeech("");
    setBusy(true);
    setPhase("daycard");
    audio.corruption = Math.min(4, d - 1);
    if (d <= 4) audio.startMusic();
    else audio.stopMusic();
    if (d === 4) audio.startDrone(0.12);
    await sleep(d === 5 ? 4200 : 2600);
    const sc = getScript(d, nm, loop);
    const localSpeed = d >= 5 ? 85 : d >= 4 ? 70 : 50;
    const sayL = async (t: string, hold = 900) => {
      setSpeech(t);
      await sleep(t.length * localSpeed + hold);
    };
    if (d === 5) {
      setPhase("finale");
      await runFinale(nm, sayL);
      return;
    }
    setPhase("game");
    await sleep(600);
    for (const line of sc.start) await sayL(line, 1000);
    setBusy(false);
  };

  const runFinale = async (nm: string, sayL: (t: string, h?: number) => Promise<void>) => {
    audio.stopMusic();
    audio.startDrone(0.35);
    setForceStare(true);
    setBunnyScale(1);
    await sleep(1800);
    await sayL(`こんばんは、${nm}ちゃん。`, 1400);
    await sayL(`いま、${timeText()} だね。`, 1400);
    await sayL(`こんな じかんに ${deviceName()} の まえで、ひとりで なにしてるの？`, 1600);
    audio.whisper(2);
    await sayL(`${nm}ちゃんの うしろ、くらいね。`, 2000);
    setFinaleButtons(true);
    setBusy(false);
  };

  const finaleClick = async (kind: "sorry" | "run") => {
    if (busy) return;
    setBusy(true);
    const step = finaleStep + 1;
    setFinaleStep(step);
    setBunnyScale(1 + step * 0.32);
    audio.heartbeat();
    if (kind === "run") {
      setShuffle((s) => s + 1);
      audio.glitch();
      await say("どこへ？", 900);
    } else {
      await say(SORRY_REPLIES[(step - 1) % SORRY_REPLIES.length], 900);
    }
    if (step >= 4) {
      setFinaleButtons(false);
      await say(`ねえ、${n}ちゃん。`, 1400);
      await say("うしろ、ふりむいて みて。", 2200);
      audio.silenceAll();
      setSpeech("");
      setBunnyHidden(true);
      await sleep(4200);
      setPhase("jumpscare");
      audio.scream();
      await sleep(1900);
      const nl = loop + 1;
      localStorage.setItem("pyon_loop", String(nl));
      setPhase("crash");
      setCrashDone(false);
      setTimeout(() => setCrashDone(true), 7500);
      return;
    }
    setBusy(false);
  };

  const doAction = async (kind: Action) => {
    if (busy || used.includes(kind)) return;
    if (day === 4) {
      setBusy(true);
      audio.blip(0.7);
      await say("じゃあ、めを つぶって。 ……10 かぞえてね。", 1200);
      runHide();
      return;
    }
    setBusy(true);
    audio.blip();
    const sc = getScript(day, n, loop);
    setEffect({ kind, id: Date.now() });
    setTimeout(() => setEffect(null), 1500);
    setStats((s) => {
      const cap = (v: number) => (c >= 2 ? v : Math.min(100, v));
      if (kind === "feed") return { ...s, hunger: cap(s.hunger + (c >= 2 ? 52 : 35)) };
      if (kind === "pet") return { ...s, love: cap(s.love + 35) };
      return { ...s, energy: cap(s.energy + 30), hunger: Math.max(0, s.hunger - 10) };
    });
    if (c <= 1) audio.sparkle();
    if (c >= 2 && kind !== "play") setForceStare(true);
    await say(sc[kind], 1300);
    setForceStare(false);
    const nu = [...used, kind];
    setUsed(nu);
    if (nu.length >= 3) await say(sc.end, 900);
    setBusy(false);
  };

  const goSleep = async () => {
    if (busy) return;
    audio.blip(0.8);
    setStats((s) => ({ hunger: Math.max(10, s.hunger - 40), love: s.love, energy: Math.max(10, s.energy - 20) }));
    startDay(day + 1);
  };

  // ---------- かくれんぼ
  const runHide = async () => {
    setPhase("hide");
    setBunnyHidden(true);
    setSpeech("");
    setHideReady(false);
    setBushes([0, 1, 2, 3, 4, 5]);
    hideCount.current = 0;
    audio.stopMusic();
    audio.startDrone(0.22);
    const count = ["いーち", "にーい", "さーん", "しーい", "ごーお", "ろーく", "しーち", "はーち", "きゅーう", "じゅう。"];
    for (let i = 0; i < count.length; i++) {
      setHideMsg(count[i]);
      audio.tick();
      await sleep(i >= 7 ? 900 : 550);
    }
    setHideMsg("もう いいかい？");
    await sleep(2400);
    audio.whisper(1.4);
    setHideMsg("……もう いいよ。");
    await sleep(1200);
    setHideReady(true);
    setBusy(false);
  };

  const clickBush = async (i: number) => {
    if (!hideReady) return;
    setShakeBush(i);
    audio.whisper(0.4);
    setTimeout(() => setShakeBush(null), 400);
    await sleep(420);
    setBushes((b) => b.filter((x) => x !== i));
    const idx = hideCount.current++;
    setHideMsg(HIDE_MSGS[Math.min(idx, HIDE_MSGS.length - 1)]);
    audio.heartbeat();
    if (idx >= HIDE_MSGS.length - 1) {
      setHideReady(false);
      await sleep(2200);
      setPhase("found");
      setFoundShow(false);
      audio.stopDrone();
      for (let k = 0; k < 4; k++) {
        audio.heartbeat();
        await sleep(k < 2 ? 900 : 650);
      }
      audio.glitch();
      setFoundShow(true);
      audio.startDrone(0.3);
      setSpeech("");
      await sleep(600);
      const sl = async (t: string, h = 1200) => {
        setSpeech(t);
        await sleep(t.length * 75 + h);
      };
      await sl("みーつけた。", 1400);
      await sl("……ちがうね。", 1000);
      await sl(`ぼくが、${n}ちゃんを みつけたんだ。`, 1800);
      setFoundShow(false);
      setBunnyHidden(false);
      startDay(5);
    }
  };

  // ---------- タイトル → 名前
  const onStart = () => {
    audio.init();
    audio.sparkle();
    audio.corruption = loop > 0 ? 1 : 0;
    audio.startMusic();
    setPhase("name");
    if (loop > 0 && name) {
      setTimeout(() => setSpeech(`……しってるよ。 ${name}ちゃん でしょ？`), 400);
    } else {
      setSpeech("");
    }
  };

  const confirmName = () => {
    const nm = (nameInput.trim() || "ともだち").slice(0, 8);
    setName(nm);
    localStorage.setItem("pyon_name", nm);
    audio.sparkle();
    startDay(1, nm);
  };

  const backToTitle = () => {
    const nl = Number(localStorage.getItem("pyon_loop") || 0);
    setLoop(nl);
    setDay(1);
    setStats({ hunger: 40, love: 20, energy: 50 });
    setBunnyScale(1);
    setBunnyHidden(false);
    setFinaleStep(0);
    setFinaleButtons(false);
    setForceStare(false);
    setSpeech("");
    setBusy(false);
    setPhase("title");
    audio.corruption = 1;
    audio.startMusic();
  };

  const resetAll = () => {
    localStorage.removeItem("pyon_loop");
    localStorage.removeItem("pyon_name");
    location.reload();
  };

  // ================= RENDER =================
  if (phase === "loading" || !assets) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-b from-pink-100 to-sky-100 text-pink-400">
        <div className="text-5xl anim-bouncy">🐰</div>
        <p className="mt-4 font-bold tracking-widest">よみこみちゅう…♪</p>
      </div>
    );
  }

  const bgFilter = [
    "none",
    "saturate(0.92)",
    "saturate(0.55) brightness(0.9) hue-rotate(-8deg)",
    "saturate(0.2) brightness(0.62) sepia(0.25) contrast(1.1)",
    "saturate(0.1) brightness(0.16) contrast(1.3) hue-rotate(180deg)",
  ][c];
  const vignette = [0, 0.15, 0.35, 0.6, 0.92][c];
  const dark = c >= 3;
  const showStare = forceStare || stareFlick || c >= 3 || (phase === "title" && loop > 0 && titleHover);
  const bunnyImg = showStare ? assets.stare : assets.happy;
  const tilt = c >= 1 ? (mouse.x - 0.5) * (c >= 3 ? 22 : 12) : 0;

  // ---------- ジャンプスケア
  if (phase === "jumpscare") {
    return (
      <div className="fixed inset-0 anim-strobe overflow-hidden flex items-center justify-center">
        <img src={assets.horror} alt="" className="anim-jumpscare h-[115vh] max-w-none object-contain" draggable={false} />
        <div className="noise-layer opacity-80" />
      </div>
    );
  }

  // ---------- クラッシュ
  if (phase === "crash") {
    const lines = [
      "ぴょんぴょんハッピーガーデン.exe は 応答していません。",
      '> プロセス "pyonchan" を 終了しています……',
      "> 失敗しました。 アクセスが 拒否されました。",
      "> pyonchan は すでに ゲームの外に います。",
      `> 現在地: ${n} の うしろ`,
      "> ずっと いっしょ だよ。",
    ];
    return (
      <div className="fixed inset-0 bg-black text-neutral-300 font-dot p-6 sm:p-12 text-sm sm:text-lg leading-loose">
        {lines.map((l, i) => (
          <p key={i} className="anim-fadein" style={{ animationDelay: `${0.8 + i * 1.1}s`, color: i >= 4 ? "#ff5a5a" : undefined }}>
            {l}
          </p>
        ))}
        <span className="anim-cursor">█</span>
        {crashDone && (
          <button onClick={backToTitle} className="mt-10 block border border-neutral-600 px-6 py-2 hover:bg-neutral-900 anim-fadein">
            ▶ タイトルへ もどる
          </button>
        )}
      </div>
    );
  }

  // ---------- 見つかった
  if (phase === "found") {
    return (
      <div className="fixed inset-0 bg-black overflow-hidden flex flex-col items-center justify-end">
        {foundShow && (
          <>
            <div className="absolute top-[12%] left-1/2 -translate-x-1/2 w-[min(90vw,560px)] z-20">
              {speech && (
                <div className="bubble dark px-6 py-4 text-lg sm:text-xl font-bold text-center">
                  <Typer text={speech} speed={75} />
                </div>
              )}
            </div>
            <img
              src={assets.stare}
              alt=""
              draggable={false}
              className="anim-creep h-[88vh] max-w-none object-contain translate-y-[18%] scale-150"
              style={{ filter: "brightness(0.55) contrast(1.4) drop-shadow(0 0 40px rgba(160,0,0,0.6))" }}
            />
            <div className="noise-layer opacity-50" />
          </>
        )}
      </div>
    );
  }

  // ---------- 日付カード
  if (phase === "daycard") return <DayCard day={day} />;

  const labels =
    c >= 3
      ? ["🥕 おなか", "🖤 いっしょ", `⭐ ${n}ちゃん`]
      : ["🥕 おなか", "💗 なかよし", "⭐ げんき"];
  const values: (number | string)[] =
    c >= 4
      ? ["???", "∞", Math.max(0, 3 - finaleStep)]
      : c >= 3
      ? [stats.hunger, "∞", 23]
      : [stats.hunger, stats.love, stats.energy];

  const inGame = phase === "game" || phase === "finale" || phase === "hide";

  // ボタン
  const actionBtns: { kind: Action; label: string; icon: React.ReactNode; color: string }[] = [
    { kind: "feed", label: day === 4 ? "かくれんぼ" : "ごはん", icon: <img src={assets.carrot} alt="" className="h-8 w-8 object-contain" />, color: "bg-orange-200" },
    { kind: "pet", label: day === 4 ? "かくれんぼ" : "なでる", icon: <span className="text-2xl">{c >= 2 ? "🤍" : "💗"}</span>, color: "bg-pink-200" },
    { kind: "play", label: day === 4 ? "かくれんぼ" : "あそぶ", icon: <span className="text-2xl">{c >= 2 ? "🎈" : "⚽"}</span>, color: "bg-sky-200" },
  ];

  const finaleOrder = shuffle % 3 === 0 ? [0, 1, 2] : shuffle % 3 === 1 ? [2, 0, 1] : [1, 2, 0];
  const finaleDefs: { label: string; kind: "sorry" | "run" }[] = [
    { label: "ごめんなさい", kind: "sorry" },
    { label: "ごめんなさい", kind: "sorry" },
    { label: "にげる", kind: "run" },
  ];

  return (
    <div className="fixed inset-0 overflow-hidden" onPointerMove={onMove}>
      {/* 背景 */}
      <img
        src={meadowSrc}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover transition-[filter] duration-[3000ms]"
        style={{ filter: bgFilter }}
      />
      {/* ビネット */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-[3000ms]"
        style={{ background: `radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,${vignette}) 100%)` }}
      />
      {c >= 3 && <div className="noise-layer opacity-30" />}

      {/* こっそり文字 */}
      {c >= 2 && inGame && (
        <>
          <span className="absolute bottom-[14%] right-[6%] text-[11px] text-green-900/30 rotate-6 pointer-events-none">たすけて</span>
          <span className="absolute bottom-[30%] left-[4%] text-[10px] text-green-900/25 -rotate-3 pointer-events-none">まえの ともだちも ここにいるよ</span>
        </>
      )}
      {c >= 3 && inGame && (
        <>
          <span className="absolute top-[38%] right-[12%] text-[11px] text-red-900/40 pointer-events-none">みてる</span>
          <span className="absolute bottom-[6%] left-[40%] text-[10px] text-red-900/30 pointer-events-none">{n} {n} {n} {n}</span>
        </>
      )}

      {/* ===== タイトル ===== */}
      {phase === "title" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
          <h1 className="cute-outline text-4xl sm:text-6xl font-black text-center leading-tight anim-pop">
            ぴょんぴょん
            <br />
            ハッピーガーデン<span className="text-yellow-300">♪</span>
          </h1>
          <p className="mt-3 bg-white/80 rounded-full px-4 py-1 text-pink-500 font-bold text-sm sm:text-base border-2 border-pink-300">
            {loop > 0 ? `おかえり、${n}ちゃん♪` : "うさぎの ぴょんちゃんと なかよく なろう！"}
          </p>
          <img src={bunnyImg} alt="" draggable={false} className="h-[34vh] my-4 object-contain anim-bouncy drop-shadow-[0_10px_0_rgba(0,0,0,0.12)]" />
          <button
            onClick={onStart}
            onPointerEnter={() => setTitleHover(true)}
            onPointerLeave={() => setTitleHover(false)}
            className="cute-btn bg-yellow-200 text-amber-900 font-black text-2xl px-12 py-3"
          >
            {loop > 0 ? "▶ つづきから" : "▶ はじめる"}
          </button>
          <p className="mt-5 text-[11px] sm:text-xs text-white bg-pink-400/80 rounded-full px-3 py-1 text-center">
            🎧 イヤホン すいしょう！ ※おおきな おと・ひかる えんしゅつ が あるよ
          </p>
          {loop > 0 && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <span className="text-[10px] text-pink-900/40">{loop + 1}かいめ</span>
              <button onClick={resetAll} className="text-[11px] text-white/80 underline">
                データを けす
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== 名前 ===== */}
      {phase === "name" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 gap-4">
          {loop > 0 && name ? (
            <>
              <div className="bubble px-6 py-4 text-xl font-bold text-amber-900 max-w-md text-center min-h-[3.5rem]">
                <Typer text={speech} speed={80} onTick={() => audio.tick()} />
              </div>
              <img src={assets.happy} alt="" draggable={false} className="h-[36vh] object-contain" />
              <button onClick={() => startDay(1, name)} className="cute-btn bg-pink-200 text-amber-900 font-black text-xl px-10 py-3">
                ……うん
              </button>
            </>
          ) : (
            <div className="bg-white/90 rounded-[32px] border-4 border-[#6b3f2a] p-6 sm:p-8 flex flex-col items-center gap-4 anim-pop shadow-[0_8px_0_rgba(107,63,42,0.35)] max-w-sm w-full">
              <img src={assets.happy} alt="" draggable={false} className="h-32 object-contain anim-bouncy" />
              <p className="text-xl font-black text-amber-900 text-center">あなたの おなまえ を<br />おしえてね！</p>
              <input
                autoFocus
                value={nameInput}
                maxLength={8}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmName()}
                placeholder="ともだち"
                className="w-full text-center text-xl font-bold rounded-full border-4 border-pink-300 px-4 py-2 outline-none focus:border-pink-400 text-amber-900"
              />
              <button onClick={confirmName} className="cute-btn bg-yellow-200 text-amber-900 font-black text-xl px-10 py-2">
                けってい ♪
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== ゲーム ===== */}
      {inGame && (
        <>
          {/* ヘッダー */}
          <div className="absolute top-3 left-0 right-0 flex justify-center px-3 z-30">
            <GameTitle c={c} />
          </div>
          <div className="absolute top-16 sm:top-20 left-3 z-30">
            <div className={`rounded-2xl border-4 px-3 py-2 w-40 sm:w-48 ${dark ? "bg-black/70 border-red-950 text-neutral-300" : "bg-white/85 border-[#6b3f2a] text-amber-900"}`}>
              <div className="text-xs font-black mb-1">{c >= 4 ? "よる" : "☀"} {c >= 4 ? "∞" : day}にちめ</div>
              {labels.map((lb, i) => {
                const v = values[i];
                const w = typeof v === "number" ? Math.min(100, v) : 100;
                return (
                  <div key={i} className="mb-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>{lb}</span>
                      <span className={typeof v === "number" && v > 100 ? "text-red-600" : ""}>{typeof v === "number" ? `${v}%` : v}</span>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${dark ? "bg-neutral-800" : "bg-pink-100"}`}>
                      <div
                        className={`h-full transition-all duration-700 ${dark ? "bg-red-800" : ["bg-orange-300", "bg-pink-400", "bg-sky-400"][i]} ${v === "∞" ? "animate-pulse" : ""}`}
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* セリフ */}
          <div className="absolute top-[18%] sm:top-[14%] left-1/2 -translate-x-1/2 w-[min(92vw,600px)] z-30 flex justify-center pl-0 sm:pl-0">
            {phase === "hide" ? (
              hideMsg && (
                <p key={hideMsg} className={`anim-pop text-2xl sm:text-3xl font-black text-center ${hideMsg.includes("うしろ") ? "text-red-600 anim-glitch" : "text-neutral-200"}`} style={{ textShadow: "0 2px 10px #000" }}>
                  {hideMsg}
                </p>
              )
            ) : (
              speech && (
                <div className={`bubble ${dark ? "dark" : "text-amber-900"} px-5 py-3 sm:px-6 sm:py-4 text-base sm:text-xl font-bold text-center max-w-full ${c >= 4 ? "tracking-wider" : ""}`}>
                  <Typer text={speech} speed={speed} onTick={c < 3 ? () => audio.tick() : undefined} />
                </div>
              )
            )}
          </div>

          {/* うさぎ */}
          {!bunnyHidden && (
            <div
              className="absolute left-1/2 bottom-[17%] z-10 transition-transform duration-[1500ms] ease-out"
              style={{ transform: `translateX(-50%) scale(${bunnyScale})`, transformOrigin: "bottom center" }}
            >
              <div
                className="transition-transform duration-300"
                style={{ transform: `rotate(${tilt}deg)`, transformOrigin: "bottom center" }}
              >
                <img
                  src={bunnyImg}
                  alt="ぴょんちゃん"
                  draggable={false}
                  className={`h-[36vh] sm:h-[40vh] object-contain ${c <= 1 ? "anim-bouncy" : c === 2 ? "anim-sway" : c >= 4 ? "anim-jitter" : ""}`}
                  style={{
                    filter: c >= 4
                      ? "brightness(0.45) contrast(1.3) drop-shadow(0 0 30px rgba(150,0,0,0.5))"
                      : c === 3
                      ? "brightness(0.8) saturate(0.6) drop-shadow(0 8px 0 rgba(0,0,0,0.25))"
                      : "drop-shadow(0 8px 0 rgba(0,0,0,0.15))",
                  }}
                />
              </div>
              {/* エフェクト */}
              {effect && (
                <div key={effect.id} className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {effect.kind === "feed" && <img src={assets.carrot} alt="" className="h-20 anim-carrot" />}
                  {effect.kind === "pet" &&
                    [0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className="absolute text-3xl anim-floatup"
                        style={{ ["--dx" as string]: `${(i - 2) * 30}px`, animationDelay: `${i * 0.12}s`, top: "30%" }}
                      >
                        {c >= 2 ? (i === 2 ? "🩸" : "🤍") : "💗"}
                      </span>
                    ))}
                  {effect.kind === "play" && <span className="absolute bottom-0 text-5xl anim-ball">{c >= 2 ? "🎈" : "⚽"}</span>}
                </div>
              )}
            </div>
          )}

          {/* かくれんぼ の しげみ */}
          {phase === "hide" && (
            <div className="absolute inset-x-0 bottom-[12%] top-[35%] z-20 grid grid-cols-3 gap-4 px-6 sm:px-24 place-items-center">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  disabled={!hideReady || !bushes.includes(i)}
                  onClick={() => clickBush(i)}
                  className={`bush w-24 h-20 sm:w-36 sm:h-28 transition-opacity duration-500 ${bushes.includes(i) ? "opacity-100" : "opacity-0"} ${shakeBush === i ? "anim-shake" : ""} ${hideReady ? "cursor-pointer" : "cursor-default"}`}
                  style={{ filter: "brightness(0.55) saturate(0.4) drop-shadow(0 6px 0 rgba(0,0,0,0.5))" }}
                  aria-label="しげみ"
                />
              ))}
            </div>
          )}

          {/* ボタン */}
          <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 flex justify-center gap-3 px-3 z-30 flex-wrap">
            {phase === "game" &&
              (used.length >= 3 ? (
                <button disabled={busy} onClick={goSleep} className="cute-btn bg-indigo-200 text-indigo-900 font-black text-lg sm:text-xl px-8 py-3">
                  🌙 おやすみ
                </button>
              ) : (
                actionBtns.map((b) => (
                  <button
                    key={b.kind}
                    disabled={busy || used.includes(b.kind)}
                    onClick={() => doAction(b.kind)}
                    className={`cute-btn ${dark ? "bg-neutral-800 text-neutral-300 !border-red-950" : `${b.color} text-amber-900`} font-black text-base sm:text-xl px-4 sm:px-7 py-2 sm:py-3 flex items-center gap-2`}
                  >
                    {b.icon}
                    {b.label}
                  </button>
                ))
              ))}
            {phase === "finale" &&
              finaleButtons &&
              finaleOrder.map((idx) => {
                const f = finaleDefs[idx];
                return (
                  <button
                    key={`${idx}-${shuffle}`}
                    disabled={busy}
                    onClick={() => finaleClick(f.kind)}
                    className="anim-fadein px-6 py-3 rounded-full border-2 border-red-950 bg-black/80 text-neutral-400 font-bold text-base sm:text-lg hover:text-red-400 transition-colors"
                  >
                    {f.label}
                  </button>
                );
              })}
          </div>
        </>
      )}

      {/* サブリミナル */}
      {flash && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/60">
          <img src={assets.stare} alt="" className="h-[140vh] max-w-none object-contain" style={{ filter: "invert(1) contrast(2)" }} />
        </div>
      )}
    </div>
  );
}

function GameTitle({ c }: { c: number }) {
  const [alt, setAlt] = useState(false);
  useEffect(() => {
    if (c < 3) return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setAlt(true);
        setTimeout(() => setAlt(false), c >= 4 ? 600 : 160);
        loop();
      }, 1200 + Math.random() * 3000);
    };
    loop();
    return () => clearTimeout(t);
  }, [c]);
  const dark = c >= 3;
  const text = alt ? (c >= 4 ? "ずっと いっしょ ガーデン" : "にげられない ガーデン") : c >= 4 ? "ぴょんぴょん ﾊｯﾋﾟｰ ガーデン" : "ぴょんぴょん ハッピーガーデン";
  return (
    <div
      className={`rounded-full border-4 px-5 py-1.5 font-black text-base sm:text-xl ${
        dark ? "bg-black/70 border-red-950 text-neutral-300" : "bg-white/85 border-[#6b3f2a] text-pink-500"
      } ${alt ? "anim-glitch !text-red-500" : ""}`}
    >
      {!dark && "🌸 "}
      {text}
      {!dark && " 🌸"}
    </div>
  );
}

function DayCard({ day }: { day: number }) {
  const [label, setLabel] = useState(`${day}にちめ`);
  useEffect(() => {
    if (day !== 5) return;
    const seq = ["5にちめ", "6にちめ", "7にちめ", "13にちめ", "44にちめ", "666にちめ", "∞にちめ", "よる"];
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      if (i < seq.length) {
        setLabel(seq[i]);
        audio.glitch();
      } else clearInterval(id);
    }, 420);
    return () => clearInterval(id);
  }, [day]);

  if (day === 5) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
        <p className={`text-5xl sm:text-7xl font-black text-neutral-300 ${label === "よる" ? "text-red-700" : "anim-glitch"}`}>{label}</p>
        <div className="noise-layer opacity-30" />
      </div>
    );
  }
  const cfg = [
    { bg: "from-pink-200 via-yellow-100 to-sky-200", sub: "☀ きょうから よろしくね！", col: "text-pink-500" },
    { bg: "from-pink-200 via-yellow-100 to-sky-200", sub: "☀ きょうも なかよく あそぼうね！", col: "text-pink-500" },
    { bg: "from-stone-300 via-rose-100 to-slate-300", sub: "☁ きょうも ずっと いっしょ", col: "text-rose-400" },
    { bg: "from-neutral-800 via-stone-700 to-neutral-900", sub: "☁ ☁ ☁", col: "text-neutral-300" },
  ][day - 1];
  return (
    <div className={`fixed inset-0 bg-gradient-to-b ${cfg.bg} flex flex-col items-center justify-center`}>
      <p className={`text-6xl sm:text-8xl font-black anim-pop ${day <= 2 ? "cute-outline" : cfg.col}`}>{label}</p>
      <p className={`mt-4 text-lg sm:text-2xl font-bold anim-fadein ${cfg.col}`}>{cfg.sub}</p>
    </div>
  );
}
