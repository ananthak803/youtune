// src/components/queue-view.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { Play, Pause, X, GripVertical, ListMusic } from 'lucide-react'; // Import Pause, X, ListMusic
import { Button } from '@/components/ui/button';
import {
    usePlaylistStore,
    useCurrentSong, // Hook for the currently playing song (index 0)
    useUpcomingQueue, // Hook for the upcoming songs (index 1+)
} from '@/store/playlist-store';
import type { QueueSong } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export function QueueView() {
  const currentSong = useCurrentSong(); // The song currently playing (at index 0)
  const upcomingQueue = useUpcomingQueue(); // Songs after index 0

  const {
    isPlaying,
    playFromQueueIndex, // Will internally move song to index 0
    removeSongFromQueue,
    reorderSongInQueue,
    togglePlayPause,
  } = usePlaylistStore((state) => ({
    // queue: state.queue, // No longer need the full queue directly
    // currentQueueIndex: state.currentQueueIndex, // No longer need index, current song is derived
    isPlaying: state.isPlaying,
    playFromQueueIndex: state.playFromQueueIndex,
    removeSongFromQueue: state.removeSongFromQueue,
    reorderSongInQueue: state.reorderSongInQueue,
    togglePlayPause: state.togglePlayPause,
  }));

  const [draggedItemIndex, setDraggedItemIndex] = React.useState<number | null>(null);

  // Handle playing/pausing the *current* song (index 0)
  const handleToggleCurrent = () => {
    togglePlayPause();
  };

  // Handle playing a song from the *upcoming* queue (it will be moved to index 0)
  const handlePlayUpcoming = (upcomingIndex: number) => {
    // The actual index in the full original queue is upcomingIndex + 1
    playFromQueueIndex(upcomingIndex + 1);
  };


  const handleRemoveSong = (queueId: string) => {
    removeSongFromQueue(queueId);
  };

  // Drag and Drop Handlers - Adjust indices because upcomingQueue starts from index 1 of the original queue
   const handleDragStart = (e: React.DragEvent<HTMLDivElement>, upcomingIndex: number) => {
     const originalIndex = upcomingIndex + 1; // Map to original queue index
     setDraggedItemIndex(originalIndex);
     e.currentTarget.classList.add('opacity-50', 'bg-muted/50');
     e.dataTransfer.effectAllowed = 'move';
     e.dataTransfer.setData('text/plain', originalIndex.toString());
   };

   const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
     e.preventDefault();
     e.dataTransfer.dropEffect = 'move';
     const targetElement = e.currentTarget;
     document.querySelectorAll('[data-queue-upcoming-index]').forEach(el => el.classList.remove('bg-accent/20'));
     targetElement.classList.add('bg-accent/20');
   };

   const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.currentTarget.classList.remove('bg-accent/20');
   };


   const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropUpcomingIndex: number) => {
     e.preventDefault();
     e.currentTarget.classList.remove('bg-accent/20'); // Clean up visual cue

     const dropOriginalIndex = dropUpcomingIndex + 1; // Map to original queue index

     if (draggedItemIndex === null || draggedItemIndex === dropOriginalIndex) {
        if (draggedItemIndex !== null) {
         // Find element using original index
         const draggedElement = document.querySelector(`[data-queue-original-index="${draggedItemIndex}"]`);
         draggedElement?.classList.remove('opacity-50', 'bg-muted/50');
        }
        setDraggedItemIndex(null);
        return;
     };

     // Use original indices for reordering
     reorderSongInQueue(draggedItemIndex, dropOriginalIndex);

     // Clean up opacity on the original dragged element after drop
     const draggedElement = document.querySelector(`[data-queue-original-index="${draggedItemIndex}"]`);
     draggedElement?.classList.remove('opacity-50', 'bg-muted/50');

     setDraggedItemIndex(null);
   };

   const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
      document.querySelectorAll('[data-queue-upcoming-index]').forEach(el => el.classList.remove('bg-accent/20'));
     if(draggedItemIndex !== null) {
         const draggedElement = document.querySelector(`[data-queue-original-index="${draggedItemIndex}"]`);
         draggedElement?.classList.remove('opacity-50', 'bg-muted/50');
     }
     setDraggedItemIndex(null);
   };


  if (!currentSong && upcomingQueue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center select-none"> {/* Added select-none */}
         <ListMusic className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm font-medium">Queue is empty</p>
        <p className="text-xs">Add songs or play a playlist to start.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 overflow-y-auto select-none"> {/* Added select-none */}
      <div className="p-4 space-y-2">
        {/* Currently Playing Section */}
        {currentSong && (
            <div className='mb-4 pb-4 border-b select-none'> {/* Added select-none */}
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 px-1">Now Playing</p>
                 <div
                    key={currentSong.queueId + '-now'}
                    className="flex items-center gap-3 p-2 rounded-md bg-accent/10 border border-accent/20"
                  >
                    <div className="w-10 h-10 flex-shrink-0 relative rounded overflow-hidden bg-muted">
                      <Image
                        src={currentSong.thumbnailUrl || '/placeholder-album.svg'}
                        alt={currentSong.title}
                        fill
                        sizes="40px"
                        className="object-cover"
                        data-ai-hint="music album cover"
                        onError={(e) => { e.currentTarget.src = '/placeholder-album.svg'; }}
                      />
                       {/* Play/Pause Overlay */}
                        <button
                         onClick={handleToggleCurrent}
                         className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity rounded"
                         aria-label={isPlaying ? `Pause ${currentSong.title}` : `Play ${currentSong.title}`}
                       >
                         {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                       </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-accent">{currentSong.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{currentSong.author}</p>
                    </div>
                    {/* Remove button for currently playing song */}
                     <Button
                       variant="ghost"
                       size="icon"
                       className="h-7 w-7 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity flex-shrink-0 group"
                       onClick={() => handleRemoveSong(currentSong.queueId)}
                       aria-label={`Remove ${currentSong.title} from queue`}
                     >
                       <X className="h-4 w-4" />
                     </Button>
                  </div>
            </div>
        )}

        {/* Upcoming Queue Section */}
        {upcomingQueue.length > 0 && (
             <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 px-1 select-none"> {/* Added select-none */}
                 Next Up
             </p>
        )}

        {upcomingQueue.map((song, upcomingIndex) => {
          const originalIndex = upcomingIndex + 1; // Original index in the full queue

          return (
            <div
              key={song.queueId}
              data-queue-upcoming-index={upcomingIndex} // Index within the upcoming list
              data-queue-original-index={originalIndex} // Store original index for DnD logic
              draggable={originalIndex > 0} // Only allow dragging upcoming songs
              onDragStart={(e) => handleDragStart(e, upcomingIndex)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, upcomingIndex)}
              onDragEnd={handleDragEnd}
              className={cn(
                "group flex items-center gap-3 p-2 rounded-md cursor-grab transition-colors duration-150 select-none",
                "hover:bg-muted/50"
              )}
            >
              {/* Drag Handle */}
              <GripVertical className="h-5 w-5 text-muted-foreground/50 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity cursor-grab" />

              {/* Image & Play Button */}
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
                {/* Play Button Overlay */}
                 <button
                  onClick={() => handlePlayUpcoming(upcomingIndex)}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded"
                  aria-label={`Play ${song.title} next`}
                >
                  <Play className="h-5 w-5 fill-current" />
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
