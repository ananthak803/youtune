// src/components/playlist-view.tsx

'use client';

import React from 'react';
import Image from 'next/image';
import { Play, Pause, Trash2, GripVertical } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { usePlaylistStore, useCurrentSongPlaylistContext, useCurrentSong } from '@/store/playlist-store';
import type { Playlist, Song } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PlaylistViewProps {
  playlist: Playlist; // This is the playlist being *viewed*
}

export function PlaylistView({ playlist }: PlaylistViewProps) {
  const {
    playSongInPlaylistContext,
    removeSongFromPlaylist,
    isPlaying,
    reorderSongInPlaylist,
    playPlaylist,
    // Get current song from derived state hook
    isShuffling,
    togglePlayPause,
  } = usePlaylistStore((state) => ({
    playSongInPlaylistContext: state.playSongInPlaylistContext,
    removeSongFromPlaylist: state.removeSongFromPlaylist,
    isPlaying: state.isPlaying,
    reorderSongInPlaylist: state.reorderSongInPlaylist,
    playPlaylist: state.playPlaylist,
    isShuffling: state.isShuffling,
    togglePlayPause: state.togglePlayPause,
  }));

   const { toast } = useToast();
   const currentSong = useCurrentSong(); // Get current song derived state
   const currentSongPlaylistContextId = useCurrentSongPlaylistContext();


  const [draggedItemIndex, setDraggedItemIndex] = React.useState<number | null>(null);

  const handlePlayPlaylist = () => {
    // If this playlist is already playing and it's playing, pause it.
    if (currentSongPlaylistContextId === playlist.id && isPlaying) {
        togglePlayPause();
    } else {
        // Otherwise, start playing this playlist (or resume if paused but context matches)
        playPlaylist(playlist.id);
    }
  };

  const handlePlaySong = (song: Song) => {
    // If this song is already playing *from this playlist context*, toggle pause/play
    if (currentSong?.id === song.id && currentSongPlaylistContextId === playlist.id) {
        togglePlayPause();
    } else {
        // Otherwise, play the song within this playlist's context
        playSongInPlaylistContext(song, playlist.id);
    }
  };

  const handleRemoveSong = (songId: string) => {
    removeSongFromPlaylist(playlist.id, songId);
    toast({ title: 'Song Removed', description: 'The song has been removed from the playlist.' });
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    setDraggedItemIndex(index);
    e.currentTarget.classList.add('opacity-50', 'bg-muted');
    e.dataTransfer.effectAllowed = 'move';
    // Set dataTransfer with the index for robustness
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
    // Add visual cue to the row being dragged over
     e.currentTarget.classList.add('bg-accent/10');
  };

   const handleDragLeave = (e: React.DragEvent<HTMLTableRowElement>) => {
      // Remove visual cue when dragging leaves
      e.currentTarget.classList.remove('bg-accent/10');
   };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-accent/10'); // Clean up drop target visual cue

    if (draggedItemIndex === null || draggedItemIndex === dropIndex) {
        // Clean up dragged item style if dropped on itself or drop is invalid
        const draggedElement = document.querySelector(`[data-playlist-id="${playlist.id}"] [data-index="${draggedItemIndex}"]`);
        draggedElement?.classList.remove('opacity-50', 'bg-muted');
        setDraggedItemIndex(null);
        return;
    };

    // Perform the reorder operation
    reorderSongInPlaylist(playlist.id, draggedItemIndex, dropIndex);

    // Clean up the opacity/style of the originally dragged element (might be redundant if React re-renders efficiently)
    // const originalDraggedElement = document.querySelector(`[data-playlist-id="${playlist.id}"] [data-index="${draggedItemIndex}"]`);
    // originalDraggedElement?.classList.remove('opacity-50', 'bg-muted'); // This line might be unnecessary

    setDraggedItemIndex(null); // Reset drag state
  };

  const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
     // Clean up visual cues on all potential drop targets
     document.querySelectorAll(`[data-playlist-id="${playlist.id}"] [data-index]`).forEach(el => {
         el.classList.remove('bg-accent/10', 'opacity-50', 'bg-muted');
     });
    setDraggedItemIndex(null); // Ensure state is reset
  };

  const isCurrentlyPlayingPlaylist = currentSongPlaylistContextId === playlist.id;


  return (
    <div className="mt-8 select-none"> {/* Main container with select-none */}
      {/* Playlist Header */}
      <div className="flex items-center gap-4 mb-6 select-none">
          <h2 className="text-3xl font-bold">{playlist.name}</h2>
          {playlist.songs.length > 0 && (
             <Button
                variant="default"
                size="icon"
                onClick={handlePlayPlaylist}
                className="h-10 w-10 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 active:scale-95 shadow-md"
                aria-label={isCurrentlyPlayingPlaylist && isPlaying ? `Pause playlist ${playlist.name}` : `Play playlist ${playlist.name}${isShuffling ? ' (shuffled)' : ''}`}
             >
                {/* Show Pause if this playlist is the context AND it's playing */}
                {isCurrentlyPlayingPlaylist && isPlaying ? (
                    <Pause className="h-5 w-5 fill-current" />
                ) : (
                    <Play className="h-5 w-5 fill-current" />
                )}
             </Button>
          )}
      </div>

      {/* Playlist Content */}
      {playlist.songs.length === 0 ? (
        <p className="text-muted-foreground select-none">This playlist is empty. Add some songs!</p>
      ) : (
        <Table>
          <TableHeader>
            {/* Header Row - Add select-none */}
            <TableRow className="select-none">
              <TableHead className="w-10"></TableHead>{/* Drag Handle */}
              <TableHead className="w-16"></TableHead>{/* Play/Pause Button */}
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead className="w-16 text-right"></TableHead>{/* Remove Button */}
            </TableRow>
          </TableHeader>
          <TableBody
            // Drag over/leave handlers on the body for better target area
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            data-playlist-id={playlist.id} // ID for robust selectors
          >
            {playlist.songs.map((song, index) => {
              // Determine if this specific song instance is the one currently playing
              const isCurrentPlayingSong = currentSong?.id === song.id && isCurrentlyPlayingPlaylist;
              return (
              <TableRow
                // More robust key using playlist ID, song ID, and index
                key={`${playlist.id}-${song.id}-${index}`}
                data-index={index} // Store index for drag/drop logic
                draggable // Make row draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "group cursor-grab select-none", // Base styles
                   isCurrentPlayingSong && 'bg-accent/10', // Highlight if playing from this context
                   // Remove hover effect during drag to avoid visual conflicts
                   draggedItemIndex === null && 'hover:bg-muted/50',
                )}
              >
                {/* Drag Handle Cell */}
                <TableCell className="py-2 px-2 w-10 align-middle">
                  <GripVertical className="h-5 w-5 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                </TableCell>
                {/* Play/Pause Button Cell */}
                <TableCell className="py-2 px-2 w-16">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                       "h-10 w-10 transition-opacity",
                       // Show always if currently playing, otherwise on hover/focus
                       isCurrentPlayingSong
                         ? 'opacity-100'
                         : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100', // Use focus-within
                     )}
                    onClick={() => handlePlaySong(song)}
                    aria-label={isCurrentPlayingSong && isPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
                  >
                    {isCurrentPlayingSong && isPlaying ? (
                       <Pause className="h-5 w-5 fill-current" />
                    ) : (
                       <Play className="h-5 w-5 fill-current" />
                    )}
                  </Button>
                </TableCell>
                {/* Title & Thumbnail Cell */}
                <TableCell className="py-2">
                    <div className="flex items-center gap-3">
                        <Image
                          src={song.thumbnailUrl || '/placeholder-album.svg'}
                          alt={song.title}
                          width={40}
                          height={40}
                          className="rounded flex-shrink-0 aspect-square object-cover"
                          data-ai-hint="music album cover"
                          onError={(e) => { e.currentTarget.src = '/placeholder-album.svg'; }}
                        />
                        <span className={cn("font-medium truncate", isCurrentPlayingSong && 'text-accent')}>
                            {song.title}
                        </span>
                    </div>
                </TableCell>
                {/* Artist Cell */}
                <TableCell className={cn("py-2 text-muted-foreground truncate", isCurrentPlayingSong && 'text-accent/80')}>
                    {song.author}
                </TableCell>
                {/* Remove Button Cell */}
                <TableCell className="py-2 text-right px-2 w-16">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" // Use focus-within
                    onClick={() => handleRemoveSong(song.id)}
                    aria-label={`Remove ${song.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
           })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
