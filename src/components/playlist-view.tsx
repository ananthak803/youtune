
'use client';

import React from 'react';
import Image from 'next/image';
import { Play, Pause, Trash2, GripVertical } from 'lucide-react'; // Import Pause
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { usePlaylistStore, useCurrentSongPlaylistContext } from '@/store/playlist-store';
import type { Playlist, Song } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast'; // Import toast

interface PlaylistViewProps {
  playlist: Playlist; // This is the playlist being *viewed*
}

export function PlaylistView({ playlist }: PlaylistViewProps) {
  const {
    playSongInPlaylistContext, // Corrected function name
    removeSongFromPlaylist,
    isPlaying,
    reorderSongInPlaylist,
    playPlaylist,
    currentQueueIndex, // Get index to derive current song
    queue, // Get queue to derive current song
    isShuffling,
    togglePlayPause, // Get toggle function
  } = usePlaylistStore((state) => ({
    playSongInPlaylistContext: state.playSongInPlaylistContext, // Corrected selector
    removeSongFromPlaylist: state.removeSongFromPlaylist,
    isPlaying: state.isPlaying,
    reorderSongInPlaylist: state.reorderSongInPlaylist,
    playPlaylist: state.playPlaylist,
    currentQueueIndex: state.currentQueueIndex,
    queue: state.queue,
    isShuffling: state.isShuffling,
    togglePlayPause: state.togglePlayPause, // Get toggle
  }));

   const { toast } = useToast(); // Use the toast hook

  const currentSong = queue[currentQueueIndex] ?? null;
  const currentSongPlaylistContextId = useCurrentSongPlaylistContext(); // Correct hook usage


  const [draggedItemIndex, setDraggedItemIndex] = React.useState<number | null>(null);

  const handlePlayPlaylist = () => {
    // If this playlist is already playing, toggle pause/play
    if (currentSongPlaylistContextId === playlist.id && isPlaying) {
        togglePlayPause();
    } else {
        playPlaylist(playlist.id); // Otherwise, start playing this playlist
    }
  };

  const handlePlaySong = (song: Song) => {
    // If this song is already playing *from this playlist context*, toggle pause/play
    if (currentSong?.id === song.id && currentSongPlaylistContextId === playlist.id) {
        togglePlayPause();
    } else {
        playSongInPlaylistContext(song, playlist.id); // Otherwise, play the song in this playlist's context
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
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Optional: Add visual cue for drop target
    // e.currentTarget.classList.add('bg-accent/20');
  };

   // Optional: Remove visual cue when dragging leaves a potential drop target
  // const handleDragLeave = (e: React.DragEvent<HTMLTableRowElement>) => {
  //    e.currentTarget.classList.remove('bg-accent/20');
  // };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) => {
    e.preventDefault();
    // e.currentTarget.classList.remove('bg-accent/20'); // Clean up visual cue

    if (draggedItemIndex === null || draggedItemIndex === dropIndex) {
        if (draggedItemIndex !== null) {
         const draggedElement = document.querySelector(`[data-playlist-id="${playlist.id}"] [data-index="${draggedItemIndex}"]`);
         draggedElement?.classList.remove('opacity-50', 'bg-muted');
        }
        setDraggedItemIndex(null);
        return;
    };

    reorderSongInPlaylist(playlist.id, draggedItemIndex, dropIndex);

    const draggedElement = document.querySelector(`[data-playlist-id="${playlist.id}"] [data-index="${draggedItemIndex}"]`);
    draggedElement?.classList.remove('opacity-50', 'bg-muted');

    setDraggedItemIndex(null);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
     // e.currentTarget.classList.remove('bg-accent/20'); // Clean up visual cue
    if(draggedItemIndex !== null) {
        // Ensure correct element removal
        const draggedElement = document.querySelector(`[data-playlist-id="${playlist.id}"] [data-index="${draggedItemIndex}"]`);
        draggedElement?.classList.remove('opacity-50', 'bg-muted');
    }
    setDraggedItemIndex(null);
  };

  const isCurrentlyPlayingPlaylist = currentSongPlaylistContextId === playlist.id;


  return ( // Ensure this return statement wraps the main JSX
    <div className="mt-8">
      <div className="flex items-center gap-4 mb-6 select-none"> {/* Added select-none */}
          <h2 className="text-3xl font-bold">{playlist.name}</h2>
          {playlist.songs.length > 0 && (
             <Button
                variant="default"
                size="icon"
                onClick={handlePlayPlaylist}
                className="h-10 w-10 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
                aria-label={isCurrentlyPlayingPlaylist && isPlaying ? `Pause playlist ${playlist.name}` : `Play playlist ${playlist.name}${isShuffling ? ' (shuffled)' : ''}`}
             >
                {/* Show Pause if this playlist is the one playing AND it's currently playing */}
                {isCurrentlyPlayingPlaylist && isPlaying ? (
                    <Pause className="h-5 w-5 fill-current" />
                ) : (
                    <Play className="h-5 w-5 fill-current" />
                )}
             </Button>
          )}
      </div>
      {playlist.songs.length === 0 ? (
        <p className="text-muted-foreground select-none">This playlist is empty. Add some songs!</p> // Added select-none
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="select-none"> {/* Added select-none */}
              <TableHead className="w-10"></TableHead>{/* Drag Handle */}
              <TableHead className="w-16"></TableHead>{/* Play/Pause Button */}
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead className="w-16 text-right"></TableHead>{/* Remove Button */}
            </TableRow>
          </TableHeader>
          <TableBody
            onDragOver={handleDragOver}
            // onDragLeave={handleDragLeave} // Optional visual cue handling
            data-playlist-id={playlist.id} // Add playlist id for selector robustness
          >
            {playlist.songs.map((song, index) => {
              const isCurrentPlayingSong = currentSong?.id === song.id && isCurrentlyPlayingPlaylist;
              return (
              <TableRow
                key={`${playlist.id}-${song.id}-${index}`} // More robust key for potential duplicates across playlists
                data-index={index}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "group cursor-grab select-none", // Added select-none
                   isCurrentPlayingSong && 'bg-accent/10', // Highlight only if playing from this playlist context
                   'hover:bg-muted/50'
                )}
              >
                <TableCell className="py-2 px-2 w-10 align-middle">
                  <GripVertical className="h-5 w-5 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                </TableCell>
                <TableCell className="py-2 px-2 w-16">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                       "h-10 w-10 transition-opacity",
                       // Show always if it's the currently playing song from this playlist, otherwise on hover/focus
                       isCurrentPlayingSong
                         ? 'opacity-100'
                         : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
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
                <TableCell className="py-2">
                    <div className="flex items-center gap-3">
                        <Image
                          src={song.thumbnailUrl || '/placeholder-album.svg'}
                          alt={song.title}
                          width={40}
                          height={40}
                          className="rounded flex-shrink-0" // Prevent image shrink
                          data-ai-hint="music album cover"
                          onError={(e) => { e.currentTarget.src = '/placeholder-album.svg'; }}
                        />
                        <span className={cn("font-medium truncate", isCurrentPlayingSong && 'text-accent')}>
                            {song.title}
                        </span>
                    </div>
                </TableCell>
                <TableCell className={cn("py-2 text-muted-foreground truncate", isCurrentPlayingSong && 'text-accent/80')}>
                    {song.author}
                </TableCell>
                <TableCell className="py-2 text-right px-2 w-16">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
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
