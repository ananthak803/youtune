
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
  Repeat1, // Icon for single song loop
} from 'lucide-react';
import Image from 'next/image';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { usePlaylistStore, setPlayerRef } from '@/store/playlist-store'; // Import setPlayerRef
import { cn } from '@/lib/utils';
import type { Song } from '@/lib/types';

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
  const {
    currentSong,
    isPlaying,
    isShuffling,
    isLooping, // Single song loop
    isLoopingPlaylist, // Playlist loop (new state needed in store)
    playNextSong,
    playPreviousSong,
    togglePlayPause,
    toggleShuffle,
    toggleLoop, // Toggles single song loop
    toggleLoopPlaylist, // Toggles playlist loop (new action needed in store)
    setCurrentSongProgress,
    currentSongProgress,
    currentSongDuration,
    setCurrentSongDuration,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    isInSinglePlayMode,
  } = usePlaylistStore((state) => ({
    currentSong: state.currentSong,
    isPlaying: state.isPlaying,
    isShuffling: state.isShuffling,
    isLooping: state.isLooping,
    isLoopingPlaylist: state.isLoopingPlaylist, // Get playlist loop state
    playNextSong: state.playNextSong,
    playPreviousSong: state.playPreviousSong,
    togglePlayPause: state.togglePlayPause,
    toggleShuffle: state.toggleShuffle,
    toggleLoop: state.toggleLoop,
    toggleLoopPlaylist: state.toggleLoopPlaylist, // Get playlist loop toggle action
    setCurrentSongProgress: state.setCurrentSongProgress,
    currentSongProgress: state.currentSongProgress,
    currentSongDuration: state.currentSongDuration,
    setCurrentSongDuration: state.setCurrentSongDuration,
    volume: state.volume,
    setVolume: state.setVolume,
    isMuted: state.isMuted,
    toggleMute: state.toggleMute,
    isInSinglePlayMode: state.isInSinglePlayMode,
  }));

  const playerRef = useRef<ReactPlayer>(null);
  const [seeking, setSeeking] = useState(false);
  const [localVolume, setLocalVolume] = useState(volume);
  const [hasMounted, setHasMounted] = useState(false);
  const currentSongIdRef = useRef<string | null>(null); // Ref to track current song ID for progress updates

  // --- Effects ---
  useEffect(() => {
    setHasMounted(true);
    // Pass the playerRef to the store
    setPlayerRef(playerRef);
  }, []);

  useEffect(() => {
    // Sync local volume with store, but allow local updates while dragging
    if (!seeking) {
       setLocalVolume(volume);
    }
  }, [volume, seeking]);

  useEffect(() => {
     // Update the ref whenever the current song changes
     currentSongIdRef.current = currentSong?.id ?? null;
      // Reset progress and duration visually if song becomes null
     if (!currentSong) {
         setCurrentSongProgress(0);
         setCurrentSongDuration(0);
     }
  }, [currentSong, setCurrentSongProgress, setCurrentSongDuration]);

 // --- Handlers ---

 // Debounce progress handler slightly to avoid race condition on song change
 const debouncedSetCurrentSongProgress = useCallback(
    debounce((progress: number, songId: string | null) => {
        // Only update progress if the song ID hasn't changed since the update was scheduled
        if (songId === currentSongIdRef.current && songId !== null) {
           setCurrentSongProgress(progress);
        }
    }, 50), // 50ms debounce, adjust as needed
    [setCurrentSongProgress]
 );


 const handleProgress = useCallback(
    (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number; }) => {
        // Check if the component is still mounted and player exists
        if (!seeking && playerRef.current && hasMounted && currentSongIdRef.current) {
            const duration = currentSongDuration || 0;
             // Check if the progress corresponds to the currently loaded song ID
             // And check if progress is within valid bounds (considering potential small inaccuracies)
             if (duration > 0 && state.playedSeconds >= 0 && state.playedSeconds <= duration + 0.5) {
                // Use the debounced function to update the progress
                debouncedSetCurrentSongProgress(state.playedSeconds, currentSongIdRef.current);
             } else if (duration === 0 && state.playedSeconds === 0) {
                // Allow setting progress to 0 when duration is not yet known or song just started
                debouncedSetCurrentSongProgress(0, currentSongIdRef.current);
             }
        }
    },
    [seeking, hasMounted, currentSongDuration, debouncedSetCurrentSongProgress]
);


  const handleDuration = useCallback(
    (duration: number) => {
       if (hasMounted && currentSongIdRef.current) { // Ensure component is mounted and there's a song
           // Only update duration if it's for the correct song
           // This check is implicitly handled by currentSongIdRef usage in handleProgress
           // and the useEffect that resets duration when song becomes null.
           setCurrentSongDuration(duration);
       }
    },
    [setCurrentSongDuration, hasMounted]
  );

    const handleEnded = useCallback(() => {
        if (hasMounted) { // Ensure component is mounted
            // Don't reset progress here, let playNextSong handle it if a new song plays
             playNextSong();
        }
    }, [playNextSong, hasMounted]);


  const handleSeekMouseDown = () => {
     if (!currentSong) return;
    setSeeking(true);
  };

  const handleSeekChange = (value: number[]) => {
     if (!currentSong || !hasMounted) return;
     // Update the visual progress immediately while seeking
     setCurrentSongProgress(value[0]);
  };

  const handleSeekMouseUp = (value: number[]) => {
    if (playerRef.current && hasMounted && currentSong) {
      const seekTime = value[0];
      playerRef.current.seekTo(seekTime);
      setCurrentSongProgress(seekTime); // Ensure final update
    }
    // Delay setting seeking to false slightly to allow final progress update
    setTimeout(() => setSeeking(false), 50);
  };


  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setLocalVolume(newVolume); // Update local state immediately for smooth slider feedback
    setVolume(newVolume);     // Update zustand store (might be slightly delayed)
  };

   // --- Loop Logic ---
   const handleLoopToggle = () => {
       // Cycle through: No Loop -> Loop Playlist -> Loop Song -> No Loop
       if (!isLooping && !isLoopingPlaylist) {
           toggleLoopPlaylist(); // Turn on playlist loop
       } else if (isLoopingPlaylist) {
           toggleLoopPlaylist(); // Turn off playlist loop
           toggleLoop();        // Turn on song loop
       } else { // isLooping is true
           toggleLoop();        // Turn off song loop
       }
   };

   const getLoopIcon = () => {
       if (isLooping) return <Repeat1 className="h-4 w-4" />; // Single song loop
       if (isLoopingPlaylist) return <Repeat className="h-4 w-4 text-accent" />; // Playlist loop (colored)
       return <Repeat className="h-4 w-4" />; // No loop
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

  // Determine if playlist controls should be disabled
  const disablePlaylistControls = isInSinglePlayMode || !currentSong;

  const displayProgress = currentSong ? currentSongProgress : 0;
  const displayDuration = currentSong ? currentSongDuration : 0;


  return (
    <footer className="border-t border-border bg-card p-4">
      {/* ReactPlayer needs to be mounted conditionally on client */}
      {hasMounted && currentSong?.url && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}> {/* Hide player visually but keep it in DOM */}
            <ReactPlayer
                ref={playerRef}
                url={currentSong.url}
                playing={isPlaying}
                volume={isMuted ? 0 : localVolume}
                loop={isLooping} // Use ReactPlayer's loop prop for single song loop
                onProgress={handleProgress}
                onDuration={handleDuration}
                onEnded={handleEnded} // Use custom handler to decide next action
                width="1px" // Minimal size
                height="1px" // Minimal size
                config={{
                    youtube: {
                        playerVars: {
                             // controls: 0, // Hides YouTube's native controls
                            // modestbranding: 1, // Optional: reduces YouTube logo visibility
                        },
                    },
                }}
                // style={{ display: 'none' }} // Alternative hiding method
            />
        </div>
      )}
      <div className="flex items-center justify-between">
        {/* Song Info */}
        <div className="flex items-center gap-3 w-1/3 min-w-0"> {/* Added min-w-0 for better truncation */}
          {currentSong ? (
            <>
              <Image
                src={currentSong.thumbnailUrl || '/placeholder-album.svg'}
                alt={currentSong.title || 'Album Art'}
                width={56}
                height={56}
                className="rounded flex-shrink-0" // Prevent image shrinking
                data-ai-hint="music album cover"
                onError={(e) => { e.currentTarget.src = '/placeholder-album.svg'; }}
              />
              <div className="overflow-hidden"> {/* Added wrapper for truncation */}
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
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleShuffle}
              className={cn('h-8 w-8', isShuffling && !disablePlaylistControls && 'text-accent')}
              disabled={disablePlaylistControls}
              aria-label={isShuffling ? 'Disable shuffle' : 'Enable shuffle'}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={playPreviousSong}
              className="h-8 w-8"
              disabled={!currentSong} // Can always restart or go back if there's a song
              aria-label="Previous song / Restart"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              onClick={togglePlayPause}
              className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90" // Updated style to use primary
              disabled={!currentSong}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={playNextSong}
              className="h-8 w-8"
              disabled={!currentSong} // Can always skip if there's a song (might stop if at end)
              aria-label="Next song"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            {/* Combined Loop Button */}
             <Button
                variant="ghost"
                size="icon"
                onClick={handleLoopToggle}
                className={cn('h-8 w-8', (isLooping || isLoopingPlaylist) && !disablePlaylistControls && 'text-accent')} // Active if either loop is on (in playlist mode) or song loop is on (single mode)
                disabled={!currentSong} // Disable if no song
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
              // Use displayProgress which resets to 0 when currentSong is null
              value={[displayProgress]}
              // Use displayDuration which resets to 0, ensuring max is at least 1 for slider rendering
              max={Math.max(displayDuration, 1)}
              step={0.1} // Finer step for smoother seeking
              className="flex-1 [&>span:first-child]:h-1 [&>span:first-child>span]:h-1 [&>button]:h-3 [&>button]:w-3 [&>button]:bg-foreground [&>button]:border-0 [&>button:hover]:scale-110"
              onValueChange={handleSeekChange} // Update visually on change
              onPointerDown={handleSeekMouseDown}
              onPointerUp={(e) => {
                    // Read value from the slider itself on pointer up for accuracy
                    const sliderElement = e.currentTarget as HTMLElement;
                    const track = sliderElement.querySelector('[data-radix-slider-track]');
                    const thumb = sliderElement.querySelector('[role="slider"]');
                    if (thumb && track) {
                        const trackRect = track.getBoundingClientRect();
                        const thumbRect = thumb.getBoundingClientRect();
                        // Calculate percentage based on thumb center relative to track start
                        const thumbCenter = thumbRect.left + thumbRect.width / 2;
                        const percentage = (thumbCenter - trackRect.left) / trackRect.width;
                        const maxValue = Math.max(displayDuration, 1);
                        const seekValue = Math.max(0, Math.min(maxValue, percentage * maxValue));
                         handleSeekMouseUp([seekValue]);
                    } else {
                         // Fallback: use the last known value from onValueChange if needed
                         handleSeekMouseUp([displayProgress]);
                         console.warn("Could not accurately determine seek value on pointer up.");
                    }
               }}
              disabled={!currentSong || !currentSongDuration}
              aria-label="Song progress"
            />
            <span className="text-xs text-muted-foreground w-10 text-left">
              {formatTime(displayDuration)}
            </span>
          </div>
        </div>

        {/* Volume Control */}
        <div className="flex items-center justify-end gap-2 w-1/3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="h-8 w-8"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {getVolumeIcon()}
          </Button>
          <Slider
            value={[isMuted ? 0 : localVolume]} // Reflect mute state visually
            max={1}
            step={0.01}
            className="w-24 [&>span:first-child]:h-1 [&>span:first-child>span]:h-1 [&>button]:h-3 [&>button]:w-3 [&>button]:bg-foreground [&>button]:border-0"
            onValueChange={handleVolumeChange}
            aria-label="Volume"
          />
        </div>
      </div>
    </footer>
  );
}
