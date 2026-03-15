import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGetTopScores, useSubmitScore } from "../hooks/useQueries";

// ─── Types ───────────────────────────────────────────────────────────────────
type GameScreen = "start" | "playing" | "paused" | "gameover";

interface Car {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  color: string;
  glowColor: string;
}

interface LaneMark {
  y: number;
}

interface GameState {
  player: Car;
  opponents: Car[];
  laneMarks: LaneMark[];
  score: number;
  speed: number;
  baseSpeed: number;
  spawnTimer: number;
  spawnInterval: number;
  distance: number;
  roadX: number;
  roadW: number;
  canvasW: number;
  canvasH: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYER_W = 36;
const PLAYER_H = 60;
const OPPONENT_W = 36;
const OPPONENT_H = 58;
const LANE_MARK_H = 50;
const LANE_MARK_GAP = 40;
const LANE_COLORS = ["#ff3a20", "#ff6600", "#ff2266", "#ff8800"];
const LANE_GLOW = ["#ff3a20", "#ff6600", "#ff2266", "#ff8800"];
const NUM_LANES = 3;

function makeInitialGameState(canvasW: number, canvasH: number): GameState {
  const roadW = canvasW * 0.6;
  const roadX = (canvasW - roadW) / 2;
  const laneW = roadW / NUM_LANES;
  const playerLane = 1;
  const playerX = roadX + laneW * playerLane + laneW / 2 - PLAYER_W / 2;

  const laneMarks: LaneMark[] = [];
  for (
    let y = 0;
    y < canvasH + LANE_MARK_H + LANE_MARK_GAP;
    y += LANE_MARK_H + LANE_MARK_GAP
  ) {
    laneMarks.push({ y });
  }

  return {
    player: {
      x: playerX,
      y: canvasH - PLAYER_H - 40,
      w: PLAYER_W,
      h: PLAYER_H,
      speed: 0,
      color: "#00e5ff",
      glowColor: "#00e5ff",
    },
    opponents: [],
    laneMarks,
    score: 0,
    speed: 0,
    baseSpeed: 120,
    spawnTimer: 0,
    spawnInterval: 2.2,
    distance: 0,
    roadX,
    roadW,
    canvasW,
    canvasH,
  };
}

// ─── Drawing Helpers ──────────────────────────────────────────────────────────
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCar(ctx: CanvasRenderingContext2D, car: Car, isPlayer: boolean) {
  const { x, y, w, h, color, glowColor } = car;

  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = isPlayer ? 20 : 15;
  ctx.fillStyle = color;
  drawRoundedRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.restore();

  const windshieldPadX = 5;
  const windshieldH = 14;
  const windshieldY = isPlayer ? y + 8 : y + h - windshieldH - 8;
  ctx.fillStyle = isPlayer ? "rgba(0,229,255,0.3)" : "rgba(255,60,30,0.3)";
  drawRoundedRect(
    ctx,
    x + windshieldPadX,
    windshieldY,
    w - windshieldPadX * 2,
    windshieldH,
    3,
  );
  ctx.fill();

  const lightY = isPlayer ? y + h - 8 : y + 5;
  const lightSize = 5;
  ctx.fillStyle = isPlayer ? "rgba(255,255,180,0.9)" : "rgba(255,80,0,0.95)";
  ctx.beginPath();
  ctx.arc(x + 5, lightY, lightSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w - 5, lightY, lightSize, 0, Math.PI * 2);
  ctx.fill();

  const wheelW = 8;
  const wheelH = 12;
  const wheelR = 2;
  ctx.fillStyle = "#111";
  drawRoundedRect(ctx, x - wheelW / 2, y + 8, wheelW, wheelH, wheelR);
  ctx.fill();
  drawRoundedRect(ctx, x + w - wheelW / 2, y + 8, wheelW, wheelH, wheelR);
  ctx.fill();
  drawRoundedRect(
    ctx,
    x - wheelW / 2,
    y + h - 8 - wheelH,
    wheelW,
    wheelH,
    wheelR,
  );
  ctx.fill();
  drawRoundedRect(
    ctx,
    x + w - wheelW / 2,
    y + h - 8 - wheelH,
    wheelW,
    wheelH,
    wheelR,
  );
  ctx.fill();

  ctx.fillStyle = isPlayer ? "rgba(0,200,220,0.5)" : "rgba(200,50,20,0.4)";
  ctx.fillRect(x + w / 2 - 2, y + 20, 4, h - 36);
}

function renderFrame(ctx: CanvasRenderingContext2D, gs: GameState) {
  const { canvasW, canvasH, roadX, roadW, player, opponents, laneMarks } = gs;

  const grassGrad = ctx.createLinearGradient(0, 0, canvasW, 0);
  grassGrad.addColorStop(0, "#0a1a0a");
  grassGrad.addColorStop(0.5, "#0d1f0d");
  grassGrad.addColorStop(1, "#0a1a0a");
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  const roadGrad = ctx.createLinearGradient(roadX, 0, roadX + roadW, 0);
  roadGrad.addColorStop(0, "#1a1a2e");
  roadGrad.addColorStop(0.5, "#16213e");
  roadGrad.addColorStop(1, "#1a1a2e");
  ctx.fillStyle = roadGrad;
  ctx.fillRect(roadX, 0, roadW, canvasH);

  ctx.save();
  ctx.strokeStyle = "rgba(0,229,255,0.25)";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#00e5ff";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(roadX + 1, 0);
  ctx.lineTo(roadX + 1, canvasH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(roadX + roadW - 1, 0);
  ctx.lineTo(roadX + roadW - 1, canvasH);
  ctx.stroke();
  ctx.restore();

  const curbW = 10;
  const stripeH = 30;
  for (let sy = -(stripeH * 2); sy < canvasH + stripeH * 2; sy += stripeH * 2) {
    const offset = (gs.distance * 0.5) % (stripeH * 2);
    const yy = sy + offset;
    ctx.fillStyle = "rgba(255,60,0,0.6)";
    ctx.fillRect(roadX - curbW, yy, curbW, stripeH);
    ctx.fillStyle = "rgba(240,240,240,0.5)";
    ctx.fillRect(roadX - curbW, yy + stripeH, curbW, stripeH);
    ctx.fillStyle = "rgba(255,60,0,0.6)";
    ctx.fillRect(roadX + roadW, yy, curbW, stripeH);
    ctx.fillStyle = "rgba(240,240,240,0.5)";
    ctx.fillRect(roadX + roadW, yy + stripeH, curbW, stripeH);
  }

  const laneW = roadW / NUM_LANES;
  for (let l = 1; l < NUM_LANES; l++) {
    const lx = roadX + laneW * l;
    for (const mark of laneMarks) {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.shadowColor = "rgba(255,255,255,0.3)";
      ctx.shadowBlur = 4;
      ctx.fillRect(lx - 2, mark.y, 4, LANE_MARK_H);
      ctx.restore();
    }
  }

  for (const opp of opponents) {
    drawCar(ctx, opp, false);
  }
  drawCar(ctx, player, true);

  ctx.save();
  ctx.font = "bold 14px 'Bricolage Grotesque', sans-serif";
  ctx.fillStyle = "rgba(0,229,255,0.5)";
  ctx.fillText("SCORE", 16, 28);
  ctx.font = "bold 28px 'Bricolage Grotesque', sans-serif";
  ctx.fillStyle = "#00e5ff";
  ctx.shadowColor = "#00e5ff";
  ctx.shadowBlur = 12;
  ctx.fillText(Math.floor(gs.score).toString(), 16, 58);

  const speedStr = `${Math.floor(gs.speed)} km/h`;
  ctx.font = "bold 14px 'Bricolage Grotesque', sans-serif";
  ctx.fillStyle = "rgba(255,165,0,0.5)";
  ctx.textAlign = "right";
  ctx.fillText("SPEED", canvasW - 16, 28);
  ctx.font = "bold 28px 'Bricolage Grotesque', sans-serif";
  ctx.fillStyle = "#ff9900";
  ctx.shadowColor = "#ff9900";
  ctx.shadowBlur = 12;
  ctx.fillText(speedStr, canvasW - 16, 58);
  ctx.restore();
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CarRacingGame() {
  const [screen, setScreen] = useState<GameScreen>("start");
  const [displayScore, setDisplayScore] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gsRef = useRef<GameState | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const screenRef = useRef<GameScreen>("start");

  const { data: leaderboard = [], refetch: refetchScores } = useGetTopScores();
  const submitScore = useSubmitScore();

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    if (gsRef.current) {
      const gs = gsRef.current;
      const newRoadW = canvas.width * 0.6;
      const newRoadX = (canvas.width - newRoadW) / 2;
      gs.canvasW = canvas.width;
      gs.canvasH = canvas.height;
      gs.roadW = newRoadW;
      gs.roadX = newRoadX;
      gs.player.x = Math.max(
        newRoadX + 4,
        Math.min(newRoadX + newRoadW - gs.player.w - 4, gs.player.x),
      );
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  const spawnOpponent = useCallback((gs: GameState) => {
    const { roadX, roadW } = gs;
    const laneW = roadW / NUM_LANES;
    const lane = Math.floor(Math.random() * NUM_LANES);
    const x = roadX + lane * laneW + laneW / 2 - OPPONENT_W / 2;
    const speedFactor = 0.6 + Math.random() * 0.8;
    const colorIdx = Math.floor(Math.random() * LANE_COLORS.length);
    gs.opponents.push({
      x,
      y: -OPPONENT_H - 10,
      w: OPPONENT_W,
      h: OPPONENT_H,
      speed: gs.baseSpeed * speedFactor,
      color: LANE_COLORS[colorIdx],
      glowColor: LANE_GLOW[colorIdx],
    });
  }, []);

  const checkCollision = useCallback((a: Car, b: Car): boolean => {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }, []);

  const update = useCallback(
    (gs: GameState, delta: number) => {
      const keys = keysRef.current;
      const { player, roadX, roadW, canvasH } = gs;

      const isAccel = keys.ArrowUp || keys.w || keys.W;
      const isBrake = keys.ArrowDown || keys.s || keys.S;
      if (isAccel) {
        gs.baseSpeed = Math.min(320, gs.baseSpeed + 60 * delta);
      } else if (isBrake) {
        gs.baseSpeed = Math.max(60, gs.baseSpeed - 80 * delta);
      } else {
        gs.baseSpeed = Math.min(300, gs.baseSpeed + 8 * delta);
      }
      gs.speed = gs.baseSpeed;

      const steer =
        keys.ArrowLeft || keys.a || keys.A
          ? -1
          : keys.ArrowRight || keys.d || keys.D
            ? 1
            : 0;
      const steerSpeed = 200;
      player.x += steer * steerSpeed * delta;
      player.x = Math.max(
        roadX + 4,
        Math.min(roadX + roadW - player.w - 4, player.x),
      );

      const scrollPx = gs.baseSpeed * 0.4 * delta;
      gs.distance += scrollPx;
      gs.laneMarks = gs.laneMarks.map((m) => {
        let ny = m.y + scrollPx;
        if (ny > canvasH) ny -= canvasH + LANE_MARK_H + LANE_MARK_GAP;
        return { y: ny };
      });

      gs.spawnTimer += delta;
      if (gs.spawnTimer >= gs.spawnInterval) {
        gs.spawnTimer = 0;
        spawnOpponent(gs);
        gs.spawnInterval = Math.max(0.8, gs.spawnInterval - 0.04);
      }

      const relSpeed = gs.baseSpeed * 0.4;
      gs.opponents = gs.opponents.filter((opp) => {
        opp.y += (relSpeed + opp.speed * 0.3) * delta;
        return opp.y < canvasH + 100;
      });

      for (const opp of gs.opponents) {
        if (checkCollision(player, opp)) return true;
      }

      gs.score += delta * 10 + scrollPx * 0.1;
      return false;
    },
    [spawnOpponent, checkCollision],
  );

  const makeLoop = useCallback(
    (ctx: CanvasRenderingContext2D, gs: GameState) => {
      const loop = (now: number) => {
        if (screenRef.current !== "playing") return;
        const delta = Math.min((now - lastTimeRef.current) / 1000, 0.05);
        lastTimeRef.current = now;
        const isOver = update(gs, delta);
        renderFrame(ctx, gs);
        if (isOver) {
          setDisplayScore(Math.floor(gs.score));
          setScreen("gameover");
          setSubmitted(false);
          return;
        }
        if (Math.floor(gs.score) % 10 === 0)
          setDisplayScore(Math.floor(gs.score));
        animFrameRef.current = requestAnimationFrame(loop);
      };
      return loop;
    },
    [update],
  );

  const handleStart = useCallback(() => {
    setScreen("playing");
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      gsRef.current = makeInitialGameState(canvas.width, canvas.height);
      lastTimeRef.current = performance.now();
      const loop = makeLoop(ctx, gsRef.current);
      animFrameRef.current = requestAnimationFrame(loop);
    }, 0);
  }, [makeLoop]);

  const handleResume = useCallback(() => {
    setScreen("playing");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gs = gsRef.current;
    if (!gs) return;
    lastTimeRef.current = performance.now();
    const loop = makeLoop(ctx, gs);
    animFrameRef.current = requestAnimationFrame(loop);
  }, [makeLoop]);

  const handleQuit = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    gsRef.current = null;
    setScreen("start");
    refetchScores();
  }, [refetchScores]);

  const handleSubmitScore = useCallback(async () => {
    if (!playerName.trim()) return;
    await submitScore.mutateAsync({
      playerName: playerName.trim(),
      score: displayScore,
    });
    setSubmitted(true);
    refetchScores();
  }, [playerName, displayScore, submitScore, refetchScores]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
        e.preventDefault();
      if (e.key === "Escape" && screenRef.current === "playing") {
        cancelAnimationFrame(animFrameRef.current);
        setScreen("paused");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const sorted = [...leaderboard]
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, 10);

  const rankColor = (i: number) =>
    i === 0
      ? "text-yellow-400"
      : i === 1
        ? "text-gray-300"
        : i === 2
          ? "text-orange-400"
          : "text-muted-foreground";

  return (
    <div
      className="relative w-full h-screen bg-background overflow-hidden"
      ref={containerRef}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        data-ocid="game.canvas_target"
        tabIndex={0}
      />
      <div className="scanline absolute inset-0 pointer-events-none" />

      {/* START SCREEN */}
      {screen === "start" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(oklch(0.85 0.22 196) 1px, transparent 1px), linear-gradient(90deg, oklch(0.85 0.22 196) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
          <div className="relative z-10 flex flex-col items-center gap-6 max-w-lg w-full px-4">
            <div className="text-center mb-2">
              <div className="font-display text-xs tracking-[0.4em] text-primary/60 uppercase mb-2">
                Caffeine Racing
              </div>
              <h1 className="font-display font-extrabold text-6xl sm:text-7xl neon-text text-primary leading-none">
                TURBO
                <br />
                <span className="text-accent neon-orange">RUSH</span>
              </h1>
              <p className="mt-3 text-muted-foreground text-sm tracking-wider">
                Arrow keys / WASD to drive · ESC to pause
              </p>
            </div>

            <button
              type="button"
              data-ocid="game.start_button"
              onClick={handleStart}
              className="game-btn bg-primary text-primary-foreground neon-border text-lg mt-2"
              style={{ minWidth: 200 }}
            >
              START RACE
            </button>

            <div className="w-full mt-2 neon-border rounded-md bg-card/80 backdrop-blur overflow-hidden">
              <div className="px-4 py-2 border-b border-border">
                <span className="font-display font-bold text-sm tracking-widest text-primary uppercase">
                  🏆 Top Scores
                </span>
              </div>
              {sorted.length === 0 ? (
                <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                  No scores yet — be the first!
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {sorted.map((entry, i) => (
                    <div
                      key={`${entry.playerName}-${i}`}
                      className="flex items-center justify-between px-4 py-2 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-display font-bold w-6 ${rankColor(i)}`}
                        >
                          {i + 1}
                        </span>
                        <span className="text-foreground font-medium">
                          {entry.playerName}
                        </span>
                      </div>
                      <span className="font-display font-bold text-primary">
                        {Number(entry.score).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAUSE SCREEN */}
      {screen === "paused" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 backdrop-blur-md">
          <div className="flex flex-col items-center gap-5">
            <h2 className="font-display font-extrabold text-5xl neon-text text-primary tracking-wider">
              PAUSED
            </h2>
            <p className="text-muted-foreground text-sm tracking-widest">
              SCORE: {displayScore.toLocaleString()}
            </p>
            <div className="flex gap-4 mt-2">
              <button
                type="button"
                data-ocid="game.resume_button"
                onClick={handleResume}
                className="game-btn bg-primary text-primary-foreground neon-border"
              >
                RESUME
              </button>
              <button
                type="button"
                data-ocid="game.quit_button"
                onClick={handleQuit}
                className="game-btn bg-secondary text-secondary-foreground border border-border"
              >
                QUIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {screen === "gameover" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(oklch(0.65 0.28 25) 1px, transparent 1px), linear-gradient(90deg, oklch(0.65 0.28 25) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
          <div className="relative z-10 flex flex-col items-center gap-5 max-w-sm w-full px-4">
            <div className="text-center">
              <p className="font-display text-xs tracking-[0.4em] text-destructive/70 uppercase">
                Game Over
              </p>
              <h2
                className="font-display font-extrabold text-6xl mt-1"
                style={{
                  color: "#ff3a20",
                  textShadow:
                    "0 0 10px rgba(255,58,32,0.9), 0 0 30px rgba(255,58,32,0.6)",
                }}
              >
                CRASHED!
              </h2>
            </div>

            <div className="text-center">
              <p className="text-muted-foreground text-sm tracking-widest">
                FINAL SCORE
              </p>
              <p className="font-display font-extrabold text-4xl text-primary neon-text">
                {displayScore.toLocaleString()}
              </p>
            </div>

            {!submitted ? (
              <div className="w-full flex flex-col gap-3">
                <input
                  data-ocid="game.name_input"
                  type="text"
                  placeholder="Enter your name..."
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmitScore();
                  }}
                  maxLength={20}
                  className="w-full bg-secondary border border-border rounded px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-sans"
                />
                <button
                  type="button"
                  data-ocid="game.submit_button"
                  onClick={handleSubmitScore}
                  disabled={!playerName.trim() || submitScore.isPending}
                  className="game-btn bg-accent text-accent-foreground neon-border-orange disabled:opacity-40 disabled:cursor-not-allowed w-full"
                >
                  {submitScore.isPending ? "SAVING..." : "SUBMIT SCORE"}
                </button>
              </div>
            ) : (
              <p className="text-primary neon-text font-display font-bold tracking-widest">
                ✓ SCORE SAVED!
              </p>
            )}

            {submitted && (
              <div className="w-full neon-border rounded-md bg-card/80 overflow-hidden">
                <div className="px-4 py-2 border-b border-border">
                  <span className="font-display font-bold text-xs tracking-widest text-primary uppercase">
                    🏆 Leaderboard
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {sorted.slice(0, 5).map((entry, i) => (
                    <div
                      key={`lb-${entry.playerName}-${i}`}
                      className="flex items-center justify-between px-4 py-2 text-sm"
                    >
                      <div className="flex gap-3">
                        <span
                          className={`font-display font-bold w-5 ${rankColor(i)}`}
                        >
                          {i + 1}
                        </span>
                        <span>{entry.playerName}</span>
                      </div>
                      <span className="font-display font-bold text-primary">
                        {Number(entry.score).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-1">
              <button
                type="button"
                data-ocid="game.start_button"
                onClick={handleStart}
                className="game-btn bg-primary text-primary-foreground neon-border"
              >
                RACE AGAIN
              </button>
              <button
                type="button"
                data-ocid="game.quit_button"
                onClick={handleQuit}
                className="game-btn bg-secondary text-secondary-foreground border border-border"
              >
                MENU
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-muted-foreground/40 pointer-events-none">
        © {new Date().getFullYear()} · Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          className="underline pointer-events-auto"
          target="_blank"
          rel="noreferrer"
        >
          caffeine.ai
        </a>
      </div>
    </div>
  );
}
