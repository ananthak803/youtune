// src/components/queue-view.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { Play, Pause, X, GripVertical, ListMusic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    usePlaylistStore,
    useCurrentSong,
    useUpcomingQueue,
} from '@/store/playlist-store';
import type { QueueSong } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export function QueueView() {
  const currentSong = useCurrentSong();
  const upcomingQueue = useUpcomingQueue();

  const {
    isPlaying,
    playFromQueueIndex,
    removeSongFromQueue,
    reorderSongInQueue,
    togglePlayPause,
  } = usePlaylistStore((state) => ({
    isPlaying: state.isPlaying,
    playFromQueueIndex: state.playFromQueueIndex,
    removeSongFromQueue: state.removeSongFromQueue,
    reorderSongInQueue: state.reorderSongInQueue,
    togglePlayPause: state.togglePlayPause,
  }));

  const [draggedItemIndex, setDraggedItemIndex] = React.useState<number | null>(null);

  // Toggle play/pause for the current song
  const handleToggleCurrent = () => {
    togglePlayPause();
  };

  // Play a song from the upcoming queue (moves it to index 0)
  const handlePlayUpcoming = (upcomingIndex: number) => {
    // Index in the original full queue is upcomingIndex + 1
    playFromQueueIndex(upcomingIndex + 1);
  };

  // Remove song by its unique queueId
  const handleRemoveSong = (queueId: string) => {
    removeSongFromQueue(queueId);
  };

  // Drag and Drop Handlers (adjust indices for upcomingQueue)
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
     // Clear previous highlight and highlight current target
     document.querySelectorAll('[data-queue-upcoming-index]').forEach(el => el.classList.remove('bg-accent/10'));
     targetElement.classList.add('bg-accent/10');
   };

   const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.currentTarget.classList.remove('bg-accent/10'); // Remove highlight on leave
   };


   const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropUpcomingIndex: number) => {
     e.preventDefault();
     e.currentTarget.classList.remove('bg-accent/10'); // Clean up visual cue

     const dropOriginalIndex = dropUpcomingIndex + 1; // Map to original queue index

     if (draggedItemIndex === null || draggedItemIndex === dropOriginalIndex) {
        // Clean up dragged item style if dropped on itself or invalid drop
        const draggedElement = document.querySelector(`[data-queue-original-index="${draggedItemIndex}"]`);
        draggedElement?.classList.remove('opacity-50', 'bg-muted/50');
        setDraggedItemIndex(null);
        return;
     };

     // Use original indices for reordering action
     reorderSongInQueue(draggedItemIndex, dropOriginalIndex);

     // Clean up style of the original dragged element (might be redundant)
     const draggedElement = document.querySelector(`[data-queue-original-index="${draggedItemIndex}"]`);
     draggedElement?.classList.remove('opacity-50', 'bg-muted/50');

     setDraggedItemIndex(null);
   };

   const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
      // Clear all potential visual cues
      document.querySelectorAll('[data-queue-upcoming-index]').forEach(el => el.classList.remove('bg-accent/10'));
     // Clean up style of the dragged element if drag ended unexpectedly
     if(draggedItemIndex !== null) {
         const draggedElement = document.querySelector(`[data-queue-original-index="${draggedItemIndex}"]`);
         draggedElement?.classList.remove('opacity-50', 'bg-muted/50');
     }
     setDraggedItemIndex(null);
   };


  // Display when queue is empty
  if (!currentSong && upcomingQueue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center select-none">
         <ListMusic className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm font-medium">Queue is empty</p>
        <p className="text-xs">Add songs or play a playlist to start.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 overflow-y-auto select-none">
      <div className="p-4 space-y-2">
        {/* Currently Playing Section */}
        {currentSong && (
            <div className='mb-4 pb-4 border-b select-none'>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 px-1">Now Playing</p>
                 <div
                    key={currentSong.queueId + '-now'} // Unique key
                    className="flex items-center gap-3 p-2 rounded-md bg-accent/10 border border-accent/20"
                  >
                    {/* Image with Play/Pause Overlay */}
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
                       <button
                         onClick={handleToggleCurrent}
                         className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity rounded"
                         aria-label={isPlaying ? `Pause ${currentSong.title}` : `Play ${currentSong.title}`}
                       >
                         {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                       </button>
                    </div>
                    {/* Text Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-accent">{currentSong.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{currentSong.author}</p>
                    </div>
                    {/* Remove button (disabled for currently playing) */}
                     <Button
                       variant="ghost"
                       size="icon"
                       className="h-7 w-7 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity flex-shrink-0 group disabled:opacity-30 disabled:cursor-not-allowed"
                       // onClick={() => handleRemoveSong(currentSong.queueId)} // Removing current song is handled by playNext
                       aria-label={`Remove ${currentSong.title} from queue (use skip)`}
                       disabled // Disable remove for currently playing
                     >
                       <X className="h-4 w-4" />
                     </Button>
                  </div>
            </div>
        )}

        {/* Upcoming Queue Section */}
        {upcomingQueue.length > 0 && (
             <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 px-1 select-none">
                 Next Up
             </p>
        )}

        {/* Map through upcoming songs */}
        {upcomingQueue.map((song, upcomingIndex) => {
          const originalIndex = upcomingIndex + 1; // Original index in the full queue

          return (
            <div
              key={song.queueId} // Use unique queueId
              data-queue-upcoming-index={upcomingIndex}
              data-queue-original-index={originalIndex} // For DnD logic
              draggable={originalIndex > 0} // Only upcoming songs are draggable
              onDragStart={(e) => handleDragStart(e, upcomingIndex)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, upcomingIndex)}
              onDragEnd={handleDragEnd}
              className={cn(
                "group flex items-center gap-3 p-2 rounded-md cursor-grab transition-colors duration-150 select-none",
                "hover:bg-muted/50" // Hover effect
              )}
            >
              {/* Drag Handle */}
              <GripVertical className="h-5 w-5 text-muted-foreground/50 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity cursor-grab" />

              {/* Image & Play Button Overlay */}
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
