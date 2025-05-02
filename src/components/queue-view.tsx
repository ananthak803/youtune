
// src/components/queue-view.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { Play, Pause, Trash2, GripVertical, Music } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePlaylistStore } from '@/store/playlist-store';
import type { QueueSong } from '@/lib/types';
import { cn } from '@/lib/utils';

export function QueueView() {
  const {
    queue,
    currentSong,
    isPlaying,
    playSongFromQueue,
    removeSongFromQueue,
    reorderSongInQueue,
    togglePlayPause,
  } = usePlaylistStore((state) => ({
    queue: state.queue,
    currentSong: state.currentSong,
    isPlaying: state.isPlaying,
    playSongFromQueue: state.playSongFromQueue,
    removeSongFromQueue: state.removeSongFromQueue,
    reorderSongInQueue: state.reorderSongInQueue,
    togglePlayPause: state.togglePlayPause,
  }));

  const [draggedItemIndex, setDraggedItemIndex] = React.useState<number | null>(null);

  const handlePlaySong = (song: QueueSong, index: number) => {
    if (currentSong?.id === song.id) { // Simplified check: if it's the current song, toggle
      togglePlayPause();
    } else {
      playSongFromQueue(index);
    }
  };

  const handleRemoveSong = (queueId: string) => {
    removeSongFromQueue(queueId);
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
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) => {
    e.preventDefault();

    if (draggedItemIndex === null || draggedItemIndex === dropIndex) {
      if (draggedItemIndex !== null) {
        const draggedElement = document.querySelector(`[data-queue-index="${draggedItemIndex}"]`);
        draggedElement?.classList.remove('opacity-50', 'bg-muted');
      }
      setDraggedItemIndex(null);
      return;
    }

    reorderSongInQueue(draggedItemIndex, dropIndex);

    const draggedElement = document.querySelector(`[data-queue-index="${draggedItemIndex}"]`);
    draggedElement?.classList.remove('opacity-50', 'bg-muted');

    setDraggedItemIndex(null);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
    if (draggedItemIndex !== null) {
      const draggedElement = document.querySelector(`[data-queue-index="${draggedItemIndex}"]`);
      draggedElement?.classList.remove('opacity-50', 'bg-muted');
    }
    setDraggedItemIndex(null);
  };

  const currentSongIndexInQueue = queue.findIndex(qSong => qSong.id === currentSong?.id);

  return (
    <ScrollArea className="flex-1 px-4 sm:px-6"> {/* Add padding to ScrollArea */}
      {queue.length === 0 ? (
        <div className="flex h-full items-center justify-center text-muted-foreground text-center">
          <p className="text-sm">The queue is empty.</p>
        </div>
      ) : (
        <Table>
          {/* Optional: Add TableHeader if desired for queue view */}
          {/* <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="w-16"></TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead className="w-16 text-right"></TableHead>
            </TableRow>
          </TableHeader> */}
          <TableBody
            onDragOver={handleDragOver}
          >
            {queue.map((song, index) => {
              const isCurrentPlayingSong = currentSong?.id === song.id; // Check only by song ID
              return (
                <TableRow
                  key={song.queueId} // Use unique queueId for keys
                  data-queue-index={index}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "group cursor-grab h-16", // Fixed height for consistency
                    isCurrentPlayingSong && 'bg-accent/10',
                    'hover:bg-muted/50'
                  )}
                >
                  {/* Drag Handle */}
                  <TableCell className="py-1 px-2 w-10 align-middle">
                    <GripVertical className="h-5 w-5 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                  </TableCell>
                  {/* Play/Pause Button */}
                  <TableCell className="py-1 px-1 w-16">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-10 w-10 transition-opacity",
                        isCurrentPlayingSong
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                      )}
                      onClick={() => handlePlaySong(song, index)}
                      aria-label={isCurrentPlayingSong && isPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
                    >
                      {isCurrentPlayingSong && isPlaying ? (
                        <Pause className="h-5 w-5 fill-current" />
                      ) : (
                        <Play className="h-5 w-5 fill-current" />
                      )}
                    </Button>
                  </TableCell>
                  {/* Song Info */}
                  <TableCell className="py-1 px-2 min-w-0"> {/* Allow shrinking */}
                    <div className="flex items-center gap-3">
                        {/* Image Container */}
                       <div className="w-10 h-10 flex-shrink-0 relative rounded overflow-hidden bg-muted">
                           <Image
                               src={song.thumbnailUrl || '/placeholder-album.svg'}
                               alt={song.title}
                               fill
                               sizes="40px" // Specify size hint
                               className="object-cover"
                               data-ai-hint="music album cover"
                               onError={(e) => {
                                 // Simple fallback: hide image, show icon
                                 e.currentTarget.style.display = 'none';
                                 const parent = e.currentTarget.parentElement;
                                 if (parent && !parent.querySelector('.placeholder-icon')) {
                                    const iconContainer = document.createElement('div');
                                    iconContainer.className = 'placeholder-icon absolute inset-0 flex items-center justify-center text-muted-foreground';
                                    iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-music h-5 w-5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
                                    parent.appendChild(iconContainer);
                                 }
                               }}
                            />
                             {/* Fallback Icon Structure */}
                             {/* <div className="placeholder-icon absolute inset-0 flex items-center justify-center text-muted-foreground" style={{ display: 'none' }}>
                                <Music className="h-5 w-5" />
                             </div> */}
                       </div>
                       {/* Text */}
                       <div className="flex-1 min-w-0">
                         <span className={cn("font-medium truncate text-sm", isCurrentPlayingSong && 'text-accent')}>
                           {song.title}
                         </span>
                         <p className={cn("text-xs text-muted-foreground truncate", isCurrentPlayingSong && 'text-accent/80')}>
                           {song.author}
                         </p>
                       </div>
                    </div>
                  </TableCell>
                  {/* Remove Button */}
                  <TableCell className="py-1 text-right px-2 w-16">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      onClick={() => handleRemoveSong(song.queueId)}
                      aria-label={`Remove ${song.title} from queue`}
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
    </ScrollArea>
  );
}

