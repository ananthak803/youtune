
// src/components/queue-view.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { Play, Pause, Trash2, GripVertical, X } from 'lucide-react'; // Import Pause, X
import { Button } from '@/components/ui/button';
import { usePlaylistStore } from '@/store/playlist-store';
import type { QueueSong } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export function QueueView() {
  const {
    queue,
    currentQueueIndex,
    isPlaying,
    playFromQueueIndex,
    removeSongFromQueue,
    reorderSongInQueue,
    togglePlayPause,
  } = usePlaylistStore((state) => ({
    queue: state.queue,
    currentQueueIndex: state.currentQueueIndex,
    isPlaying: state.isPlaying,
    playFromQueueIndex: state.playFromQueueIndex,
    removeSongFromQueue: state.removeSongFromQueue,
    reorderSongInQueue: state.reorderSongInQueue,
    togglePlayPause: state.togglePlayPause,
  }));

  const [draggedItemIndex, setDraggedItemIndex] = React.useState<number | null>(null);

  const handlePlayPauseSong = (index: number) => {
    if (index === currentQueueIndex) {
      togglePlayPause();
    } else {
      playFromQueueIndex(index);
    }
  };

  const handleRemoveSong = (queueId: string) => {
    removeSongFromQueue(queueId);
  };

  // Drag and Drop Handlers
   const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
     setDraggedItemIndex(index);
     e.currentTarget.classList.add('opacity-50', 'bg-muted/50');
     e.dataTransfer.effectAllowed = 'move';
     e.dataTransfer.setData('text/plain', index.toString());
   };

   const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
     e.preventDefault();
     e.dataTransfer.dropEffect = 'move';
     // Optional: Add visual cue for drop target
     const targetElement = e.currentTarget;
     // Add a class to the drop target, remove from others
     document.querySelectorAll('[data-queue-index]').forEach(el => el.classList.remove('bg-accent/20'));
     targetElement.classList.add('bg-accent/20');
   };

   const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.currentTarget.classList.remove('bg-accent/20');
   };


   const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
     e.preventDefault();
     e.currentTarget.classList.remove('bg-accent/20'); // Clean up visual cue

     if (draggedItemIndex === null || draggedItemIndex === dropIndex) {
        if (draggedItemIndex !== null) {
         const draggedElement = document.querySelector(`[data-queue-index="${draggedItemIndex}"]`);
         draggedElement?.classList.remove('opacity-50', 'bg-muted/50');
        }
        setDraggedItemIndex(null);
        return;
     };

     reorderSongInQueue(draggedItemIndex, dropIndex);

     // Clean up opacity on the original dragged element after drop
     const draggedElement = document.querySelector(`[data-queue-index="${draggedItemIndex}"]`);
     draggedElement?.classList.remove('opacity-50', 'bg-muted/50');

     setDraggedItemIndex(null);
   };

   const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
      document.querySelectorAll('[data-queue-index]').forEach(el => el.classList.remove('bg-accent/20'));
     if(draggedItemIndex !== null) {
         const draggedElement = document.querySelector(`[data-queue-index="${draggedItemIndex}"]`);
         draggedElement?.classList.remove('opacity-50', 'bg-muted/50');
     }
     setDraggedItemIndex(null);
   };


  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
         <ListMusic className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm font-medium">Queue is empty</p>
        <p className="text-xs">Add songs or play a playlist to start.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-2">
        {/* Optional: Add a "Currently Playing" section */}
        {currentQueueIndex !== -1 && queue[currentQueueIndex] && (
            <div className='mb-4 pb-4 border-b'>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 px-1">Now Playing</p>
                 <div
                    key={queue[currentQueueIndex].queueId + '-now'}
                    className="flex items-center gap-3 p-2 rounded-md bg-accent/10 border border-accent/20"
                  >
                    <div className="w-10 h-10 flex-shrink-0 relative rounded overflow-hidden bg-muted">
                      <Image
                        src={queue[currentQueueIndex].thumbnailUrl || '/placeholder-album.svg'}
                        alt={queue[currentQueueIndex].title}
                        fill
                        sizes="40px"
                        className="object-cover"
                        data-ai-hint="music album cover"
                        onError={(e) => { e.currentTarget.src = '/placeholder-album.svg'; }}
                      />
                       {/* Play/Pause Overlay */}
                        <button
                         onClick={() => handlePlayPauseSong(currentQueueIndex)}
                         className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity rounded"
                         aria-label={isPlaying ? `Pause ${queue[currentQueueIndex].title}` : `Play ${queue[currentQueueIndex].title}`}
                       >
                         {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                       </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-accent">{queue[currentQueueIndex].title}</p>
                      <p className="text-xs text-muted-foreground truncate">{queue[currentQueueIndex].author}</p>
                    </div>
                  </div>
            </div>
        )}

        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 px-1">
            {currentQueueIndex !== -1 && queue.length > 1 ? 'Next Up' : 'Queue'}
        </p>

        {queue.map((song, index) => {
           // Skip rendering the current song again if it was shown in "Now Playing"
          if (index === currentQueueIndex) return null;

          const isCurrentPlayingSong = index === currentQueueIndex; // Though we skipped above, keep logic for potential reuse

          return (
            <div
              key={song.queueId}
              data-queue-index={index}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver} // Use onDragOver on the container div
              onDragLeave={handleDragLeave} // Optional
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "group flex items-center gap-3 p-2 rounded-md cursor-grab transition-colors duration-150", // Added transition
                "hover:bg-muted/50"
              )}
            >
              {/* Drag Handle */}
              <GripVertical className="h-5 w-5 text-muted-foreground/50 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />

              {/* Image & Play/Pause */}
              <div className="w-10 h-10 flex-shrink-0 relative rounded overflow-hidden bg-muted">
                <Image
                  src={song.thumbnailUrl || '/placeholder-album.svg'}
                  alt={song.title}
                  fill
                  sizes="40px"
                  className="object-cover"
                  data-ai-hint="music album cover"
                  onError={(e) => { e.currentTarget.src = '/placeholder-album.svg'; }}
                />
                {/* Play/Pause Overlay */}
                 <button
                  onClick={() => handlePlayPauseSong(index)}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded"
                  aria-label={isCurrentPlayingSong && isPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
                >
                  {isCurrentPlayingSong && isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                </button>
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{song.title}</p>
                <p className="text-xs text-muted-foreground truncate">{song.author}</p>
              </div>

              {/* Remove Button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex-shrink-0"
                onClick={() => handleRemoveSong(song.queueId)}
                aria-label={`Remove ${song.title} from queue`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// Placeholder for ListMusic icon if needed elsewhere, adjust imports as necessary
import { ListMusic } from 'lucide-react';
