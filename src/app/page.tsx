"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { levels, Level, Target } from "@/lib/levels";
import { getAiSuggestion } from "./actions";
import type { SuggestOptimalLaunchPositionsOutput } from "@/ai/flows/suggest-optimal-launch-positions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { BirdIcon, TargetBlock } from "@/components/icons";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  RotateCw,
  ChevronsRight,
  Loader2,
  Lightbulb,
} from "lucide-react";

const GAME_WIDTH = 1000;
const GAME_HEIGHT = 500;
const GROUND_HEIGHT = 50;
const BIRD_RADIUS = 16;
const GRAVITY = 0.2;
const MAX_DRAG_DISTANCE = 90;
const POWER_MULTIPLIER = 0.2;

type GameTarget = Target & {
  vx: number;
  vy: number;
};

const aiSuggestionFormSchema = z.object({
  power: z.number().min(10).max(100),
});

export default function ChirpShotGame() {
  const { toast } = useToast();
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const [levelIndex, setLevelIndex] = useState(0);
  const [currentLevel, setCurrentLevel] = useState<Level>(levels[levelIndex]);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<"ready" | "flying" | "success" | "fail">("ready");
  
  const [birdPosition, setBirdPosition] = useState(currentLevel.bird);
  const birdVelocity = useRef({ x: 0, y: 0 });
  const birdPath = useRef<Array<{x: number, y: number}>>([]);

  const [targets, setTargets] = useState<GameTarget[]>(
    currentLevel.targets.map(t => ({ ...t, vx: 0, vy: 0 }))
  );
  
  const [isDragging, setIsDragging] = useState(false);
  const [trajectoryPreview, setTrajectoryPreview] = useState<Array<{x: number, y: number}>>([]);

  const [aiSuggestion, setAiSuggestion] = useState<SuggestOptimalLaunchPositionsOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const animationFrameId = useRef<number>();

  const form = useForm<z.infer<typeof aiSuggestionFormSchema>>({
    resolver: zodResolver(aiSuggestionFormSchema),
    defaultValues: { power: 50 },
  });

  const resetLevel = useCallback((levelIdx: number) => {
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    const newLevel = levels[levelIdx];
    setCurrentLevel(newLevel);
    setTargets(newLevel.targets.map(t => ({ ...t, vx: 0, vy: 0 })));
    setBirdPosition(newLevel.bird);
    birdVelocity.current = { x: 0, y: 0 };
    birdPath.current = [];
    setGameState("ready");
    setAiSuggestion(null);
    setTrajectoryPreview([]);
    setIsDragging(false);
  }, []);

  useEffect(() => {
    resetLevel(levelIndex);
  }, [levelIndex, resetLevel]);

  const calculateTrajectoryPoints = (startPos: {x: number, y: number}, startVel: {x: number, y: number}) => {
    let pos = {...startPos};
    let vel = {...startVel};
    const points = [];
    for (let i = 0; i < 150; i++) {
        vel.y += GRAVITY;
        pos.x += vel.x;
        pos.y += vel.y;
        if (pos.x < 0 || pos.x > GAME_WIDTH || pos.y > GAME_HEIGHT) break;
        if (i % 3 === 0) { 
             points.push({...pos});
        }
    }
    return points;
  }

  const gameLoop = useCallback(() => {
    // 1. Update bird velocity & position
    birdVelocity.current.y += GRAVITY;
    let nextBirdPos = {
      x: birdPosition.x + birdVelocity.current.x,
      y: birdPosition.y + birdVelocity.current.y,
    };
    birdPath.current.push(nextBirdPos);

    // 2. Update targets based on their velocity
    let nextTargets = targets.map(target => {
        if (target.destroyed) {
            let nextVx = target.vx * 0.99; // friction
            let nextVy = target.vy + GRAVITY * 0.8;
            let nextX = target.x + nextVx;
            let nextY = target.y + nextVy;
            
            if (nextY + target.height > GAME_HEIGHT - GROUND_HEIGHT) {
                nextY = GAME_HEIGHT - GROUND_HEIGHT - target.height;
                nextVy = -nextVy * 0.3; // bounce
                nextVx *= 0.8;
            }

            return {...target, x: nextX, y: nextY, vx: nextVx, vy: nextVy};
        }
        return target;
    });
    
    // 3. Check for collisions and update velocities
    nextTargets = nextTargets.map(target => {
        if (target.destroyed && Math.abs(target.vx) < 0.1 && Math.abs(target.vy) < 0.1) return target;
        
        const birdLeft = nextBirdPos.x - BIRD_RADIUS;
        const birdRight = nextBirdPos.x + BIRD_RADIUS;
        const birdTop = nextBirdPos.y - BIRD_RADIUS;
        const birdBottom = nextBirdPos.y + BIRD_RADIUS;

        const targetLeft = target.x;
        const targetRight = target.x + target.width;
        const targetTop = target.y;
        const targetBottom = target.y + target.height;

        if (birdRight > targetLeft && birdLeft < targetRight && birdBottom > targetTop && birdTop < targetBottom) {
            if (!target.destroyed) {
                setScore(s => s + 100);
            }

            const newTarget = {
                ...target,
                destroyed: true,
                vx: (target.vx || 0) + birdVelocity.current.x * 0.5,
                vy: (target.vy || 0) + birdVelocity.current.y * 0.5
            };
            
            birdVelocity.current.x *= 0.4;
            birdVelocity.current.y *= -0.4;

            return newTarget;
        }
        return target;
    });
    
    setBirdPosition(nextBirdPos);
    setTargets(nextTargets);
    
    const allTargetsDestroyed = nextTargets.every(t => t.destroyed);
    if(allTargetsDestroyed && nextTargets.length > 0) {
        setGameState("success");
        return;
    }

    if (nextBirdPos.y > GAME_HEIGHT - GROUND_HEIGHT - BIRD_RADIUS || nextBirdPos.x > GAME_WIDTH || nextBirdPos.x < 0) {
      setGameState(allTargetsDestroyed ? "success" : "fail");
      return;
    }

    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [birdPosition, targets]);

  useEffect(() => {
    if (gameState === "flying") {
      animationFrameId.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [gameState, gameLoop]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameState !== 'ready') return;
    const gameArea = gameAreaRef.current?.getBoundingClientRect();
    if (!gameArea) return;

    const mouseX = e.clientX - gameArea.left;
    const mouseY = e.clientY - gameArea.top;

    const dist = Math.sqrt(
        Math.pow(mouseX - birdPosition.x, 2) +
        Math.pow(mouseY - birdPosition.y, 2)
    );

    if (dist < BIRD_RADIUS * 2) {
        setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || gameState !== 'ready') return;
    const gameArea = gameAreaRef.current?.getBoundingClientRect();
    if (!gameArea) return;

    const mouseX = e.clientX - gameArea.left;
    const mouseY = e.clientY - gameArea.top;

    const slingshotPos = currentLevel.bird;
    let dx = mouseX - slingshotPos.x;
    let dy = mouseY - slingshotPos.y;

    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > MAX_DRAG_DISTANCE) {
        dx = (dx / dist) * MAX_DRAG_DISTANCE;
        dy = (dy / dist) * MAX_DRAG_DISTANCE;
    }

    const newBirdPos = { x: slingshotPos.x + dx, y: slingshotPos.y + dy };
    setBirdPosition(newBirdPos);

    const launchVelX = -dx * POWER_MULTIPLIER;
    const launchVelY = -dy * POWER_MULTIPLIER;

    if (dist > 10) { // Only show trajectory when dragged a bit
        setTrajectoryPreview(calculateTrajectoryPoints(newBirdPos, {x: launchVelX, y: launchVelY}));
    } else {
        setTrajectoryPreview([]);
    }
  };

  const handleMouseUp = () => {
    if (!isDragging || gameState !== 'ready') return;
    setIsDragging(false);
    setTrajectoryPreview([]);
    
    const slingshotPos = currentLevel.bird;
    const dx = birdPosition.x - slingshotPos.x;
    const dy = birdPosition.y - slingshotPos.y;

    if (Math.sqrt(dx*dx + dy*dy) < 10) {
        setBirdPosition(slingshotPos);
        return;
    }

    birdVelocity.current = {
        x: -dx * POWER_MULTIPLIER,
        y: -dy * POWER_MULTIPLIER
    };

    birdPath.current = [birdPosition];
    setGameState("flying");
  };

  const handleNextLevel = () => {
    if (levelIndex < levels.length - 1) {
      setLevelIndex(levelIndex + 1);
    } else {
      toast({ title: "Congratulations!", description: "You have completed all levels!" });
      setLevelIndex(0);
    }
    setScore(0);
  };
  
  async function onSubmit(values: z.infer<typeof aiSuggestionFormSchema>) {
    setIsAiLoading(true);
    setAiSuggestion(null);
    try {
      const result = await getAiSuggestion({
        levelStructure: currentLevel.structure,
        birdType: "Standard Red",
        power: values.power,
      });
      setAiSuggestion(result);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "AI Suggestion Failed",
        description: "Could not get a suggestion at this time.",
      });
    } finally {
      setIsAiLoading(false);
    }
  }

  const getPathFromPoints = (points: Array<{x:number, y:number}>) => {
    if (points.length < 2) return "";
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  }

  return (
    <main className="container mx-auto p-4 min-h-screen flex flex-col items-center justify-center">
      <header className="w-full max-w-7xl mb-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4">
            <div>
              <CardTitle className="text-3xl font-bold text-primary">Chirp Shot</CardTitle>
              <CardDescription>Level {levelIndex + 1} | Score: {score}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {gameState === 'success' && (
                <Button onClick={handleNextLevel} variant="default" className="bg-green-500 hover:bg-green-600">
                  Next Level <ChevronsRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              {(gameState === 'fail' || gameState === 'ready' || gameState === "success") && (
                <Button onClick={() => resetLevel(levelIndex)} variant="outline">
                  Reset <RotateCw className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>
      </header>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div
            ref={gameAreaRef}
            className="relative bg-primary/20 border-2 border-primary/50 rounded-lg overflow-hidden cursor-crosshair"
            style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className="absolute bottom-0 left-0 w-full bg-green-600/50"
              style={{ height: GROUND_HEIGHT }}
              data-ai-hint="grass ground"
            />
            <div className="absolute" style={{ left: currentLevel.bird.x - 15, bottom: GROUND_HEIGHT }}>
              <div className="w-2 h-20 bg-yellow-800 absolute bottom-0 -left-1 transform -rotate-12"></div>
              <div className="w-2 h-20 bg-yellow-800 absolute bottom-0 left-4 transform rotate-12"></div>
            </div>

            <svg width={GAME_WIDTH} height={GAME_HEIGHT} className="absolute top-0 left-0 pointer-events-none">
              {isDragging && (
                <>
                  <line x1={currentLevel.bird.x - 10} y1={GAME_HEIGHT - GROUND_HEIGHT - 35} x2={birdPosition.x} y2={birdPosition.y} stroke="#4f2600" strokeWidth="5" />
                  <line x1={currentLevel.bird.x + 10} y1={GAME_HEIGHT - GROUND_HEIGHT - 35} x2={birdPosition.x} y2={birdPosition.y} stroke="#291500" strokeWidth="5" />
                </>
              )}
              <path d={getPathFromPoints(birdPath.current)} stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" />
              <path d={getPathFromPoints(trajectoryPreview)} stroke="rgba(0,0,0,0.5)" strokeWidth="2" fill="none" strokeDasharray="5 10" />
            </svg>

            {gameState !== "success" && gameState !== "flying" && (
                <div style={{ position: "absolute", left: birdPosition.x - BIRD_RADIUS, top: birdPosition.y - BIRD_RADIUS, pointerEvents: 'none' }}>
                  <BirdIcon />
                </div>
            )}
             {gameState === "flying" && (
                <div style={{ position: "absolute", left: birdPosition.x - BIRD_RADIUS, top: birdPosition.y - BIRD_RADIUS, pointerEvents: 'none' }}>
                  <BirdIcon />
                </div>
            )}

            {targets.map((target) => (
              <div
                key={target.id}
                className="absolute"
                style={{
                  left: target.x,
                  top: target.y,
                  width: target.width,
                  height: target.height,
                  transition: 'opacity 0.5s',
                  opacity: target.destroyed ? 0.8 : 1,
                  pointerEvents: 'none'
                }}
              >
                <TargetBlock destroyed={target.destroyed} />
              </div>
            ))}
            
            {aiSuggestion?.suggestedPositions.map((pos, i) => (
                <div key={i} className="absolute w-8 h-8 bg-white/30 rounded-full border-2 border-dashed border-white"
                     style={{ left: pos.x - 16, top: pos.y - 16 }}>
                </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="text-accent" /> AI Suggestion
              </CardTitle>
              <CardDescription>Get help from AI to find the best launch position.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="power"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Launch Power for AI</FormLabel>
                        <FormControl>
                          <Slider
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            min={10} max={100} step={1}
                          />
                        </FormControl>
                        <FormDescription>
                          AI will base suggestions on this power level. Your actual launch power depends on your drag.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isAiLoading} className="w-full">
                    {isAiLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Get Suggestion
                  </Button>
                </form>
              </Form>
              {aiSuggestion && (
                <div className="mt-4 p-3 bg-background/50 rounded-lg">
                  <h4 className="font-semibold">AI Rationale:</h4>
                  <p className="text-sm text-muted-foreground">{aiSuggestion.rationale}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
