import { cn } from "@/lib/utils";

export const BirdIcon = ({ className }: { className?: string }) => (
  <div
    className={cn("w-8 h-8 rounded-full bg-red-500 border-2 border-red-700 shadow-md", className)}
    data-ai-hint="red bird"
  >
    <div className="relative w-full h-full">
      <div className="absolute bg-white w-2.5 h-2.5 rounded-full top-1.5 right-1.5 border border-black/50">
        <div className="bg-black w-1 h-1 rounded-full absolute top-[1px] right-[1px]"></div>
      </div>
       <div className="absolute top-[10px] left-[28px] w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[9px] border-l-yellow-500"></div>
    </div>
  </div>
);

export const TargetBlock = ({
  className,
  destroyed,
}: {
  className?: string;
  destroyed?: boolean;
}) => (
  <div
    data-ai-hint="wood box"
    className={cn(
      "w-full h-full bg-accent border-2 border-yellow-600/50 rounded-sm",
      className
    )}
  />
);
