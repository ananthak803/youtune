'use client';

import React from 'react';
import Image from 'next/image';
import { Play, Trash2, GripVertical } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { usePlaylistStore } from '@/store/playlist-store';
import type { Playlist, Song } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PlaylistViewProps {
  playlist: Playlist;
}

export function PlaylistView({ playlist }: PlaylistViewProps) {
  const {
    playSong,
    removeSongFromPlaylist,
    currentSong,
    isPlaying,
    reorderSongInPlaylist,
  } = usePlaylistStore((state) => ({
    playSong: state.playSong,
    removeSongFromPlaylist: state.removeSongFromPlaylist,
    currentSong: state.currentSong,
    isPlaying: state.isPlaying,
    reorderSongInPlaylist: state.reorderSongInPlaylist,
  }));

  const [draggedItemIndex, setDraggedItemIndex] = React.useState<number | null>(null);

  const handlePlaySong = (song: Song) => {
    playSong(song, playlist.id);
  };

  const handleRemoveSong = (songId: string) => {
    removeSongFromPlaylist(playlist.id, songId);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    setDraggedItemIndex(index);
    // Optional: Add a class for visual feedback during drag
    e.currentTarget.classList.add('opacity-50', 'bg-muted');
     // Set dataTransfer - necessary for Firefox
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === dropIndex) {
        if (draggedItemIndex !== null) {
         const draggedElement = document.querySelector(`[data-index="${draggedItemIndex}"]`);
         draggedElement?.classList.remove('opacity-50', 'bg-muted');
        }
        setDraggedItemIndex(null);
        return;
    };


    reorderSongInPlaylist(playlist.id, draggedItemIndex, dropIndex);

    // Clean up visual feedback class
    const draggedElement = document.querySelector(`[data-index="${draggedItemIndex}"]`);
    draggedElement?.classList.remove('opacity-50', 'bg-muted');

    setDraggedItemIndex(null);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
     // Clean up visual feedback class if drag is cancelled or ends outside a valid target
    if(draggedItemIndex !== null) {
        e.currentTarget.classList.remove('opacity-50', 'bg-muted');
    }
    setDraggedItemIndex(null);
  };


  return (
    <div className="mt-8">
      <h2 className="text-3xl font-bold mb-6">{playlist.name}</h2>
      {playlist.songs.length === 0 ? (
        <p className="text-muted-foreground">This playlist is empty. Add some songs!</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead> {/* Drag Handle */}
              <TableHead className="w-16"></TableHead> {/* Play Button */}
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead className="w-16 text-right"></TableHead> {/* Remove Button */}
            </TableRow>
          </TableHeader>
          <TableBody
            onDragOver={handleDragOver} // Apply drag over to the body to detect dropping between rows
          >
            {playlist.songs.map((song, index) => (
              <TableRow
                key={song.id}
                data-index={index}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "group cursor-grab",
                   currentSong?.id === song.id && 'bg-accent/10',
                   'hover:bg-muted/50' // Ensure hover style remains consistent
                )}
              >
                <TableCell className="py-2 px-2 w-10 align-middle">
                    <GripVertical className="h-5 w-5 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                </TableCell>
                <TableCell className="py-2 px-2 w-16">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    onClick={() => handlePlaySong(song)}
                    aria-label={`Play ${song.title}`}
                  >
                    <Play className="h-5 w-5 fill-current" />
                  </Button>
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-3">
                    <Image
                      src={song.thumbnailUrl || '/placeholder-album.svg'}
                      alt={song.title}
                      width={40}
                      height={40}
                      className="rounded"
                      data-ai-hint="music album cover"
                      onError={(e) => { e.currentTarget.src = '/placeholder-album.svg'; }}
                    />
                    <span className={cn("font-medium truncate", currentSong?.id === song.id && 'text-accent')}>{song.title}</span>
                  </div>
                </TableCell>
                <TableCell className={cn("py-2 text-muted-foreground truncate", currentSong?.id === song.id && 'text-accent/80')}>
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
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
