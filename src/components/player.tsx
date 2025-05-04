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
} from '@/store/playlist-store';
import { cn } from '@/lib/utils';

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
  const [seeking, setSeeking] = useState(false);
  const [localVolume, setLocalVolume] = useState(volume);
  const [hasMounted, setHasMounted] = useState(false);
  const [isQueueSheetOpen, setIsQueueSheetOpen] = useState(false); // State for queue sheet
  const currentSongIdRef = useRef<string | null>(null);

  // --- Effects ---
  useEffect(() => {
    setHasMounted(true);
    setPlayerRef(playerRef); // Set the global player ref
  }, []);

  useEffect(() => {
    if (!seeking) {
       setLocalVolume(volume);
    }
  }, [volume, seeking]);

  useEffect(() => {
     const newSongId = currentSong?.id ?? null;
     if (newSongId !== currentSongIdRef.current) {
         console.log(`[Player Effect] Song changed: ${currentSongIdRef.current} -> ${newSongId}`);
         currentSongIdRef.current = newSongId;
         if (!currentSong) {
             setCurrentSongProgress(0);
             setCurrentSongDuration(0);
             console.log("[Player Effect] No current song, resetting progress and duration.");
         } else {
             // Optionally reset progress here if needed, though store might handle it
             // setCurrentSongProgress(0);
             console.log(`[Player Effect] New song "${currentSong.title}" loaded.`);
         }
     }
  }, [currentSong, setCurrentSongProgress, setCurrentSongDuration]);

  // Effect to handle seeking when currentSongProgress is reset to 0 by playPreviousSong (restart)
  useEffect(() => {
      if (currentSong && currentSongProgress === 0 && isPlaying && playerRef.current && !seeking) {
          // If progress is 0, song exists, isPlaying, and we're not manually seeking,
          // it might be due to a restart action. Ensure player seeks.
          console.log("[Player Effect] Progress reset detected while playing. Seeking player to 0.");
          playerRef.current.seekTo(0);
      }
  }, [currentSongProgress, currentSong, isPlaying, seeking]);


 // --- Handlers ---

 const debouncedSetCurrentSongProgress = useCallback(
    debounce((progress: number, songId: string | null) => {
        if (songId === currentSongIdRef.current && songId !== null) {
           setCurrentSongProgress(progress);
        } else {
           // console.log(`[Player Debounced Progress] Skipped update. Current song ref: ${currentSongIdRef.current}, Progress song ID: ${songId}`);
        }
    }, 50), // Reduced debounce time
    [setCurrentSongProgress]
 );


 const handleProgress = useCallback(
    (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number; }) => {
        if (!seeking && hasMounted && currentSongIdRef.current) {
            const duration = currentSongDuration || 0;
             // Allow slight overshoot for progress updates, clamp value sent to store
             if (duration > 0 && state.playedSeconds >= 0) {
                const clampedProgress = Math.min(state.playedSeconds, duration);
                debouncedSetCurrentSongProgress(clampedProgress, currentSongIdRef.current);
             } else if (duration === 0 && state.playedSeconds === 0) {
                debouncedSetCurrentSongProgress(0, currentSongIdRef.current);
             }
        }
    },
    [seeking, hasMounted, currentSongDuration, debouncedSetCurrentSongProgress]
);


  const handleDuration = useCallback(
    (duration: number) => {
       if (hasMounted && currentSongIdRef.current) {
           const validDuration = duration > 0 ? duration : 0;
           // console.log(`[Player HandleDuration] Received duration: ${duration}, Setting: ${validDuration}`);
           setCurrentSongDuration(validDuration);
           // If duration is very small or zero, and progress is already non-zero, reset progress.
           if (validDuration < 1 && currentSongProgress > 0) {
               console.log("[Player HandleDuration] Short/Zero duration received, resetting progress.");
               setCurrentSongProgress(0);
           }
       }
    },
    [setCurrentSongDuration, hasMounted, currentSongProgress, setCurrentSongProgress] // Added progress dependencies
  );

    const handleEnded = useCallback(() => {
        console.log("[Player HandleEnded] Song ended.");
        if (hasMounted) {
             playNextSong();
        }
    }, [playNextSong, hasMounted]);


  const handleSeekMouseDown = (e: React.PointerEvent<HTMLDivElement>) => {
     if (!currentSong) return;
     console.log("[Player Seek] Mouse Down");
     setSeeking(true);
     // Optional: Immediately update progress based on click position for better responsiveness
     // handleSeekInteraction(e);
  };

  const handleSeekChange = (value: number[]) => {
     if (!currentSong || !hasMounted) return;
     // console.log(`[Player Seek] Change (Dragging): ${value[0]}`); // Can be noisy
     // Update visual progress immediately while dragging
     setCurrentSongProgress(value[0]);
  };

  const handleSeekMouseUp = (value: number[]) => {
    if (!currentSong || !hasMounted) return;
    const seekTime = value[0];
    console.log(`[Player Seek] Mouse Up. Seeking to: ${seekTime}`);
    if (playerRef.current) {
        playerRef.current.seekTo(seekTime);
    }
    // Ensure final progress state is set
    setCurrentSongProgress(seekTime);
    // Delay setting seeking to false slightly to avoid progress conflicts
    setTimeout(() => {
        console.log("[Player Seek] Setting seeking to false");
        setSeeking(false);
    }, 100); // Increased delay slightly
  };


  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setLocalVolume(newVolume);
    setVolume(newVolume); // Update global state via action
  };

   // --- Loop Logic ---
   const handleLoopToggle = () => {
       if (!isLooping && !isLoopingPlaylist) {
           toggleLoopPlaylist(); // Off -> Playlist Loop
       } else if (isLoopingPlaylist) {
           toggleLoopPlaylist(); // Playlist Loop -> Song Loop
           toggleLoop();
       } else {
           toggleLoop(); // Song Loop -> Off
       }
   };

   const getLoopIcon = () => {
       if (isLooping) return <Repeat1 className="h-4 w-4 text-accent" />; // Highlight single loop when active
       if (isLoopingPlaylist) return <Repeat className="h-4 w-4 text-accent" />; // Highlight playlist loop when active
       return <Repeat className="h-4 w-4" />; // Default loop icon (off state)
   };

  // --- UI Helpers ---
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

  // Determine if playlist controls (Shuffle, Playlist Loop) should be disabled
  const isInSinglePlayMode = !currentSongPlaylistContextId;
  const disablePlaylistControls = !currentSong || isInSinglePlayMode;
  // Loop Song button is disabled only if there's no song
  const disableLoopSongControl = !currentSong;

  // Use local state for display values to avoid flickering during seeking
  const displayProgress = currentSong ? currentSongProgress : 0;
  const displayDuration = currentSong ? currentSongDuration : 0;


  return (
    <footer className="border-t border-border bg-card p-4">
      {/* Conditional ReactPlayer mount */}
      {hasMounted && currentSong?.url && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
            <ReactPlayer
                ref={playerRef}
                url={currentSong.url}
                playing={isPlaying}
                volume={isMuted ? 0 : localVolume}
                loop={isLooping} // Single song loop is handled directly by ReactPlayer
                onProgress={handleProgress}
                onDuration={handleDuration}
                onEnded={handleEnded}
                width="1px"
                height="1px"
                controls={false} // Ensure native controls are off
                config={{
                    youtube: { playerVars: { playsinline: 1, controls: 0 } }, // Ensure YouTube controls are off
                }}
                // onError can be added here to handle playback errors
                onError={(e) => {
                    console.error("[ReactPlayer Error]", e);
                    toast({ title: "Playback Error", description: "Could not play the selected video.", variant: "destructive" });
                    // Optionally skip to the next song on error
                    // playNextSong();
                }}
            />
        </div>
      )}
      <div className="flex items-center justify-between">
        {/* Song Info */}
        <div className="flex items-center gap-3 w-1/3 min-w-0">
          {currentSong ? (
            <>
              <Image
                src={currentSong.thumbnailUrl || '/placeholder-album.svg'}
                alt={currentSong.title || 'Album Art'}
                width={56}
                height={56}
                className="rounded flex-shrink-0"
                data-ai-hint="music album cover"
                unoptimized // Added for ytimg URLs if not in next.config.js
                onError={(e) => { e.currentTarget.src = '/placeholder-album.svg'; }}
              />
              <div className="overflow-hidden">
                <p className="font-semibold truncate text-sm">{currentSong.title || 'Unknown Title'}</p>
                <p className="text-xs text-muted-foreground truncate">{currentSong.author || 'Unknown Artist'}</p>
              </div>
            </>
          ) : (
             <div className="flex items-center gap-3 opacity-50">
              <div className="h-14 w-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-music text-muted-foreground"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <div className="overflow-hidden">
                <p className="font-semibold text-sm">No song playing</p>
                <p className="text-xs text-muted-foreground">Select a song</p>
              </div>
            </div>
          )}
        </div>

        {/* Player Controls */}
        <div className="flex flex-col items-center gap-2 w-1/3">
          <div className="flex items-center gap-4">
            {/* Shuffle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleShuffle}
              className={cn('h-8 w-8', isShuffling && !disablePlaylistControls && 'text-accent')}
              disabled={disablePlaylistControls} // Use the specific disable flag
              aria-label={isShuffling ? 'Disable shuffle' : 'Enable shuffle'}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            {/* Previous Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={playPreviousSong}
              className="h-8 w-8"
              disabled={!currentSong} // Disabled only if no song is loaded
              aria-label="Previous song / Restart"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            {/* Play/Pause Button */}
            <Button
              variant="default"
              size="icon"
              onClick={togglePlayPause}
              className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!currentSong} // Disabled only if no song is loaded
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </Button>
            {/* Next Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={playNextSong}
              className="h-8 w-8"
              disabled={!currentSong} // Disabled only if no song is loaded
              aria-label="Next song"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            {/* Combined Loop Button */}
             <Button
                variant="ghost"
                size="icon"
                onClick={handleLoopToggle}
                className={cn('h-8 w-8',
                    // Highlight if single song loop OR playlist loop (when not in single mode) is active
                    (isLooping || (isLoopingPlaylist && !disablePlaylistControls)) && 'text-accent'
                 )}
                disabled={disableLoopSongControl} // Disable only if no song is loaded at all
                aria-label={isLooping ? 'Disable loop' : isLoopingPlaylist ? 'Enable song loop' : 'Enable playlist loop'}
             >
                {getLoopIcon()}
             </Button>
          </div>
          <div className="flex w-full max-w-md items-center gap-2">
            <span className="text-xs text-muted-foreground w-10 text-right">
              {formatTime(displayProgress)}
            </span>
            <Slider
              value={[displayProgress]}
              max={Math.max(displayDuration, 1)} // Ensure max is at least 1 to prevent errors
              step={0.1}
              className={cn(
                "flex-1",
                "[&>span:first-child]:h-1 [&>span:first-child>span]:h-1", // Track and Range styles
                "[&>button]:h-3 [&>button]:w-3 [&>button]:bg-foreground [&>button]:border-0", // Thumb styles
                "[&>button:hover]:scale-110 [&>button]:transition-transform", // Thumb hover effect
                 !currentSong && "[&>button]:hidden" // Hide thumb if no song
                )}
              onValueChange={handleSeekChange}
              onPointerDown={handleSeekMouseDown}
              // Use onValueCommit for final value after dragging stops
              onValueCommit={handleSeekMouseUp}
              disabled={!currentSong || !currentSongDuration}
              aria-label="Song progress"
            />
            <span className="text-xs text-muted-foreground w-10 text-left">
              {formatTime(displayDuration)}
            </span>
          </div>
        </div>

        {/* Volume & Queue Controls */}
        <div className="flex items-center justify-end gap-2 w-1/3">
           {/* Queue Button & Sheet */}
            <Sheet open={isQueueSheetOpen} onOpenChange={setIsQueueSheetOpen}>
              <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8",
                      queue.length > 0 && "text-accent" // Highlight if queue has items
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

          {/* Mute/Unmute Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="h-8 w-8"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {getVolumeIcon()}
          </Button>
          {/* Volume Slider */}
          <Slider
            value={[isMuted ? 0 : localVolume]}
            max={1}
            step={0.01}
            className={cn(
              "w-24",
              "[&>span:first-child]:h-1 [&>span:first-child>span]:h-1", // Track and Range
              "[&>button]:h-3 [&>button]:w-3 [&>button]:bg-foreground [&>button]:border-0" // Thumb
              )}
            onValueChange={handleVolumeChange}
            aria-label="Volume"
          />
        </div>
      </div>
    </footer>
  );
}

// Re-import toast just in case it's needed here later
import { toast } from '@/hooks/use-toast';
