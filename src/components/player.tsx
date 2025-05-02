
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
} from 'lucide-react';
import Image from 'next/image';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { usePlaylistStore, setPlayerRef } from '@/store/playlist-store';
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
    isInSinglePlayMode,
    currentSongPlaylistContextId, // Get context ID
  } = usePlaylistStore((state) => ({
    currentSong: state.currentSong,
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
    isInSinglePlayMode: state.isInSinglePlayMode,
    currentSongPlaylistContextId: state.currentSongPlaylistContextId, // Get playing context
  }));

  const playerRef = useRef<ReactPlayer>(null);
  const [seeking, setSeeking] = useState(false);
  const [localVolume, setLocalVolume] = useState(volume);
  const [hasMounted, setHasMounted] = useState(false);
  const currentSongIdRef = useRef<string | null>(null);

  // --- Effects ---
  useEffect(() => {
    setHasMounted(true);
    setPlayerRef(playerRef);
  }, []);

  useEffect(() => {
    if (!seeking) {
       setLocalVolume(volume);
    }
  }, [volume, seeking]);

  useEffect(() => {
     currentSongIdRef.current = currentSong?.id ?? null;
     if (!currentSong) {
         setCurrentSongProgress(0);
         setCurrentSongDuration(0);
     }
  }, [currentSong, setCurrentSongProgress, setCurrentSongDuration]);

 // --- Handlers ---

 const debouncedSetCurrentSongProgress = useCallback(
    debounce((progress: number, songId: string | null) => {
        if (songId === currentSongIdRef.current && songId !== null) {
           setCurrentSongProgress(progress);
        }
    }, 50),
    [setCurrentSongProgress]
 );


 const handleProgress = useCallback(
    (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number; }) => {
        if (!seeking && playerRef.current && hasMounted && currentSongIdRef.current) {
            const duration = currentSongDuration || 0;
             if (duration > 0 && state.playedSeconds >= 0 && state.playedSeconds <= duration + 0.5) {
                debouncedSetCurrentSongProgress(state.playedSeconds, currentSongIdRef.current);
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
           setCurrentSongDuration(duration);
       }
    },
    [setCurrentSongDuration, hasMounted]
  );

    const handleEnded = useCallback(() => {
        if (hasMounted) {
             playNextSong();
        }
    }, [playNextSong, hasMounted]);


  const handleSeekMouseDown = () => {
     if (!currentSong) return;
    setSeeking(true);
  };

  const handleSeekChange = (value: number[]) => {
     if (!currentSong || !hasMounted) return;
     setCurrentSongProgress(value[0]);
  };

  const handleSeekMouseUp = (value: number[]) => {
    if (playerRef.current && hasMounted && currentSong) {
      const seekTime = value[0];
      playerRef.current.seekTo(seekTime);
      setCurrentSongProgress(seekTime);
    }
    setTimeout(() => setSeeking(false), 50);
  };


  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setLocalVolume(newVolume);
    setVolume(newVolume);
  };

   // --- Loop Logic ---
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
       if (isLooping) return <Repeat1 className="h-4 w-4 text-accent" />; // Highlight single loop when active
       if (isLoopingPlaylist) return <Repeat className="h-4 w-4 text-accent" />;
       return <Repeat className="h-4 w-4" />;
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
  // Disable if no song, or in single play mode, or no playlist context
  const disablePlaylistControls = !currentSong || isInSinglePlayMode || !currentSongPlaylistContextId;
  // Loop Song button is disabled only if there's no song
  const disableLoopSongControl = !currentSong;

  const displayProgress = currentSong ? currentSongProgress : 0;
  const displayDuration = currentSong ? currentSongDuration : 0;


  return (
    <footer className="border-t border-border bg-card p-4">
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
                config={{
                    youtube: { playerVars: { playsinline: 1 } }, // playsinline might help on mobile
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
              max={Math.max(displayDuration, 1)}
              step={0.1}
              className="flex-1 [&>span:first-child]:h-1 [&>span:first-child>span]:h-1 [&>button]:h-3 [&>button]:w-3 [&>button]:bg-foreground [&>button]:border-0 [&>button:hover]:scale-110 [&>button]:transition-transform"
              onValueChange={handleSeekChange}
              onPointerDown={handleSeekMouseDown}
              onPointerUp={(e) => {
                    const sliderElement = e.currentTarget as HTMLElement;
                    const track = sliderElement.querySelector('[data-radix-slider-track]');
                    const thumb = sliderElement.querySelector('[role="slider"]');
                    if (thumb && track) {
                        const trackRect = track.getBoundingClientRect();
                        const thumbRect = thumb.getBoundingClientRect();
                        const thumbCenter = thumbRect.left + thumbRect.width / 2;
                        const percentage = Math.max(0, Math.min(1, (thumbCenter - trackRect.left) / trackRect.width)); // Clamp percentage
                        const maxValue = Math.max(displayDuration, 1);
                        const seekValue = Math.max(0, Math.min(maxValue, percentage * maxValue));
                         handleSeekMouseUp([seekValue]);
                    } else {
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
            value={[isMuted ? 0 : localVolume]}
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
