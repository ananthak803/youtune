// src/components/player.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactPlayer from 'react-player/youtube';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Volume1,
  Repeat1,
  ListOrdered,
} from 'lucide-react';
import Image from 'next/image';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'; // Import Sheet components
import { QueueView } from '@/components/queue-view'; // Import QueueView
import {
  usePlaylistStore,
  setPlayerRef,
  useCurrentSong, // Import the hook for current song
  useCurrentSongPlaylistContext, // Import the hook for context
  seekPlayerTo, // Import centralized player control
} from '@/store/playlist-store';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast'; // Import toast

// Simple debounce function
const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => resolve(func(...args)), waitFor);
    });
};


export function Player() {
  const currentSong = useCurrentSong(); // Use the derived state hook
  const currentSongPlaylistContextId = useCurrentSongPlaylistContext(); // Use the derived state hook

  const {
    isPlaying,
    isShuffling,
    isLooping,
    isLoopingPlaylist,
    playNextSong,
    playPreviousSong,
    togglePlayPause,
    toggleShuffle,
    toggleLoop,
    toggleLoopPlaylist,
    setCurrentSongProgress,
    currentSongProgress,
    currentSongDuration,
    setCurrentSongDuration,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    queue, // Get the queue for the queue button indicator
  } = usePlaylistStore((state) => ({
    isPlaying: state.isPlaying,
    isShuffling: state.isShuffling,
    isLooping: state.isLooping,
    isLoopingPlaylist: state.isLoopingPlaylist,
    playNextSong: state.playNextSong,
    playPreviousSong: state.playPreviousSong,
    togglePlayPause: state.togglePlayPause,
    toggleShuffle: state.toggleShuffle,
    toggleLoop: state.toggleLoop,
    toggleLoopPlaylist: state.toggleLoopPlaylist,
    setCurrentSongProgress: state.setCurrentSongProgress,
    currentSongProgress: state.currentSongProgress,
    currentSongDuration: state.currentSongDuration,
    setCurrentSongDuration: state.setCurrentSongDuration,
    volume: state.volume,
    setVolume: state.setVolume,
    isMuted: state.isMuted,
    toggleMute: state.toggleMute,
    queue: state.queue, // Get queue state
  }));

  const playerRef = useRef<ReactPlayer>(null);
  const [seeking, setSeeking] = useState(false); // State to track if user is interacting with slider
  const [seekValue, setSeekValue] = useState<number | null>(null); // Local state for slider value during drag
  const [localVolume, setLocalVolume] = useState(volume);
  const [hasMounted, setHasMounted] = useState(false);
  const [isQueueSheetOpen, setIsQueueSheetOpen] = useState(false); // State for queue sheet
  const currentSongIdRef = useRef<string | null>(null);
  const isSeekingRef = useRef(false); // Use ref for immediate access in callbacks

  // --- Effects ---
  useEffect(() => {
    setHasMounted(true);
    setPlayerRef(playerRef); // Set the global player ref
  }, []);

  useEffect(() => {
    if (!isSeekingRef.current && volume !== localVolume) {
       setLocalVolume(volume);
    }
  }, [volume, localVolume]);


  useEffect(() => {
     const newSongId = currentSong?.id ?? null;
     if (newSongId !== currentSongIdRef.current) {
         console.log(`[Player Effect] Song changed: ${currentSongIdRef.current} -> ${newSongId}`);
         currentSongIdRef.current = newSongId;
         if (!currentSong) {
             // setCurrentSongProgress(0); // Let store handle progress reset
             // setCurrentSongDuration(0); // Let store handle duration reset
             setSeekValue(null);
             console.log("[Player Effect] No current song, resetting local seek value.");
         } else {
             // setCurrentSongProgress(0); // Store resets progress on song change
             // setCurrentSongDuration(0); // Duration will be set by onDuration
             setSeekValue(null);
             console.log(`[Player Effect] New song "${currentSong.title}" loaded. Local seek value reset.`);
         }
     }
  }, [currentSong]); // Removed store setters


 const debouncedSetCurrentSongProgress = useCallback(
    debounce((progress: number, songId: string | null) => {
        if (songId === currentSongIdRef.current && songId !== null && !isSeekingRef.current) {
           setCurrentSongProgress(progress);
        }
    }, 50),
    [setCurrentSongProgress]
 );


 const handleProgress = useCallback(
    (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number; }) => {
        if (!isSeekingRef.current && hasMounted && currentSongIdRef.current) {
            const duration = currentSongDuration || 0;
             if (duration > 0 && state.playedSeconds >= 0) {
                const clampedProgress = Math.min(state.playedSeconds, duration);
                 if (!isSeekingRef.current) {
                     setSeekValue(null);
                     debouncedSetCurrentSongProgress(clampedProgress, currentSongIdRef.current);
                 }
             } else if (duration === 0 && state.playedSeconds === 0) {
                if (!isSeekingRef.current) {
                    setSeekValue(null);
                    debouncedSetCurrentSongProgress(0, currentSongIdRef.current);
                }
             }
        }
    },
    [hasMounted, currentSongDuration, debouncedSetCurrentSongProgress]
);


  const handleDuration = useCallback(
    (duration: number) => {
       if (hasMounted && currentSongIdRef.current) {
           const validDuration = duration > 0 ? duration : 0;
           console.log(`[Player HandleDuration] Received duration: ${duration}, Setting: ${validDuration}`);
           setCurrentSongDuration(validDuration);
           if (validDuration < 1 && currentSongProgress > 0) {
               console.log("[Player HandleDuration] Short/Zero duration received, resetting progress.");
               seekPlayerTo(0); // Use central seek function
           }
       }
    },
    [setCurrentSongDuration, hasMounted, currentSongProgress] // Removed setCurrentSongProgress
  );

    const handleEnded = useCallback(() => {
        console.log("[Player HandleEnded] Song ended.");
        if (hasMounted) {
             // Use the store's logic which handles looping etc.
             playNextSong();
        }
    }, [playNextSong, hasMounted]);


 const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!currentSong) return;
    const target = event.target as HTMLElement;
    if (target.closest('[role="slider"]')) {
        console.log("[Player Seek] Pointer Down on Slider");
        isSeekingRef.current = true;
        setSeeking(true);
        setSeekValue(currentSongProgress);
        document.body.style.userSelect = 'none';
    } else {
         console.log("[Player Seek] Pointer Down outside slider thumb/track, ignoring.");
    }
 };


 const handleValueChange = (value: number[]) => {
    if (!currentSong || !hasMounted || !isSeekingRef.current) return;
    console.log(`[Player Seek] Value Change (Dragging): ${value[0]}`);
    setSeekValue(value[0]);
 };


 const handleValueCommit = (value: number[]) => {
   if (!currentSong || !hasMounted || !isSeekingRef.current) return;
   const finalSeekTime = value[0];
   console.log(`[Player Seek] Value Commit (Pointer Up). Seeking to: ${finalSeekTime}`);

   // Use centralized function to seek and update store
   seekPlayerTo(finalSeekTime, 'seconds');

   setTimeout(() => {
       isSeekingRef.current = false;
       setSeeking(false);
       setSeekValue(null);
       console.log("[Player Seek] Finished seek, reset seeking state.");
       document.body.style.userSelect = '';
   }, 50);
 };


  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setLocalVolume(newVolume);
    setVolume(newVolume);
    if (isMuted && newVolume > 0) {
        toggleMute();
    }
    if (!isMuted && newVolume === 0) {
        toggleMute();
    }
  };

   const handleLoopToggle = () => {
       if (!isLooping && !isLoopingPlaylist) {
           toggleLoopPlaylist();
       } else if (isLoopingPlaylist) {
           toggleLoopPlaylist();
           toggleLoop();
       } else {
           toggleLoop();
       }
   };

   const getLoopIcon = () => {
       if (isLooping) return <Repeat1 className="h-4 w-4 text-accent" />;
       if (isLoopingPlaylist) return <Repeat className="h-4 w-4 text-accent" />;
       return <Repeat className="h-4 w-4" />;
   };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const date = new Date(seconds * 1000);
    const mm = date.getUTCMinutes();
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const getVolumeIcon = () => {
    if (isMuted || localVolume === 0) return <VolumeX className="h-5 w-5" />;
    if (localVolume < 0.5) return <Volume1 className="h-5 w-5" />;
    return <Volume2 className="h-5 w-5" />;
  };

  const isInSinglePlayMode = !currentSongPlaylistContextId;
  const disablePlaylistControls = !currentSong || isInSinglePlayMode;
  const disableLoopSongControl = !currentSong;

  const displayProgress = currentSong ? (seekValue !== null ? seekValue : currentSongProgress) : 0;
  const displayDuration = currentSong ? currentSongDuration : 0;


  return (
    <footer className="border-t border-border bg-card/95 backdrop-blur-sm p-4 sticky bottom-0 z-50 select-none"> {/* Added select-none */}
      {hasMounted && currentSong?.url && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
            <ReactPlayer
                ref={playerRef}
                url={currentSong.url}
                playing={isPlaying}
                volume={isMuted ? 0 : localVolume}
                loop={isLooping} // Only handle single song loop here
                onProgress={handleProgress}
                onDuration={handleDuration}
                onEnded={handleEnded} // Store logic now handles playlist looping/stopping
                width="1px"
                height="1px"
                controls={false}
                config={{
                    youtube: { playerVars: { playsinline: 1, controls: 0 } },
                }}
                onError={(e, data, hlsInstance?, hlsGlobal?) => {
                    console.error("[ReactPlayer Error]", e, data);
                    toast({ title: "Playback Error", description: "Could not play the selected video. Skipping...", variant: "destructive" });
                    playNextSong();
                }}
            />
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        {/* Song Info */}
        <div className="flex items-center gap-3 w-1/4 lg:w-1/3 min-w-0">
          {currentSong ? (
            <>
              <Image
                src={currentSong.thumbnailUrl || '/placeholder-album.svg'}
                alt={currentSong.title || 'Album Art'}
                width={56}
                height={56}
                className="rounded-md flex-shrink-0 aspect-square object-cover"
                data-ai-hint="music album cover"
                unoptimized
                onError={(e) => { e.currentTarget.src = '/placeholder-album.svg'; }}
              />
              <div className="overflow-hidden">
                <p className="font-semibold truncate text-sm leading-tight">{currentSong.title || 'Unknown Title'}</p>
                <p className="text-xs text-muted-foreground truncate">{currentSong.author || 'Unknown Artist'}</p>
              </div>
            </>
          ) : (
             <div className="flex items-center gap-3 opacity-50">
              <div className="h-14 w-14 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-music text-muted-foreground"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <div className="overflow-hidden">
                <p className="font-semibold text-sm leading-tight">No song playing</p>
                <p className="text-xs text-muted-foreground">Select a song</p>
              </div>
            </div>
          )}
        </div>

        {/* Player Controls */}
        <div className="flex flex-col items-center gap-1 w-1/2 lg:w-1/3">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleShuffle}
              className={cn('h-8 w-8 text-muted-foreground hover:text-foreground transition-colors', isShuffling && !disablePlaylistControls && 'text-accent')}
              disabled={disablePlaylistControls}
              aria-label={isShuffling ? 'Disable shuffle' : 'Enable shuffle'}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={playPreviousSong}
              className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
              disabled={!currentSong}
              aria-label="Previous song / Restart"
            >
              <SkipBack className="h-5 w-5 fill-current" />
            </Button>
            <Button
              variant="default"
              size="icon"
              onClick={togglePlayPause}
              className={cn(
                 "h-10 w-10 rounded-full transition-transform duration-100 ease-in-out",
                 "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-md hover:shadow-lg"
               )}
              disabled={!currentSong}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={playNextSong}
              className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
              disabled={!currentSong}
              aria-label="Next song"
            >
              <SkipForward className="h-5 w-5 fill-current" />
            </Button>
             <Button
                variant="ghost"
                size="icon"
                onClick={handleLoopToggle}
                className={cn('h-8 w-8 text-muted-foreground hover:text-foreground transition-colors',
                    (isLooping || (isLoopingPlaylist && !disablePlaylistControls)) && 'text-accent'
                 )}
                disabled={disableLoopSongControl}
                aria-label={isLooping ? 'Disable loop' : isLoopingPlaylist ? 'Enable song loop' : 'Enable playlist loop'}
             >
                {getLoopIcon()}
             </Button>
          </div>
           <div className="flex w-full max-w-xl items-center gap-2 px-2">
             <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
               {formatTime(displayProgress)}
             </span>
             <Slider
               value={[displayProgress]}
               max={Math.max(displayDuration, 1)}
               step={0.1}
               className={cn("flex-1", !currentSong && "opacity-50")}
               onValueChange={handleValueChange}
               onValueCommit={handleValueCommit}
               onPointerDown={handlePointerDown}
               disabled={!currentSong || !currentSongDuration}
               aria-label="Song progress"
             />
             <span className="text-xs text-muted-foreground w-10 text-left tabular-nums">
               {formatTime(displayDuration)}
             </span>
           </div>
        </div>

        {/* Volume & Queue Controls */}
        <div className="flex items-center justify-end gap-3 w-1/4 lg:w-1/3">
            <Sheet open={isQueueSheetOpen} onOpenChange={setIsQueueSheetOpen}>
              <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8",
                      queue.length > 0 ? "text-accent" : "text-muted-foreground", // Highlight if queue has items
                      "hover:text-foreground transition-colors" // Standard hover effect
                    )}
                    aria-label="Show queue"
                  >
                  <ListOrdered className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-md p-0 flex flex-col">
                 <SheetHeader className="p-4 border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                   <SheetTitle>Playback Queue</SheetTitle>
                   <SheetDescription className="sr-only">
                      View and manage the upcoming songs in your playback queue.
                   </SheetDescription>
                 </SheetHeader>
                 <QueueView />
               </SheetContent>
            </Sheet>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {getVolumeIcon()}
          </Button>
          <div className="w-24">
            <Slider
              value={[isMuted ? 0 : localVolume]}
              max={1}
              step={0.01}
              className="w-full"
              onValueChange={handleVolumeChange}
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
