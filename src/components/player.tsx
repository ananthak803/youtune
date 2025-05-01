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
} from 'lucide-react';
import Image from 'next/image';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { usePlaylistStore } from '@/store/playlist-store';
import { cn } from '@/lib/utils';
import type { Song } from '@/lib/types';

export function Player() {
  const {
    currentSong,
    isPlaying,
    isShuffling,
    isLooping,
    playNextSong,
    playPreviousSong,
    togglePlayPause,
    toggleShuffle,
    toggleLoop,
    setCurrentSongProgress,
    currentSongProgress,
    currentSongDuration,
    setCurrentSongDuration,
    volume,
    setVolume,
    isMuted,
    toggleMute,
  } = usePlaylistStore((state) => ({
    currentSong: state.currentSong,
    isPlaying: state.isPlaying,
    isShuffling: state.isShuffling,
    isLooping: state.isLooping,
    playNextSong: state.playNextSong,
    playPreviousSong: state.playPreviousSong,
    togglePlayPause: state.togglePlayPause,
    toggleShuffle: state.toggleShuffle,
    toggleLoop: state.toggleLoop,
    setCurrentSongProgress: state.setCurrentSongProgress,
    currentSongProgress: state.currentSongProgress,
    currentSongDuration: state.currentSongDuration,
    setCurrentSongDuration: state.setCurrentSongDuration,
    volume: state.volume,
    setVolume: state.setVolume,
    isMuted: state.isMuted,
    toggleMute: state.toggleMute,
  }));

  const playerRef = useRef<ReactPlayer>(null);
  const [seeking, setSeeking] = useState(false);
  const [localVolume, setLocalVolume] = useState(volume); // Local state for smoother slider interaction
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);


  // Effect to synchronize local volume state with global state
  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);


  const handleProgress = useCallback(
    (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number; }) => {
      if (!seeking) {
        setCurrentSongProgress(state.playedSeconds);
      }
    },
    [seeking, setCurrentSongProgress]
  );

  const handleDuration = useCallback(
    (duration: number) => {
      setCurrentSongDuration(duration);
    },
    [setCurrentSongDuration]
  );

  const handleSeekMouseDown = () => {
    setSeeking(true);
  };

  const handleSeekChange = (value: number[]) => {
     if (playerRef.current) {
       setCurrentSongProgress(value[0]); // Update visually immediately
     }
  };

 const handleSeekMouseUp = (value: number[]) => {
   if (playerRef.current) {
     playerRef.current.seekTo(value[0]);
     setCurrentSongProgress(value[0]); // Ensure final update
   }
   setSeeking(false);
 };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setLocalVolume(newVolume); // Update local state for slider responsiveness
    setVolume(newVolume); // Update global state
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

  // Effect to handle potential hydration issues with ReactPlayer
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  return (
    <footer className="border-t border-border bg-card p-4">
      {hasMounted && currentSong?.url && (
        <ReactPlayer
          ref={playerRef}
          url={currentSong.url}
          playing={isPlaying}
          volume={isMuted ? 0 : localVolume}
          onProgress={handleProgress}
          onDuration={handleDuration}
          onEnded={playNextSong}
          width="0"
          height="0"
          config={{
            youtube: {
              playerVars: {
                // modestbranding: 1, // Remove YouTube logo - might not work consistently
                // controls: 0, // Hide native controls
              },
            },
          }}
          style={{ display: 'none' }} // Hide the actual player visually
        />
      )}
      <div className="flex items-center justify-between">
        {/* Song Info */}
        <div className="flex items-center gap-3 w-1/3">
          {currentSong ? (
            <>
              <Image
                src={currentSong.thumbnailUrl || '/placeholder-album.svg'}
                alt={currentSong.title || 'Album Art'}
                width={56}
                height={56}
                className="rounded"
                data-ai-hint="music album cover"
                onError={(e) => { e.currentTarget.src = '/placeholder-album.svg'; }}
              />
              <div>
                <p className="font-semibold truncate text-sm">{currentSong.title || 'Unknown Title'}</p>
                <p className="text-xs text-muted-foreground truncate">{currentSong.author || 'Unknown Artist'}</p>
              </div>
            </>
          ) : (
             <div className="flex items-center gap-3 opacity-50">
              <div className="h-14 w-14 rounded bg-muted flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-music text-muted-foreground"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <div>
                <p className="font-semibold text-sm">No song playing</p>
                <p className="text-xs text-muted-foreground">Add a song to start</p>
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
              className={cn('h-8 w-8', isShuffling && 'text-accent')}
              disabled={!currentSong}
              aria-label={isShuffling ? 'Disable shuffle' : 'Enable shuffle'}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={playPreviousSong}
              className="h-8 w-8"
              disabled={!currentSong}
              aria-label="Previous song"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="default" // Use default variant for primary action
              size="icon"
              onClick={togglePlayPause}
              className="h-10 w-10 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
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
              disabled={!currentSong}
              aria-label="Next song"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLoop}
              className={cn('h-8 w-8', isLooping && 'text-accent')}
              disabled={!currentSong}
              aria-label={isLooping ? 'Disable loop' : 'Enable loop'}
            >
              <Repeat className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex w-full max-w-md items-center gap-2">
            <span className="text-xs text-muted-foreground w-10 text-right">
              {formatTime(currentSongProgress)}
            </span>
            <Slider
              value={[currentSongProgress]}
              max={currentSongDuration || 1} // Prevent division by zero or NaN max
              step={1}
              className="flex-1 [&>span:first-child]:h-1 [&>span:first-child>span]:h-1 [&>button]:h-3 [&>button]:w-3 [&>button]:bg-foreground [&>button]:border-0 [&>button:hover]:scale-110"
              onValueChange={handleSeekChange}
              onPointerDown={handleSeekMouseDown} // Use onPointerDown for better touch support
              onPointerUp={(e) => handleSeekMouseUp([parseFloat((e.target as HTMLButtonElement).value)])} // Extract value on up
              disabled={!currentSong || !currentSongDuration}
              aria-label="Song progress"
            />
            <span className="text-xs text-muted-foreground w-10 text-left">
              {formatTime(currentSongDuration)}
            </span>
          </div>
        </div>

        {/* Volume Control */}
        <div className="flex items-center justify-end gap-2 w-1/3 relative"
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8" aria-label={isMuted ? 'Unmute' : 'Mute'}>
            {getVolumeIcon()}
          </Button>
          <div className={cn(
            "absolute bottom-full mb-2 right-0 w-24 transition-opacity duration-200 ease-in-out",
            showVolumeSlider ? "opacity-100 visible" : "opacity-0 invisible"
          )}>
            <Slider
                value={[localVolume]}
                max={1}
                step={0.01}
                className="w-full [&>span:first-child]:h-1 [&>span:first-child>span]:h-1 [&>button]:h-3 [&>button]:w-3 [&>button]:bg-foreground [&>button]:border-0"
                onValueChange={handleVolumeChange}
                aria-label="Volume"
              />
          </div>
        </div>
      </div>
    </footer>
  );
}
