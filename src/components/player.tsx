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
import { QueueView } from './queue-view'; // Import QueueView
import {
  usePlaylistStore,
  setPlayerRef,
  useCurrentSong, // Import the hook for current song
  useCurrentSongPlaylistContext, // Import the hook for context
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
    // Update local volume only if not seeking and the store volume changes
    if (!isSeekingRef.current && volume !== localVolume) {
       setLocalVolume(volume);
    }
  }, [volume, localVolume]); // Removed seeking state dependency, relying on ref


  useEffect(() => {
     const newSongId = currentSong?.id ?? null;
     if (newSongId !== currentSongIdRef.current) {
         console.log(`[Player Effect] Song changed: ${currentSongIdRef.current} -> ${newSongId}`);
         currentSongIdRef.current = newSongId;
         if (!currentSong) {
             setCurrentSongProgress(0);
             setCurrentSongDuration(0);
             setSeekValue(null); // Reset local seek value on song change
             console.log("[Player Effect] No current song, resetting progress and duration.");
         } else {
             // Optionally reset progress here if needed, though store might handle it
             setCurrentSongProgress(0); // Reset progress for new song
             setCurrentSongDuration(0); // Reset duration, wait for onDuration
             setSeekValue(null); // Reset local seek value on song change
             console.log(`[Player Effect] New song "${currentSong.title}" loaded. Progress/Duration reset.`);
         }
     }
  }, [currentSong, setCurrentSongProgress, setCurrentSongDuration]);


 // --- Handlers ---

 const debouncedSetCurrentSongProgress = useCallback(
    debounce((progress: number, songId: string | null) => {
        // Check ref instead of state for immediate value inside debounce
        if (songId === currentSongIdRef.current && songId !== null && !isSeekingRef.current) {
           setCurrentSongProgress(progress);
        } else {
           // console.log(`[Player Debounced Progress] Skipped update. Seeking: ${isSeekingRef.current}, Current song ref: ${currentSongIdRef.current}, Progress song ID: ${songId}`);
        }
    }, 50),
    [setCurrentSongProgress] // Removed seeking dependency, relying on ref
 );


 const handleProgress = useCallback(
    (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number; }) => {
        // Only update global progress if NOT seeking (use ref for immediate check)
        if (!isSeekingRef.current && hasMounted && currentSongIdRef.current) {
            const duration = currentSongDuration || 0;
             // Allow slight overshoot for progress updates, clamp value sent to store
             if (duration > 0 && state.playedSeconds >= 0) {
                const clampedProgress = Math.min(state.playedSeconds, duration);
                // Update local seek value *only if not seeking* to keep slider synced
                 if (!isSeekingRef.current) {
                     setSeekValue(null); // Clear seek value if update comes from player
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
    [hasMounted, currentSongDuration, debouncedSetCurrentSongProgress] // Removed seeking state dependency
);


  const handleDuration = useCallback(
    (duration: number) => {
       if (hasMounted && currentSongIdRef.current) {
           const validDuration = duration > 0 ? duration : 0;
           console.log(`[Player HandleDuration] Received duration: ${duration}, Setting: ${validDuration}`);
           setCurrentSongDuration(validDuration);
           // If duration is very small or zero, and progress is already non-zero, reset progress.
           if (validDuration < 1 && currentSongProgress > 0) {
               console.log("[Player HandleDuration] Short/Zero duration received, resetting progress.");
               setCurrentSongProgress(0);
               setSeekValue(0); // Reset local seek value as well
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


 // Called when user starts dragging the slider thumb
 const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!currentSong) return;
    // Only trigger seek if the event target is the slider thumb or track itself
    const target = event.target as HTMLElement;
    if (target.closest('[role="slider"]')) {
        console.log("[Player Seek] Pointer Down on Slider");
        isSeekingRef.current = true; // Use ref for immediate update
        setSeeking(true); // Update state for UI changes if needed
        // Initialize local seek value with current progress
        setSeekValue(currentSongProgress);
        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
    } else {
         console.log("[Player Seek] Pointer Down outside slider thumb/track, ignoring.");
    }
 };


 // Update local seek value while dragging
 const handleValueChange = (value: number[]) => {
    if (!currentSong || !hasMounted || !isSeekingRef.current) return; // Use ref
    console.log(`[Player Seek] Value Change (Dragging): ${value[0]}`);
    setSeekValue(value[0]);
 };


 // Finalize seek on value commit (usually pointer up)
 const handleValueCommit = (value: number[]) => {
   if (!currentSong || !hasMounted || !isSeekingRef.current) return; // Check ref
   const finalSeekTime = value[0];
   console.log(`[Player Seek] Value Commit (Pointer Up). Seeking to: ${finalSeekTime}`);

   // Seek the actual player
   if (playerRef.current) {
     playerRef.current.seekTo(finalSeekTime, 'seconds');
   }

   // Update the global progress state *immediately*
   setCurrentSongProgress(finalSeekTime);

   // Reset seeking state *immediately* after a very short delay
   // This delay helps prevent the handleProgress callback triggered by seekTo
   // from ignoring the update due to the seeking ref still being true.
   setTimeout(() => {
       isSeekingRef.current = false;
       setSeeking(false); // Update state
       setSeekValue(null); // Clear local seek value
       console.log("[Player Seek] Finished seek, reset seeking state.");
       // Re-enable text selection
       document.body.style.userSelect = '';
   }, 50); // 50ms delay seems reasonable
 };


  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setLocalVolume(newVolume); // Update local state for immediate UI feedback
    setVolume(newVolume); // Update global state via action (might be debounced if needed)
    // If user drags volume > 0 while muted, unmute
    if (isMuted && newVolume > 0) {
        toggleMute();
    }
    // If user drags volume to 0, mute
    if (!isMuted && newVolume === 0) {
        toggleMute();
    }
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
  const displayProgress = currentSong ? (seekValue !== null ? seekValue : currentSongProgress) : 0; // Show seekValue during drag
  const displayDuration = currentSong ? currentSongDuration : 0;


  return (
    <footer className="border-t border-border bg-card/95 backdrop-blur-sm p-4 sticky bottom-0 z-50">
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
                onError={(e, data, hlsInstance?, hlsGlobal?) => {
                    console.error("[ReactPlayer Error]", e, data);
                    toast({ title: "Playback Error", description: "Could not play the selected video. Skipping...", variant: "destructive" });
                    // Skip to the next song on error
                    playNextSong();
                }}
            />
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        {/* Song Info */}
        <div className="flex items-center gap-3 w-1/4 lg:w-1/3 min-w-0 select-none"> {/* Added select-none */}
          {currentSong ? (
            <>
              <Image
                src={currentSong.thumbnailUrl || '/placeholder-album.svg'}
                alt={currentSong.title || 'Album Art'}
                width={56}
                height={56}
                className="rounded-md flex-shrink-0 aspect-square object-cover"
                data-ai-hint="music album cover"
                unoptimized // Added for ytimg URLs if not in next.config.js
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
            {/* Shuffle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleShuffle}
              className={cn('h-8 w-8 text-muted-foreground hover:text-foreground transition-colors', isShuffling && !disablePlaylistControls && 'text-accent')}
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
              className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
              disabled={!currentSong} // Disabled only if no song is loaded
              aria-label="Previous song / Restart"
            >
              <SkipBack className="h-5 w-5 fill-current" />
            </Button>
            {/* Play/Pause Button */}
            <Button
              variant="default"
              size="icon"
              onClick={togglePlayPause}
              className={cn(
                 "h-10 w-10 rounded-full transition-transform duration-100 ease-in-out",
                 "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-md hover:shadow-lg"
               )}
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
              className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
              disabled={!currentSong} // Disabled only if no song is loaded
              aria-label="Next song"
            >
              <SkipForward className="h-5 w-5 fill-current" />
            </Button>
            {/* Combined Loop Button */}
             <Button
                variant="ghost"
                size="icon"
                onClick={handleLoopToggle}
                className={cn('h-8 w-8 text-muted-foreground hover:text-foreground transition-colors',
                    // Highlight if single song loop OR playlist loop (when not in single mode) is active
                    (isLooping || (isLoopingPlaylist && !disablePlaylistControls)) && 'text-accent'
                 )}
                disabled={disableLoopSongControl} // Disable only if no song is loaded at all
                aria-label={isLooping ? 'Disable loop' : isLoopingPlaylist ? 'Enable song loop' : 'Enable playlist loop'}
             >
                {getLoopIcon()}
             </Button>
          </div>
          {/* Progress Bar Section */}
           <div className="flex w-full max-w-xl items-center gap-2 px-2 select-none"> {/* Add select-none here */}
             <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
               {formatTime(displayProgress)}
             </span>
             <Slider
               value={[displayProgress]}
               max={Math.max(displayDuration, 1)} // Ensure max is at least 1
               step={0.1}
               className={cn("flex-1", !currentSong && "opacity-50")}
               onValueChange={handleValueChange} // Update local state while dragging
               onValueCommit={handleValueCommit} // Finalize seek on commit (pointer up)
               onPointerDown={handlePointerDown} // Track start of interaction
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
           {/* Queue Button & Sheet */}
            <Sheet open={isQueueSheetOpen} onOpenChange={setIsQueueSheetOpen}>
              <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8",
                      queue.length > 0 ? "text-accent" : "text-muted-foreground", // Use accent color when queue has items
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

          {/* Volume Icon (for mute status and indicator) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {getVolumeIcon()}
          </Button>
          {/* Volume Slider - Always Visible */}
          <div className="w-24 select-none"> {/* Added select-none wrapper */}
            <Slider
              value={[isMuted ? 0 : localVolume]}
              max={1}
              step={0.01}
              className="w-full" // Use base slider styles
              onValueChange={handleVolumeChange}
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
