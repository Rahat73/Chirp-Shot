"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { levels, Level, Block, Pig } from "@/lib/levels";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { BirdIcon, TargetBlock, PigIcon } from "@/components/icons";
import {
  RotateCw,
  ChevronsRight,
} from "lucide-react";

const GAME_WIDTH = 1000;
const GAME_HEIGHT = 500;
const GROUND_HEIGHT = 50;
const BIRD_RADIUS = 16;
const PIG_RADIUS = 20;
const GRAVITY = 0.2;
const MAX_DRAG_DISTANCE = 90;
const POWER_MULTIPLIER = 0.2;

type GameBlock = Block & {
  vx: number;
  vy: number;
};

type GamePig = Pig & {
  vx: number;
  vy: number;
};

export default function ChirpShotGame() {
  const { toast } = useToast();
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const [levelIndex, setLevelIndex] = useState(0);
  const [currentLevel, setCurrentLevel] = useState<Level>(levels[levelIndex]);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<"ready" | "flying" | "settling" | "success" | "fail">("ready");
  
  const [birdPosition, setBirdPosition] = useState(currentLevel.bird);
  const birdVelocity = useRef({ x: 0, y: 0 });
  const birdPath = useRef<Array<{x: number, y: number}>>([]);
  const [birdsRemaining, setBirdsRemaining] = useState(currentLevel.birdCount);

  const [blocks, setBlocks] = useState<GameBlock[]>(
    currentLevel.blocks.map(t => ({ ...t, vx: 0, vy: 0 }))
  );
  const [pigs, setPigs] = useState<GamePig[]>(
    currentLevel.pigs.map(p => ({ ...p, vx: 0, vy: 0 }))
  );
  
  const [isDragging, setIsDragging] = useState(false);
  const [trajectoryPreview, setTrajectoryPreview] = useState<Array<{x: number, y: number}>>([]);

  const animationFrameId = useRef<number>();
  const settleTimer = useRef<number>(0);

  const resetLevel = useCallback((levelIdx: number) => {
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    const newLevel = levels[levelIdx];
    setCurrentLevel(newLevel);
    setBlocks(newLevel.blocks.map(t => ({ ...t, vx: 0, vy: 0 })));
    setPigs(newLevel.pigs.map(p => ({ ...p, vx: 0, vy: 0 })));
    setBirdPosition(newLevel.bird);
    setBirdsRemaining(newLevel.birdCount);
    birdVelocity.current = { x: 0, y: 0 };
    birdPath.current = [];
    setGameState("ready");
    setTrajectoryPreview([]);
    setIsDragging(false);
  }, []);

  useEffect(() => {
    resetLevel(levelIndex);
  }, [levelIndex, resetLevel]);
  
  const prepareNextShot = () => {
    birdPath.current = [];
    setBirdPosition(currentLevel.bird);
    birdVelocity.current = { x: 0, y: 0 };
    setGameState("ready");
  }

  const calculateTrajectoryPoints = (startPos: {x: number, y: number}, startVel: {x: number, y: number}) => {
    let pos = {...startPos};
    let vel = {...startVel};
    const points = [];
    for (let i = 0; i < 50; i++) {
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
    // 1. Update bird physics (if flying)
    let nextBirdPos = { ...birdPosition };
    if (gameState === 'flying') {
      birdVelocity.current.y += GRAVITY;
      nextBirdPos = {
        x: birdPosition.x + birdVelocity.current.x,
        y: birdPosition.y + birdVelocity.current.y,
      };
      birdPath.current.push(nextBirdPos);
    }

    // 2. Update block physics (including gravity for non-destroyed blocks)
    let updatedBlocks = blocks.map(block => {
      let currentBlock = { ...block };

      if (currentBlock.destroyed) {
        // Physics for destroyed blocks (flying away)
        currentBlock.vx *= 0.99; // air friction
        currentBlock.vy += GRAVITY * 0.8;
      } else {
        // Apply gravity to all non-destroyed blocks
        currentBlock.vy += GRAVITY;
      }

      let nextBlockX = currentBlock.x + currentBlock.vx;
      let nextBlockY = currentBlock.y + currentBlock.vy;
      
      // Ground collision
      if (nextBlockY + currentBlock.height > GAME_HEIGHT - GROUND_HEIGHT) {
        nextBlockY = GAME_HEIGHT - GROUND_HEIGHT - currentBlock.height;
        if (currentBlock.destroyed) {
            currentBlock.vy = -currentBlock.vy * 0.3; // bounce
            currentBlock.vx *= 0.8;
        } else {
            currentBlock.vy = 0; // stop
            currentBlock.vx *= 0.95; // friction
        }
      }

      // Block-on-block collision for non-destroyed blocks
      if (!currentBlock.destroyed) {
        for (const otherBlock of blocks) {
          if (currentBlock.id === otherBlock.id || otherBlock.destroyed) continue;

          const otherBlockTop = otherBlock.y;
          const otherBlockLeft = otherBlock.x;
          const otherBlockRight = otherBlock.x + otherBlock.width;
          
          if (
            nextBlockX + currentBlock.width > otherBlockLeft &&
            nextBlockX < otherBlockRight && // Horizontal overlap
            currentBlock.y + currentBlock.height <= otherBlockTop && // Is above
            nextBlockY + currentBlock.height >= otherBlockTop // Will collide
          ) {
            nextBlockY = otherBlockTop - currentBlock.height;
            currentBlock.vy = 0;
            currentBlock.vx *= 0.95; // Friction
            break;
          }
        }
      }
      
      currentBlock.x = nextBlockX;
      currentBlock.y = nextBlockY;
      
      return currentBlock;
    });

    // 3. Update pig physics
    let updatedPigs = pigs.map(pig => {
      let currentPig = { ...pig };

      if (currentPig.destroyed) {
        currentPig.vx *= 0.99;
        currentPig.vy += GRAVITY;
        currentPig.x += currentPig.vx;
        currentPig.y += currentPig.vy;
        return currentPig;
      }
      
      currentPig.vy += GRAVITY;
      let nextY = currentPig.y + currentPig.vy;
      let nextX = currentPig.x + currentPig.vx;

      const pigBottom = nextY + PIG_RADIUS * 2;
      const pigLeft = nextX;
      const pigRight = nextX + PIG_RADIUS * 2;

      if (pigBottom > GAME_HEIGHT - GROUND_HEIGHT) {
        nextY = GAME_HEIGHT - GROUND_HEIGHT - PIG_RADIUS * 2;
        currentPig.vy = 0;
      }

      for (const block of updatedBlocks) {
        if (block.destroyed) continue;
        const blockTop = block.y;
        const blockLeft = block.x;
        const blockRight = block.x + block.width;
        
        if (pigRight > blockLeft && pigLeft < blockRight) {
          if (currentPig.y + PIG_RADIUS * 2 <= blockTop && pigBottom >= blockTop) {
            nextY = blockTop - PIG_RADIUS * 2;
            currentPig.vy = 0;
            break; 
          }
        }
      }
      
      currentPig.x = nextX;
      currentPig.y = nextY;
      return currentPig;
    });

    // 4. Check for bird collisions (if flying)
    let finalBlocks = updatedBlocks;
    let finalPigs = updatedPigs;
    if (gameState === 'flying') {
      const birdLeft = nextBirdPos.x - BIRD_RADIUS;
      const birdRight = nextBirdPos.x + BIRD_RADIUS;
      const birdTop = nextBirdPos.y - BIRD_RADIUS;
      const birdBottom = nextBirdPos.y + BIRD_RADIUS;

      // Bird with Blocks
      finalBlocks = updatedBlocks.map(block => {
          if (block.destroyed) return block;
          const blockLeft = block.x;
          const blockRight = block.x + block.width;
          const blockTop = block.y;
          const blockBottom = block.y + block.height;

          if (birdRight > blockLeft && birdLeft < blockRight && birdBottom > blockTop && birdTop < birdBottom) {
              if (!block.destroyed) setScore(s => s + 10);
              const newBlock = {
                  ...block, destroyed: true,
                  vx: birdVelocity.current.x * 0.5,
                  vy: birdVelocity.current.y * 0.5
              };
              birdVelocity.current.x *= 0.4;
              birdVelocity.current.y *= -0.4;
              return newBlock;
          }
          return block;
      });

      // Bird with Pigs
      finalPigs = updatedPigs.map(pig => {
        if (pig.destroyed) return pig;
        const pigCenterX = pig.x + PIG_RADIUS;
        const pigCenterY = pig.y + PIG_RADIUS;
        const dist = Math.sqrt((nextBirdPos.x - pigCenterX)**2 + (nextBirdPos.y - pigCenterY)**2);

        if (dist < BIRD_RADIUS + PIG_RADIUS) {
            setScore(s => s + 500);
            birdVelocity.current.x *= 0.2;
            birdVelocity.current.y *= -0.2;
            return {...pig, destroyed: true, vx: birdVelocity.current.x, vy: birdVelocity.current.y};
        }
        return pig;
      });
    }
    
    // 5. Update state
    setBirdPosition(nextBirdPos);
    setBlocks(finalBlocks);
    setPigs(finalPigs);
    
    // 6. Check for win/loss/next shot
    const allPigsDestroyed = finalPigs.every(p => p.destroyed);
    if(allPigsDestroyed && finalPigs.length > 0) {
        setGameState("success");
        return;
    }
    
    // Transition from flying to settling
    if (gameState === 'flying') {
      const shotOver = nextBirdPos.y > GAME_HEIGHT - GROUND_HEIGHT - BIRD_RADIUS || nextBirdPos.x > GAME_WIDTH || nextBirdPos.x < 0;
      if (shotOver) {
        setGameState("settling");
        settleTimer.current = Date.now();
      }
    }
    
    // Check if world has settled
    if (gameState === 'settling') {
      const isAnythingMoving = finalBlocks.some(b => Math.hypot(b.vx, b.vy) > 0.1) ||
                              finalPigs.some(p => !p.destroyed && Math.hypot(p.vx, p.vy) > 0.1);

      if (isAnythingMoving) {
        settleTimer.current = Date.now(); // Reset settle timer
      }

      // After 1.5 seconds of no significant movement
      if (Date.now() - settleTimer.current > 1500) {
        if (birdsRemaining > 1) {
          setBirdsRemaining(b => b - 1);
          prepareNextShot();
        } else {
          setGameState(allPigsDestroyed ? "success" : "fail");
        }
        return;
      }
    }

    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [birdPosition, blocks, pigs, birdsRemaining, currentLevel.bird, gameState]);

  useEffect(() => {
    if (gameState === "flying" || gameState === "settling") {
      animationFrameId.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [gameState, gameLoop]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameState !== 'ready' || birdsRemaining <= 0) return;
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
  
  const getPathFromPoints = (points: Array<{x:number, y:number}>) => {
    if (points.length < 2) return "";
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  }
  
  const BirdIndicator = () => {
    const birdIcons = [];
    for(let i = 0; i < birdsRemaining -1; i++){
        birdIcons.push(<div key={i} className="mr-2"><BirdIcon /></div>);
    }
    return <div className="absolute top-4 left-4 flex">{birdIcons}</div>
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

      <div className="w-full max-w-7xl flex justify-center">
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
                <line x1={currentLevel.bird.x - 10} y1={currentLevel.bird.y - 10} x2={birdPosition.x} y2={birdPosition.y} stroke="#4f2600" strokeWidth="5" />
                <line x1={currentLevel.bird.x + 10} y1={currentLevel.bird.y - 10} x2={birdPosition.x} y2={birdPosition.y} stroke="#291500" strokeWidth="5" />
              </>
            )}
            <path d={getPathFromPoints(birdPath.current)} stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" />
            <path d={getPathFromPoints(trajectoryPreview)} stroke="rgba(0,0,0,0.5)" strokeWidth="2" fill="none" strokeDasharray="5 10" />
          </svg>
          
          <BirdIndicator />

          {gameState === "ready" && birdsRemaining > 0 && (
              <div style={{ position: "absolute", left: birdPosition.x - BIRD_RADIUS, top: birdPosition.y - BIRD_RADIUS, pointerEvents: 'none' }}>
                <BirdIcon />
              </div>
          )}
           {(gameState === "flying" || gameState === "settling") && (
              <div style={{ position: "absolute", left: birdPosition.x - BIRD_RADIUS, top: birdPosition.y - BIRD_RADIUS, pointerEvents: 'none' }}>
                <BirdIcon />
              </div>
          )}

          {blocks.map((block) => (
            <div
              key={block.id}
              className="absolute"
              style={{
                left: block.x,
                top: block.y,
                width: block.width,
                height: block.height,
                transition: 'opacity 0.5s',
                opacity: block.destroyed ? 0.8 : 1,
                pointerEvents: 'none'
              }}
            >
              <TargetBlock destroyed={block.destroyed} />
            </div>
          ))}
          
          {pigs.map((pig) => (
              <div key={pig.id} className="absolute" style={{ left: pig.x, top: pig.y, pointerEvents: 'none' }}>
                  <PigIcon destroyed={pig.destroyed} />
              </div>
          ))}
        </div>
      </div>
    </main>
  );
}
