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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BirdIcon, TargetBlock } from "@/components/icons";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Rocket,
  RotateCw,
  ChevronsRight,
  Loader2,
  Lightbulb,
} from "lucide-react";

const GAME_WIDTH = 1000;
const GAME_HEIGHT = 500;
const GROUND_HEIGHT = 50;
const BIRD_RADIUS = 16; // half of icon size
const GRAVITY = 0.2;

const aiSuggestionFormSchema = z.object({
  power: z.number().min(10).max(100),
});

export default function ChirpShotGame() {
  const { toast } = useToast();
  const [levelIndex, setLevelIndex] = useState(0);
  const [currentLevel, setCurrentLevel] = useState<Level>(levels[levelIndex]);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<"ready" | "flying" | "success" | "fail">("ready");
  
  const [birdPosition, setBirdPosition] = useState(currentLevel.bird);
  const birdVelocity = useRef({ x: 0, y: 0 });
  const birdPath = useRef<Array<{x: number, y: number}>>([]);

  const [targets, setTargets] = useState<Target[]>(currentLevel.targets);
  const [launchAngle, setLaunchAngle] = useState(30);
  const [launchPower, setLaunchPower] = useState(50);

  const [aiSuggestion, setAiSuggestion] = useState<SuggestOptimalLaunchPositionsOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const animationFrameId = useRef<number>();

  const form = useForm<z.infer<typeof aiSuggestionFormSchema>>({
    resolver: zodResolver(aiSuggestionFormSchema),
    defaultValues: { power: 50 },
  });

  const resetLevel = useCallback((levelIdx: number) => {
    const newLevel = levels[levelIdx];
    setCurrentLevel(newLevel);
    setTargets(JSON.parse(JSON.stringify(newLevel.targets)));
    setBirdPosition(newLevel.bird);
    birdVelocity.current = { x: 0, y: 0 };
    birdPath.current = [];
    setGameState("ready");
    setAiSuggestion(null);
  }, []);

  useEffect(() => {
    resetLevel(levelIndex);
  }, [levelIndex, resetLevel]);

  const checkCollisions = useCallback((pos: { x: number; y: number }) => {
    let collisionOccurred = false;
    const newTargets = targets.map((target) => {
      if (target.destroyed) return target;

      const birdLeft = pos.x - BIRD_RADIUS;
      const birdRight = pos.x + BIRD_RADIUS;
      const birdTop = pos.y - BIRD_RADIUS;
      const birdBottom = pos.y + BIRD_RADIUS;

      const targetLeft = target.x;
      const targetRight = target.x + target.width;
      const targetTop = target.y;
      const targetBottom = target.y + target.height;

      if (
        birdRight > targetLeft &&
        birdLeft < targetRight &&
        birdBottom > targetTop &&
        birdTop < targetBottom
      ) {
        collisionOccurred = true;
        setScore((s) => s + 100);
        return { ...target, destroyed: true };
      }
      return target;
    });

    if (collisionOccurred) {
      setTargets(newTargets);
      birdVelocity.current = { x: birdVelocity.current.x * 0.5, y: -birdVelocity.current.y * 0.3 };
      
      const allDestroyed = newTargets.every(t => t.destroyed);
      if (allDestroyed) {
        setGameState("success");
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      }
    }
  }, [targets, setGameState, setScore]);

  const gameLoop = useCallback(() => {
    birdVelocity.current.y += GRAVITY;
    const newPos = {
      x: birdPosition.x + birdVelocity.current.x,
      y: birdPosition.y + birdVelocity.current.y,
    };

    setBirdPosition(newPos);
    birdPath.current.push(newPos);

    checkCollisions(newPos);

    if (
      newPos.y > GAME_HEIGHT - GROUND_HEIGHT - BIRD_RADIUS ||
      newPos.x > GAME_WIDTH || newPos.x < 0
    ) {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      const allDestroyed = targets.every(t => t.destroyed);
      setGameState(allDestroyed ? "success" : "fail");
      return;
    }

    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [birdPosition, checkCollisions, targets]);

  useEffect(() => {
    if (gameState === "flying") {
      animationFrameId.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [gameState, gameLoop]);

  const handleLaunch = () => {
    if (gameState !== "ready") return;

    const angleInRadians = (-launchAngle * Math.PI) / 180;
    const powerFactor = launchPower / 5;
    birdVelocity.current = {
      x: Math.cos(angleInRadians) * powerFactor,
      y: Math.sin(angleInRadians) * powerFactor,
    };
    birdPath.current = [birdPosition];
    setGameState("flying");
  };

  const handleNextLevel = () => {
    if (levelIndex < levels.length - 1) {
      setLevelIndex(levelIndex + 1);
    } else {
      toast({ title: "Congratulations!", description: "You have completed all levels!" });
      setLevelIndex(0); // Restart
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

  const getTrajectoryPath = () => {
    if (birdPath.current.length < 2) return "";
    let path = `M ${birdPath.current[0].x} ${birdPath.current[0].y}`;
    for (let i = 1; i < birdPath.current.length; i++) {
      path += ` L ${birdPath.current[i].x} ${birdPath.current[i].y}`;
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
              {(gameState === 'fail' || gameState === 'ready') && (
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
            className="relative bg-primary/20 border-2 border-primary/50 rounded-lg overflow-hidden"
            style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
          >
            {/* Game Area */}
            <div
              className="absolute bottom-0 left-0 w-full bg-green-600/50"
              style={{ height: GROUND_HEIGHT }}
              data-ai-hint="grass ground"
            />
            {/* Slingshot */}
            <div className="absolute" style={{ left: currentLevel.bird.x - 15, bottom: GROUND_HEIGHT }}>
              <div className="w-2 h-16 bg-yellow-800 absolute bottom-0 -left-1"></div>
              <div className="w-2 h-20 bg-yellow-800 absolute bottom-0 left-4"></div>
            </div>

            {/* Bird and Path */}
            {gameState !== "success" && (
                <div style={{ position: "absolute", left: birdPosition.x - BIRD_RADIUS, top: birdPosition.y - BIRD_RADIUS }}>
                  <BirdIcon />
                </div>
            )}
            <svg width={GAME_WIDTH} height={GAME_HEIGHT} className="absolute top-0 left-0 pointer-events-none">
              <path d={getTrajectoryPath()} stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" strokeDasharray="4 4" />
            </svg>

            {/* Targets */}
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
                  opacity: target.destroyed ? 0.3 : 1
                }}
              >
                <TargetBlock destroyed={target.destroyed} />
              </div>
            ))}
            
            {/* AI Suggestions */}
            {aiSuggestion?.suggestedPositions.map((pos, i) => (
                <div key={i} className="absolute w-8 h-8 bg-white/30 rounded-full border-2 border-dashed border-white"
                     style={{ left: pos.x - 16, top: pos.y - 16, transform: `rotate(${launchAngle}deg)`}}>
                </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card className={gameState === "flying" ? "opacity-50 pointer-events-none" : ""}>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="angle">Angle ({launchAngle}°)</Label>
                <Slider id="angle" value={[launchAngle]} onValueChange={([v]) => setLaunchAngle(v)} min={0} max={90} step={1} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="power">Power ({launchPower})</Label>
                <Slider id="power" value={[launchPower]} onValueChange={([v]) => setLaunchPower(v)} min={10} max={100} step={1} />
              </div>
              <Button onClick={handleLaunch} className="w-full">
                <Rocket className="mr-2 h-4 w-4" /> Launch
              </Button>
            </CardContent>
          </Card>

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
                        <FormLabel>Confirm Launch Power</FormLabel>
                        <FormControl>
                          <Slider
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            min={10} max={100} step={1}
                          />
                        </FormControl>
                        <FormDescription>
                          AI will base suggestions on this power level.
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
