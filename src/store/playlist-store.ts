// src/store/playlist-store.ts
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Playlist, Song, QueueSong } from '@/lib/types';
import type ReactPlayer from 'react-player'; // Import type for playerRef
import { toast } from '@/hooks/use-toast'; // Correct import for toast

interface PlaylistState {
  playlists: Playlist[];
  activePlaylistId: string | null; // ID of the playlist being *viewed*
  queue: QueueSong[]; // The actual playback queue (index 0 is always the current song)
  currentQueueIndex: number; // Should always be 0 or -1 if queue is empty
  isShuffling: boolean;
  isLooping: boolean; // Loop the current song
  isLoopingPlaylist: boolean; // Loop the entire playlist/queue
  volume: number;
  isMuted: boolean;
  currentSongProgress: number;
  currentSongDuration: number;
  isPlaying: boolean; // Reflects player state

  // Playlist context tracking for repopulating queue on loop/shuffle
  currentPlaylistContextId: string | null; // ID of the playlist the current queue is based on
  currentPlaylistContextStartIndex: number; // Original start index (less relevant now, but kept for consistency)

  // Actions
  createPlaylist: (name: string) => void;
  deletePlaylist: (playlistId: string) => void;
  renamePlaylist: (playlistId: string, newName: string) => void;
  addSongToPlaylist: (playlistId: string, song: Song) => boolean; // Return true if added, false if duplicate
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  reorderSongInPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void;
  setActivePlaylistId: (playlistId: string | null) => void; // Only sets the *viewed* playlist ID

  // Queue & Playback Actions
  playPlaylist: (playlistId: string, startIndex?: number) => void; // Plays playlist, adds to queue
  playSongInPlaylistContext: (song: Song, playlistId: string) => void; // Plays song, sets playlist context in queue
  playSingleSong: (song: Song) => void; // Plays song directly, clears queue
  playNextSong: () => void;
  playPreviousSong: () => void;
  togglePlayPause: () => void;
  toggleShuffle: () => void;
  toggleLoop: () => void; // Toggles single song loop
  toggleLoopPlaylist: () => void; // Toggles queue/playlist loop
  setCurrentSongProgress: (progress: number) => void;
  setCurrentSongDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  clearQueue: () => void;
  removeSongFromQueue: (queueId: string) => void;
  reorderSongInQueue: (fromIndex: number, toIndex: number) => void;
  playFromQueueIndex: (index: number) => void;

  // Internal helper (not directly exposed but used by actions)
  _generateQueueId: () => string; // Helper to create unique queue item IDs
  _buildQueueFromPlaylist: (playlist: Playlist, startIndex: number, shuffle: boolean, currentQueueIdToKeep?: string) => QueueSong[]; // Helper to build queue
}

const generateId = () => Math.random().toString(36).substring(2, 15);

// Helper function to shuffle an array (Fisher-Yates)
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};


export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set, get) => ({
      playlists: [],
      activePlaylistId: null, // The playlist currently being *viewed*
      queue: [],
      currentQueueIndex: -1, // Should always be 0 when playing, -1 when stopped/empty
      isPlaying: false,
      isShuffling: false,
      isLooping: false,
      isLoopingPlaylist: false,
      volume: 0.8, // Default volume
      isMuted: false,
      currentSongProgress: 0,
      currentSongDuration: 0,
      currentPlaylistContextId: null,
      currentPlaylistContextStartIndex: 0,


      _generateQueueId: () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,

       // --- Playlist Management ---
       createPlaylist: (name) =>
         set((state) => {
           console.log('[Store] createPlaylist triggered with name:', name);
           const newPlaylist: Playlist = {
             id: generateId(),
             name,
             songs: [],
           };
           const updatedPlaylists = [...state.playlists, newPlaylist];
           const newStateUpdate: Partial<PlaylistState> = { playlists: updatedPlaylists };
           // Select the first playlist if none is selected or if it's the only one
           if (state.activePlaylistId === null || updatedPlaylists.length === 1) {
               newStateUpdate.activePlaylistId = newPlaylist.id;
               console.log('[Store] Setting new active playlist ID:', newPlaylist.id);
           }
           console.log('[Store] createPlaylist finished. New state:', newStateUpdate);
           return newStateUpdate;
         }),

      deletePlaylist: (playlistId) =>
         set((state) => {
           console.log('[Store] deletePlaylist triggered for ID:', playlistId);
           const updatedPlaylists = state.playlists.filter((p) => p.id !== playlistId);
           let newActivePlaylistId = state.activePlaylistId;
           let newQueue = [...state.queue]; // Clone queue
           let newCurrentQueueIndex = state.currentQueueIndex;
           let newIsPlaying = state.isPlaying;
           let newContextId = state.currentPlaylistContextId;

           // If the deleted playlist was the one being *viewed*
           if (state.activePlaylistId === playlistId) {
             newActivePlaylistId = updatedPlaylists[0]?.id ?? null;
              console.log('[Store] Deleted active playlist. New active playlist ID:', newActivePlaylistId);
           }

           // If the deleted playlist was the context for the current queue
           if (state.currentPlaylistContextId === playlistId) {
               console.log('[Store] Deleted playlist was the current playback context. Clearing queue and stopping.');
               newQueue = [];
               newCurrentQueueIndex = -1;
               newIsPlaying = false;
               newContextId = null;
           } else {
               // Check if any song in the queue has the deleted playlist as context (less relevant now)
               const initialQueueLength = newQueue.length;
               newQueue = newQueue.filter(qSong => qSong.playlistContextId !== playlistId);

               if (newQueue.length < initialQueueLength) {
                   console.log(`[Store] Removed ${initialQueueLength - newQueue.length} songs from queue belonging to deleted playlist context ${playlistId}.`);
                    // If the current song was removed (which shouldn't happen unless context was wrong)
                    const currentSongStillExists = newQueue.some(qSong => qSong.queueId === state.queue[state.currentQueueIndex]?.queueId);
                    if (!currentSongStillExists && state.currentQueueIndex !== -1) {
                        console.log('[Store] Currently playing song was removed due to playlist context deletion.');
                        if (newQueue.length > 0) {
                            newCurrentQueueIndex = 0; // Play the new first song
                            console.log(`[Store] Moving to new queue index ${newCurrentQueueIndex}.`);
                        } else {
                            newCurrentQueueIndex = -1;
                            newIsPlaying = false;
                            newContextId = null;
                            console.log('[Store] Queue became empty after playlist deletion.');
                        }
                    } else if (newQueue.length > 0) {
                         newCurrentQueueIndex = 0; // Current song is always at 0 if queue is not empty
                         console.log('[Store] Queue adjusted after deleting context. Current index is 0.');
                    } else {
                        newCurrentQueueIndex = -1;
                        newIsPlaying = false;
                        newContextId = null;
                         console.log('[Store] Queue became empty after deleting context.');
                    }
               }
           }


           const finalState = {
              playlists: updatedPlaylists,
              activePlaylistId: newActivePlaylistId,
              queue: newQueue,
              currentQueueIndex: newCurrentQueueIndex,
              isPlaying: newIsPlaying,
              currentSongProgress: newIsPlaying ? state.currentSongProgress : 0, // Reset progress if stopped
              currentSongDuration: newIsPlaying ? state.currentSongDuration : 0, // Reset duration if stopped
              currentPlaylistContextId: newContextId,
            };
            console.log('[Store] deletePlaylist finished. New state:', finalState);
           return finalState;
         }),

      renamePlaylist: (playlistId, newName) =>
        set((state) => {
          console.log(`[Store] renamePlaylist triggered for ID: ${playlistId}, new name: ${newName}`);
          if (!newName.trim()) {
             toast({ title: "Invalid Name", description: "Playlist name cannot be empty.", variant: "destructive"});
             return {};
          }
          const updatedPlaylists = state.playlists.map((p) =>
            p.id === playlistId ? { ...p, name: newName.trim() } : p
          );
          console.log('[Store] renamePlaylist finished.');
          return { playlists: updatedPlaylists };
        }),

      addSongToPlaylist: (playlistId, song) => {
        let songAdded = false;
        set((state) => {
          console.log(`[Store] addSongToPlaylist triggered for playlist ID: ${playlistId}, song ID: ${song.id}`);
          const playlistIndex = state.playlists.findIndex((p) => p.id === playlistId);
          if (playlistIndex === -1) {
            console.error(`[Store] Playlist with ID ${playlistId} not found.`);
            toast({ title: "Error", description: "Playlist not found.", variant: "destructive" });
            return state;
          }

          const playlist = state.playlists[playlistIndex];
          const songExists = playlist.songs.some((s) => s.id === song.id);

          if (songExists) {
             toast({
               title: 'Song Already Exists',
               description: `"${song.title}" is already in the playlist "${playlist.name}".`,
               variant: 'default',
             });
            songAdded = false;
            console.warn(`[Store] Song ID ${song.id} already exists in playlist ${playlistId}.`);
            return state;
          }

          const updatedSongs = [...playlist.songs, song];
          const updatedPlaylist = { ...playlist, songs: updatedSongs };
          const updatedPlaylists = [...state.playlists];
          updatedPlaylists[playlistIndex] = updatedPlaylist;
          songAdded = true;
          console.log(`[Store] Song ID ${song.id} added to playlist ${playlistId}.`);

           // --- Add to queue IF the modified playlist is the current context ---
           if (state.currentPlaylistContextId === playlistId && state.queue.length > 0) {
                const newQueueItem: QueueSong = {
                    ...song,
                    queueId: state._generateQueueId(),
                    playlistContextId: playlistId,
                };
                let updatedQueue = [...state.queue];

                if (state.isShuffling) {
                    // Insert randomly into the non-playing part of the queue
                    const randomIndex = Math.floor(Math.random() * (updatedQueue.length - 1)) + 1; // Between 1 and end
                    updatedQueue.splice(randomIndex, 0, newQueueItem);
                    console.log(`[Store] Inserted new song ${song.id} randomly into shuffled queue at index ${randomIndex}.`);
                } else {
                    // Insert at the end of the queue
                    updatedQueue.push(newQueueItem);
                    console.log(`[Store] Appended new song ${song.id} to the end of the linear queue.`);
                }

                return { playlists: updatedPlaylists, queue: updatedQueue };
            }


          return { playlists: updatedPlaylists };
        });
        return songAdded;
      },

      removeSongFromPlaylist: (playlistId, songId) =>
         set((state) => {
           console.log(`[Store removeSongFromPlaylist] triggered for playlist ID: ${playlistId}, song ID: ${songId}`);
           let songRemovedFromQueue = false;
           let playlistModified = false;
           const updatedPlaylists = state.playlists.map((p) => {
             if (p.id === playlistId) {
                const initialSongCount = p.songs.length;
                const updatedSongs = p.songs.filter((s) => s.id !== songId);
                if (updatedSongs.length < initialSongCount) {
                   console.log(`[Store] Removed song ${songId} from playlist source ${playlistId}.`);
                   playlistModified = true;
                }
                return { ...p, songs: updatedSongs };
             }
             return p;
           });

           // If the playlist wasn't modified, no need to check the queue
           if (!playlistModified) return { playlists: updatedPlaylists };

           // Also remove instances of this song *from the current queue* IF the current queue's context matches
           let newQueue = [...state.queue];
           let newCurrentQueueIndex = state.currentQueueIndex;
           let newIsPlaying = state.isPlaying;

           if (state.currentPlaylistContextId === playlistId) {
                const initialQueueLength = state.queue.length;
                const currentSongQueueId = state.queue[state.currentQueueIndex]?.queueId;

                newQueue = state.queue.filter(queueSong => queueSong.id !== songId);
                songRemovedFromQueue = newQueue.length < initialQueueLength;

                if (songRemovedFromQueue) {
                    console.log(`[Store] Removed ${initialQueueLength - state.queue.length} instance(s) of song ${songId} from queue (context match).`);

                    // Check if the currently playing song was removed
                    const currentSongStillExists = newQueue.some(q => q.queueId === currentSongQueueId);

                    if (!currentSongStillExists && state.currentQueueIndex !== -1) {
                         // The currently playing song *was* removed
                         console.log(`[Store] Removed currently playing song (ID: ${songId}) from queue.`);
                         if (newQueue.length > 0) {
                              // Play the new song at index 0
                             newCurrentQueueIndex = 0;
                             console.log(`[Store] Moving to next song in queue at index: ${newCurrentQueueIndex}`);
                         } else {
                             // Queue became empty
                             newCurrentQueueIndex = -1;
                             newIsPlaying = false;
                             console.log("[Store] Queue became empty after removing song.");
                         }
                    } else if (newQueue.length > 0) {
                         // Current song wasn't removed, index is still 0
                         newCurrentQueueIndex = 0;
                         console.log(`[Store] Current song index remains ${newCurrentQueueIndex} after song removal.`);
                    } else {
                        // Queue became empty even if current song wasn't the target (unlikely)
                         newCurrentQueueIndex = -1;
                         newIsPlaying = false;
                         console.log("[Store] Queue became empty after removing song (edge case).");
                    }
                }
            }


           const finalState = {
              playlists: updatedPlaylists,
              queue: newQueue,
              currentQueueIndex: newCurrentQueueIndex,
              isPlaying: newIsPlaying,
              // Reset progress/duration only if stopping playback or if the current song was removed
              currentSongProgress: newIsPlaying ? (songRemovedFromQueue && !newQueue.some(q=>q.queueId === state.queue[state.currentQueueIndex]?.queueId) ? 0 : state.currentSongProgress) : 0,
              currentSongDuration: newIsPlaying ? (songRemovedFromQueue && !newQueue.some(q=>q.queueId === state.queue[state.currentQueueIndex]?.queueId) ? 0 : state.currentSongDuration) : 0,
            };
             console.log('[Store] removeSongFromPlaylist finished. New state:', finalState);
           return finalState;
         }),

      reorderSongInPlaylist: (playlistId, fromIndex, toIndex) =>
         set((state) => {
           console.log(`[Store] reorderSongInPlaylist triggered for playlist ${playlistId}, from ${fromIndex} to ${toIndex}`);
           const playlistIndex = state.playlists.findIndex((p) => p.id === playlistId);
           if (playlistIndex === -1) {
               console.error(`[Store] Playlist ${playlistId} not found for reordering.`);
               return {};
           }

           const playlist = state.playlists[playlistIndex];
           if (fromIndex < 0 || fromIndex >= playlist.songs.length || toIndex < 0 || toIndex >= playlist.songs.length) {
              console.error(`[Store] Invalid indices for reordering in playlist ${playlistId}: from ${fromIndex}, to ${toIndex}`);
              return {};
           }
           const newSongs = Array.from(playlist.songs);
           const [movedItem] = newSongs.splice(fromIndex, 1);
           newSongs.splice(toIndex, 0, movedItem);

           const updatedPlaylists = [...state.playlists];
           updatedPlaylists[playlistIndex] = { ...playlist, songs: newSongs };
            console.log(`[Store] Playlist ${playlistId} reordered.`);

           // If the reordered playlist is the current context AND shuffle is OFF, rebuild the queue
           let updatedQueue = state.queue;
           let updatedIndex = state.currentQueueIndex;
           if (state.currentPlaylistContextId === playlistId && !state.isShuffling) {
               console.log("[Store] Reordered playlist is current context (shuffle off). Rebuilding queue.");
               const currentQueueId = state.queue[state.currentQueueIndex]?.queueId;
               // Rebuild based on the updated playlist source
               const updatedPlaylistSource = updatedPlaylists.find(p => p.id === playlistId);
               if(updatedPlaylistSource) {
                    // Find the index of the currently playing song in the *original* source order to maintain its position relative to start
                    const currentSongId = state.queue.find(q => q.queueId === currentQueueId)?.id;
                    const originalStartIndexForCurrentSong = playlist.songs.findIndex(s => s.id === currentSongId);

                    // Build the new queue starting from the current song's *new* index in the reordered list
                    const newStartIndex = newSongs.findIndex(s => s.id === currentSongId);
                    updatedQueue = state._buildQueueFromPlaylist(updatedPlaylistSource, newStartIndex >= 0 ? newStartIndex : 0, false);
                    updatedIndex = 0; // The current song is now at index 0
                    console.log(`[Store] Queue rebuilt linearly. New current index: ${updatedIndex}`);
               } else {
                    console.warn("[Store] Could not find updated playlist source for queue rebuild.");
                    updatedQueue = [];
                    updatedIndex = -1;
               }

           } else if (state.currentPlaylistContextId === playlistId && state.isShuffling) {
                console.log("[Store] Reordered playlist is current context (shuffle on). No queue rebuild needed immediately.");
                // When shuffle is on, the queue order doesn't directly reflect playlist order.
                // The source playlist is updated, but the queue only rebuilds on toggle shuffle or loop.
           }

           return { playlists: updatedPlaylists, queue: updatedQueue, currentQueueIndex: updatedIndex };
         }),

      setActivePlaylistId: (playlistId) =>
        set((state) => {
           if (playlistId !== state.activePlaylistId) {
              console.log(`[Store] setActivePlaylistId triggered. Switching *viewed* playlist to: ${playlistId}`);
              return { activePlaylistId: playlistId };
           }
           console.log(`[Store] setActivePlaylistId triggered, but playlist ${playlistId} is already active. No change.`);
           return {};
        }),

      // --- Queue & Playback ---

      _buildQueueFromPlaylist: (playlist, startIndex, shuffle, currentQueueIdToKeep = undefined): QueueSong[] => {
          console.log(`[Store _buildQueue] Building queue from "${playlist.name}", start: ${startIndex}, shuffle: ${shuffle}, keep ID: ${currentQueueIdToKeep}`);
          if (!playlist || playlist.songs.length === 0) {
              console.log("[Store _buildQueue] Playlist empty or invalid. Returning empty queue.");
              return [];
          }

          const sourceSongs = [...playlist.songs];
          let songsToQueue: Song[] = [];
          let currentSong: Song | undefined = undefined;
          let currentQueueId: string | undefined = currentQueueIdToKeep;

          // Try to find the song corresponding to currentQueueIdToKeep
          const currentSongFromState = get().queue.find(q => q.queueId === currentQueueIdToKeep);
          if (currentSongFromState) {
             currentSong = sourceSongs.find(s => s.id === currentSongFromState.id);
          }


          // If not keeping a specific song, use the start index
          if (!currentSong) {
             const effectiveStartIndex = Math.max(0, Math.min(startIndex, sourceSongs.length - 1));
             currentSong = sourceSongs[effectiveStartIndex];
             currentQueueId = get()._generateQueueId(); // Generate new ID if not keeping one
             console.log(`[Store _buildQueue] Using song at start index ${effectiveStartIndex} as current: "${currentSong?.title}"`);
          } else {
              console.log(`[Store _buildQueue] Keeping current song: "${currentSong?.title}" (ID: ${currentSong?.id})`);
          }

          if (!currentSong) {
             console.error("[Store _buildQueue] Could not determine current song. Returning empty queue.");
             return [];
          }


          if (shuffle) {
              console.log("[Store _buildQueue] Shuffle is ON.");
              const otherSongs = sourceSongs.filter(s => s.id !== currentSong!.id); // Exclude current song
              const shuffledOtherSongs = shuffleArray(otherSongs);
              songsToQueue = [currentSong, ...shuffledOtherSongs]; // Current song first, then shuffled rest
              console.log(`[Store _buildQueue] Shuffled queue built. "${currentSong.title}" is first.`);
          } else {
              console.log("[Store _buildQueue] Shuffle is OFF.");
              // Find the index of the current/start song in the original source
              const currentSongIndexInSource = sourceSongs.findIndex(s => s.id === currentSong!.id);
              const effectiveCurrentIndex = currentSongIndexInSource !== -1 ? currentSongIndexInSource : 0;

              // Linear order: start from current song, wrap around
              const part1 = sourceSongs.slice(effectiveCurrentIndex);
              const part2 = sourceSongs.slice(0, effectiveCurrentIndex);
              songsToQueue = [...part1, ...part2];
              console.log(`[Store _buildQueue] Linear queue built starting from "${currentSong.title}".`);
          }

          // Map to QueueSong format, preserving the current song's queueId if provided
          const newQueue = songsToQueue.map((song) => {
              // If this is the designated current song AND we are preserving its ID
              if (song.id === currentSong!.id && currentQueueId === currentQueueIdToKeep) {
                  return {
                      ...song,
                      queueId: currentQueueId, // Use the kept ID
                      playlistContextId: playlist.id,
                  };
              }
              // Otherwise, generate a new ID
              return {
                  ...song,
                  queueId: get()._generateQueueId(),
                  playlistContextId: playlist.id,
              };
          });

          console.log(`[Store _buildQueue] Built queue has ${newQueue.length} songs.`);
          return newQueue;
      },


       playPlaylist: (playlistId, startIndex = 0) => set((state) => {
          console.log(`[Store playPlaylist] Triggered for playlist ID: ${playlistId}, startIndex: ${startIndex}`);
          const playlist = state.playlists.find((p) => p.id === playlistId);
          if (!playlist) {
              console.error(`[Store playPlaylist] Playlist ${playlistId} not found.`);
              toast({ title: "Error", description: "Playlist not found.", variant: "destructive" });
              return {};
          }
          if (playlist.songs.length === 0) {
              console.warn(`[Store playPlaylist] Playlist ${playlistId} is empty. Cannot play.`);
              toast({ title: "Empty Playlist", description: "Cannot play an empty playlist.", variant: "default" });
              return {};
          }

          // Build the new queue using the helper
          const newQueue = state._buildQueueFromPlaylist(playlist, startIndex, state.isShuffling);

          if (newQueue.length === 0) {
              console.error("[Store playPlaylist] Failed to build queue. Aborting.");
              return { currentPlaylistContextId: null }; // Reset context if queue build fails
          }

          console.log(`[Store playPlaylist] Setting new queue from playlist "${playlist.name}". ${newQueue.length} songs. Starting playback.`);

          const finalState = {
            queue: newQueue,
            currentQueueIndex: 0, // Always start at 0 in the new queue
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            currentPlaylistContextId: playlistId,
            currentPlaylistContextStartIndex: startIndex, // Store original requested start index
          };
          console.log('[Store playPlaylist] Finished. New state:', finalState);
          return finalState;
       }),

      playSongInPlaylistContext: (song, playlistId) => {
          console.log(`[Store playSongInPlaylistContext] Triggered for song ID: ${song.id}, playlist ID: ${playlistId}`);
         const playlist = get().playlists.find(p => p.id === playlistId);
         if (!playlist) {
              console.error(`[Store playSongInPlaylistContext] Playlist ${playlistId} not found.`);
              toast({ title: "Error", description: "Playlist not found.", variant: "destructive" });
              return;
          }
         const songIndex = playlist.songs.findIndex(s => s.id === song.id);
         if (songIndex === -1) {
             console.error(`[Store playSongInPlaylistContext] Song ${song.id} not found within playlist ${playlistId}.`);
              toast({ title: "Error", description: "Song not found in this playlist.", variant: "destructive" });
             return;
         }
          console.log(`[Store playSongInPlaylistContext] Found song ${song.id} at index ${songIndex} in playlist ${playlistId}. Delegating to playPlaylist.`);
         // Call playPlaylist, which will build the queue starting with this song
         get().playPlaylist(playlistId, songIndex);
       },

      playSingleSong: (song) => set((state) => {
          console.log(`[Store playSingleSong] Triggered for song ID: ${song.id}`);
          const newQueueItem: QueueSong = {
              ...song,
              queueId: state._generateQueueId(),
              // No playlist context in single play mode
          };
          console.log("[Store playSingleSong] Setting queue with 1 song (single play mode).");
          const finalState = {
            queue: [newQueueItem],
            currentQueueIndex: 0,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            // isShuffling: false, // Keep shuffle state? Spotify seems to. Let's keep it.
            isLoopingPlaylist: false, // Turn off playlist loop
            currentPlaylistContextId: null, // Clear playlist context
            currentPlaylistContextStartIndex: 0,
          };
           console.log('[Store playSingleSong] Finished. New state:', finalState);
          return finalState;
      }),

       playNextSong: () => set((state) => {
         console.log("[Store playNextSong] Triggered.");
         const { queue, isLooping, isLoopingPlaylist, currentPlaylistContextId, _buildQueueFromPlaylist, isShuffling } = state;

         if (queue.length === 0) {
             console.warn("[Store playNextSong] Queue is empty.");
             return { isPlaying: false, currentQueueIndex: -1 };
         }

         // Handle single song loop first
         if (isLooping) {
             console.log("[Store playNextSong] Looping current song.");
             seekPlayerTo(0); // Tell player to seek to 0
             return { currentSongProgress: 0, isPlaying: true };
         }

         // Remove the song that just finished (index 0)
         const newQueue = [...queue];
         const finishedSong = newQueue.shift();
         console.log(`[Store playNextSong] Removed completed song "${finishedSong?.title}" from queue start.`);

         // Check if the queue is now empty
         if (newQueue.length === 0) {
             console.log("[Store playNextSong] Queue is now empty.");
             // Check for playlist looping
             if (isLoopingPlaylist && currentPlaylistContextId) {
                 console.log("[Store playNextSong] Playlist Loop is ON. Rebuilding queue from context.");
                 const playlist = state.playlists.find(p => p.id === currentPlaylistContextId);
                 if (playlist) {
                      // Rebuild the queue, potentially shuffling if shuffle is also on
                     const rebuiltQueue = _buildQueueFromPlaylist(playlist, 0, isShuffling); // Start from 0, respect shuffle state
                     if (rebuiltQueue.length > 0) {
                          const nextSong = rebuiltQueue[0];
                          console.log(`[Store playNextSong] Looping: Playing first song "${nextSong.title}" of rebuilt queue.`);
                          return {
                              queue: rebuiltQueue,
                              currentQueueIndex: 0,
                              isPlaying: true,
                              currentSongProgress: 0,
                              currentSongDuration: 0,
                          };
                     } else {
                          console.warn("[Store playNextSong] Loop enabled but playlist context is empty. Stopping.");
                     }
                 } else {
                     console.warn("[Store playNextSong] Loop enabled but playlist context not found. Stopping.");
                 }
             } else {
                 console.log("[Store playNextSong] Loop/Context OFF or invalid. Stopping playback.");
             }

             // Stop playback if queue is empty and loop doesn't apply
             return {
                 queue: [],
                 isPlaying: false,
                 currentQueueIndex: -1,
                 currentSongProgress: 0,
                 currentSongDuration: 0,
             };

         } else {
             // Queue is not empty, the next song is already at index 0
             const nextSong = newQueue[0];
             console.log(`[Store playNextSong] Playing next song: "${nextSong.title}" (now at index 0).`);
             return {
                 queue: newQueue,
                 currentQueueIndex: 0, // Index is always 0
                 isPlaying: true,
                 currentSongProgress: 0,
                 currentSongDuration: 0,
             };
         }
     }),


    playPreviousSong: () => set((state) => {
        console.log("[Store playPreviousSong] Triggered.");
        const { queue, currentQueueIndex, currentSongProgress } = state;

        if (queue.length === 0 || currentQueueIndex === -1) {
             console.warn("[Store playPreviousSong] Queue is empty or no song playing.");
             return {};
        }

        // If more than 3 seconds into the song, just restart it
        // Otherwise (or always), restart the current song. Spotify doesn't have a true 'previous' in the main player controls.
        console.log("[Store playPreviousSong] Restarting current song.");
        seekPlayerTo(0);
        return { currentSongProgress: 0, isPlaying: true }; // Update store state

    }),


      togglePlayPause: () => set((state) => {
          console.log("[Store togglePlayPause] Triggered.");
          if (state.queue.length === 0 && !state.isPlaying) {
               console.warn("[Store togglePlayPause] No song in queue, cannot play.");
              return {};
          }
           if (state.queue.length > 0 && state.currentQueueIndex === -1 && !state.isPlaying) {
                console.log("[Store togglePlayPause] Queue exists but nothing selected. Playing first song.");
               return { isPlaying: true, currentQueueIndex: 0, currentSongProgress: 0, currentSongDuration: 0 };
           }

          const newState = !state.isPlaying;
          console.log(`[Store togglePlayPause] Setting isPlaying to ${newState}`);
          return { isPlaying: newState };
      }),

     toggleShuffle: () => set((state) => {
        const turningShuffleOn = !state.isShuffling;
        console.log(`[Store toggleShuffle] Triggered. Setting isShuffling to ${turningShuffleOn}`);

        if (!state.currentPlaylistContextId) {
             console.warn("[Store toggleShuffle] Cannot toggle shuffle without playlist context. State unchanged.");
             // Optionally, just change the shuffle state but don't rebuild queue
             // return { isShuffling: turningShuffleOn };
             return {};
        }

         const playlist = state.playlists.find(p => p.id === state.currentPlaylistContextId);
         if (!playlist) {
             console.error("[Store toggleShuffle] Playlist context ID invalid. Cannot rebuild queue.");
             return { isShuffling: turningShuffleOn }; // Update state but don't change queue
         }

         // Get the currently playing song's queue ID to keep it at the front
         const currentQueueId = state.queue[state.currentQueueIndex]?.queueId;

         // Rebuild the queue using the helper, passing the new shuffle state and the current song ID
         const rebuiltQueue = state._buildQueueFromPlaylist(playlist, 0, turningShuffleOn, currentQueueId);

         let newCurrentQueueIndex = -1;
         let newIsPlaying = state.isPlaying;

         if (rebuiltQueue.length > 0) {
             // The current song (if found) should be at index 0 in the rebuilt queue
             newCurrentQueueIndex = 0;
             console.log(`[Store toggleShuffle] Queue rebuilt with shuffle ${turningShuffleOn}. Current song "${rebuiltQueue[0]?.title}" remains at index 0.`);
         } else {
             console.log("[Store toggleShuffle] Rebuilt queue is empty.");
             newIsPlaying = false; // Stop if queue becomes empty
         }


        return {
            isShuffling: turningShuffleOn,
            queue: rebuiltQueue,
            currentQueueIndex: newCurrentQueueIndex,
            isPlaying: newIsPlaying,
        };
    }),


      toggleLoop: () => set((state) => {
           const newState = !state.isLooping;
           console.log(`[Store toggleLoop] Triggered. Setting single song loop to ${newState}`);
           // If turning single loop ON, turn playlist loop OFF
           const finalState = { isLooping: newState, ...(newState && { isLoopingPlaylist: false }) };
           console.log('[Store toggleLoop] Finished. New state:', finalState);
           return finalState;
       }),

      toggleLoopPlaylist: () => set((state) => {
           const newState = !state.isLoopingPlaylist;
           console.log(`[Store toggleLoopPlaylist] Triggered. Setting playlist loop to ${newState}`);
           // If turning playlist loop ON, turn single loop OFF
           const finalState = { isLoopingPlaylist: newState, ...(newState && { isLooping: false }) };
           console.log('[Store toggleLoopPlaylist] Finished. New state:', finalState);
           return finalState;
       }),

       setCurrentSongProgress: (progress) => set((state) => {
           const currentSong = state.queue[state.currentQueueIndex];
           if (currentSong && progress >= 0) {
               const duration = state.currentSongDuration || Infinity;
               const clampedProgress = Math.min(progress, duration);
               // Only update state if the value actually changes to avoid unnecessary re-renders
               if (clampedProgress !== state.currentSongProgress) {
                 return { currentSongProgress: clampedProgress };
               }
           }
           return {};
         }),

      setCurrentSongDuration: (duration) => set((state) => {
         const currentSong = state.queue[state.currentQueueIndex];
         const validDuration = duration > 0 ? duration : 0;
         if (currentSong && validDuration !== state.currentSongDuration) {
             // Reset progress if duration becomes 0 (e.g., on song change before new duration arrives)
             const newProgress = validDuration > 0 ? state.currentSongProgress : 0;
             return { currentSongDuration: validDuration, currentSongProgress: newProgress };
         }
         return {};
      }),

      setVolume: (volume) => set((state) => {
          const newVolume = Math.max(0, Math.min(1, volume));
          const explicitlyUnmuted = state.isMuted && newVolume > 0;
          const autoMuted = newVolume <= 0 && !state.isMuted;
          const newMuteState = explicitlyUnmuted ? false : (autoMuted ? true : state.isMuted);

          if (newVolume !== state.volume || newMuteState !== state.isMuted) {
            console.log(`[Store setVolume] New volume: ${newVolume}. New mute state: ${newMuteState}`);
            return { volume: newVolume, isMuted: newMuteState };
          }
          return {};
      }),

      toggleMute: () => set((state) => {
           const newMuteState = !state.isMuted;
           console.log(`[Store toggleMute] Setting isMuted to ${newMuteState}`);
           // If unmuting and volume is 0, set a small default volume
           const newVolume = !newMuteState && state.volume === 0 ? 0.1 : state.volume;
           return { isMuted: newMuteState, volume: newVolume };
       }),

       clearQueue: () => set((state) => {
            console.log("[Store clearQueue] Triggered.");
            const finalState = {
                queue: [],
                currentQueueIndex: -1,
                isPlaying: false,
                currentSongProgress: 0,
                currentSongDuration: 0,
                currentPlaylistContextId: null, // Clear context
                currentPlaylistContextStartIndex: 0,
             };
             console.log('[Store clearQueue] Finished. New state:', finalState);
             // Optionally seek player to 0 and pause if needed, depends on desired behavior
             // seekPlayerTo(0);
            return finalState;
        }),

      removeSongFromQueue: (queueIdToRemove: string) => set((state) => {
         console.log(`[Store removeSongFromQueue] Triggered for queue ID: ${queueIdToRemove}`);
         const initialQueueLength = state.queue.length;
         if (initialQueueLength === 0) {
              console.warn("[Store removeSongFromQueue] Queue is already empty.");
              return {};
         }

         const removedSongIndex = state.queue.findIndex(q => q.queueId === queueIdToRemove);
         if (removedSongIndex === -1) {
             console.warn(`[Store removeSongFromQueue] Song with queue ID ${queueIdToRemove} not found in queue.`);
             return {};
         }

         // If trying to remove the currently playing song (index 0)
         if (removedSongIndex === 0) {
             console.warn("[Store removeSongFromQueue] Cannot remove the currently playing song. Use playNextSong instead.");
             toast({ title: "Cannot Remove", description: "Skip the current song instead of removing it.", variant: "default"});
             return {}; // Prevent removing the current song directly
         }

         // Remove the song from the queue (it's guaranteed not to be index 0 here)
         const newQueue = state.queue.filter(q => q.queueId !== queueIdToRemove);
         console.log(`[Store removeSongFromQueue] Removed song at index ${removedSongIndex}. New queue length: ${newQueue.length}`);

         // Current index remains 0 as the playing song wasn't removed
         const newCurrentQueueIndex = state.currentQueueIndex;

         const finalState = {
            queue: newQueue,
            currentQueueIndex: newCurrentQueueIndex, // Stays 0
            isPlaying: state.isPlaying, // Play state doesn't change
         };
          console.log('[Store removeSongFromQueue] Finished. New state:', finalState);
         return finalState;
      }),


      reorderSongInQueue: (fromIndex, toIndex) => set((state) => {
          console.log(`[Store reorderSongInQueue] Triggered. From ${fromIndex} to ${toIndex}.`);
         if (fromIndex < 0 || fromIndex >= state.queue.length || toIndex < 0 || toIndex >= state.queue.length) {
            console.error(`[Store reorderSongInQueue] Invalid indices for queue reorder: from ${fromIndex}, to ${toIndex}`);
           return {};
         }
         // Cannot move the currently playing song (index 0)
         if (fromIndex === 0) {
              console.warn("[Store reorderSongInQueue] Cannot reorder the currently playing song (index 0).");
              return {};
         }
         // Cannot move a song to index 0
         if (toIndex === 0) {
              console.warn("[Store reorderSongInQueue] Cannot move a song to index 0.");
              return {};
         }


         const newQueue = Array.from(state.queue);
         const [movedItem] = newQueue.splice(fromIndex, 1);
         newQueue.splice(toIndex, 0, movedItem);

         // The currentQueueIndex remains 0 because the currently playing song is never moved.
         const newCurrentQueueIndex = 0;

         const finalState = { queue: newQueue, currentQueueIndex: newCurrentQueueIndex };
          console.log('[Store reorderSongInQueue] Finished. New state:', finalState);
         return finalState;
       }),

       playFromQueueIndex: (index) => set((state) => {
           console.log(`[Store playFromQueueIndex] Triggered with index: ${index}`);
         if (index < 0 || index >= state.queue.length) {
              console.error(`[Store playFromQueueIndex] Invalid queue index: ${index}. Queue length: ${state.queue.length}`);
              return {};
         }
         // If clicking the currently playing song (index 0), just ensure it's playing
          if (index === 0) {
             console.log("[Store playFromQueueIndex] Clicked current song (index 0). Ensuring playback.");
             return { isPlaying: true };
         }


           const targetSong = state.queue[index];
           console.log(`[Store playFromQueueIndex] Playing song "${targetSong.title}" from queue index ${index}.`);

           // Move the selected song to the front of the queue
           const newQueue = [...state.queue];
           const [playedSong] = newQueue.splice(index, 1);
           newQueue.unshift(playedSong);

           console.log(`[Store playFromQueueIndex] Moved song to index 0.`);

          const finalState = {
             queue: newQueue,
             currentQueueIndex: 0, // Always play from index 0
             isPlaying: true,
             currentSongProgress: 0,
             currentSongDuration: 0,
          };
           console.log('[Store playFromQueueIndex] Finished. New state:', finalState);
          return finalState;
       }),

    }),
    {
      name: 'youtune-playlist-storage-v4', // Incremented version for shuffle/loop logic change
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Select the state parts you want to persist
        playlists: state.playlists,
        activePlaylistId: state.activePlaylistId,
        volume: state.volume,
        isMuted: state.isMuted,
        isShuffling: state.isShuffling,
        isLooping: state.isLooping,
        isLoopingPlaylist: state.isLoopingPlaylist,
        currentPlaylistContextId: state.currentPlaylistContextId,
        currentPlaylistContextStartIndex: state.currentPlaylistContextStartIndex, // Keep for consistency
      }),
      version: 4, // Incremented version
       migrate: (persistedState: any, version: number) => {
         console.log(`[Store Migrate] Attempting migration from version ${version}. Current version: 4`);
         if (version < 1) {
              console.log("[Store Migrate] Migrating from version < 1.");
              // Apply changes for v1 if necessary
         }
         if (version < 2) {
              console.log("[Store Migrate] Migrating from version < 2. Adding default context fields.");
              persistedState.currentPlaylistContextId = null;
              persistedState.currentPlaylistContextStartIndex = 0;
         }
         if (version < 3) {
              console.log("[Store Migrate] Migrating from version < 3. Resetting queue state.");
              // Reset queue and related playback state because the logic changed significantly
              persistedState.queue = [];
              persistedState.currentQueueIndex = -1;
              persistedState.isPlaying = false;
              persistedState.currentSongProgress = 0;
              persistedState.currentSongDuration = 0;
              persistedState.currentPlaylistContextStartIndex = 0; // Reset start index too
         }
          if (version < 4) {
             console.log("[Store Migrate] Migrating from version < 4. No specific state changes needed for shuffle/loop logic, but ensuring queue index is reset on load.");
             // No direct state structure change, but logic relies on transient state being reset
             // The onRehydrateStorage logic already handles resetting queue/index
         }
         // Add more migration steps for future versions here
         // if (version < 5) { ... }

         console.log("[Store Migrate] Migration finished.");
         return persistedState as PlaylistState;
       },
       onRehydrateStorage: (state) => {
        console.log("[Store] Hydration starting...");
        return (persistedState, error) => {
          if (error) {
            console.error("[Store] Hydration error:", error);
          } else if (persistedState) {
            console.log("[Store] Hydration successful. Applying persisted state:", persistedState);

            // De-duplicate songs within each playlist on load
             const dedupedPlaylists = persistedState.playlists?.map(playlist => {
                 if (!playlist || !Array.isArray(playlist.songs)) {
                     console.warn(`[Store Rehydrate] Playlist ${playlist?.id} has invalid 'songs' property. Resetting songs.`);
                     return { ...playlist, songs: [] };
                 }
               const uniqueSongs = new Map<string, Song>();
               playlist.songs.forEach(song => {
                 if (song && song.id) { // Basic check for valid song object
                     if (!uniqueSongs.has(song.id)) {
                       uniqueSongs.set(song.id, song);
                     } else {
                       console.warn(`[Store Rehydrate] Duplicate song ID ${song.id} ("${song.title}") removed from playlist ${playlist.id} ("${playlist.name}").`);
                     }
                 } else {
                     console.warn(`[Store Rehydrate] Invalid song object found in playlist ${playlist.id}. Skipping.`);
                 }
               });
               return { ...playlist, songs: Array.from(uniqueSongs.values()) };
             }) ?? []; // Handle case where playlists array itself is missing
             persistedState.playlists = dedupedPlaylists;

            // Reset transient state (Queue, Playback)
            persistedState.queue = [];
            persistedState.currentQueueIndex = -1; // Crucial reset
            persistedState.isPlaying = false;
            persistedState.currentSongProgress = 0;
            persistedState.currentSongDuration = 0;

             // Validate activePlaylistId
             let activeIdIsValid = false;
             if (persistedState.activePlaylistId) {
                 activeIdIsValid = persistedState.playlists.some(p => p.id === persistedState.activePlaylistId);
             }
             if (!activeIdIsValid) {
                 persistedState.activePlaylistId = persistedState.playlists[0]?.id ?? null;
                 console.log(`[Store Rehydrate] Active playlist ID reset to: ${persistedState.activePlaylistId}`);
             }

             // Validate currentPlaylistContextId
             let contextIdIsValid = false;
             if (persistedState.currentPlaylistContextId) {
                  contextIdIsValid = persistedState.playlists.some(p => p.id === persistedState.currentPlaylistContextId);
             }
              if (!contextIdIsValid) {
                  persistedState.currentPlaylistContextId = null;
                  persistedState.currentPlaylistContextStartIndex = 0;
                  console.log(`[Store Rehydrate] Playback context ID was invalid, reset.`);
              }


            console.log("[Store] Transient state reset complete after hydration.");
          } else {
             console.log("[Store] No persisted state found. Initializing with defaults.");
             if (state) {
                state.playlists = [];
                state.activePlaylistId = null;
                state.volume = 0.8;
                state.isMuted = false;
                state.isShuffling = false;
                state.isLooping = false;
                state.isLoopingPlaylist = false;
                state.queue = [];
                state.currentQueueIndex = -1;
                state.isPlaying = false;
                state.currentSongProgress = 0;
                state.currentSongDuration = 0;
                state.currentPlaylistContextId = null;
                state.currentPlaylistContextStartIndex = 0;
             }
          }
        };
      },

    }
  )
);

// --- Player Reference ---
let playerRef: React.RefObject<ReactPlayer> | null = null;

export const setPlayerRef = (ref: React.RefObject<ReactPlayer>) => {
    playerRef = ref;
};

// --- Derived State Hook ---
// Gets the *currently playing* song (always at index 0 if playing)
export const useCurrentSong = () => {
  return usePlaylistStore((state) => state.queue[0] ?? null); // Index 0 is the current song
};

// Gets the *entire upcoming queue* (excluding the currently playing song)
export const useUpcomingQueue = () => {
  return usePlaylistStore((state) => state.queue.slice(1)); // All songs after index 0
};


// Hook to get the playlist context ID of the current queue
export const useCurrentSongPlaylistContext = () => {
   return usePlaylistStore((state) => state.currentPlaylistContextId);
};


// Helper function to manage the player's seekTo method
export const seekPlayerTo = (seconds: number, type: 'seconds' | 'fraction' = 'seconds') => {
    if (playerRef?.current) {
        playerRef.current.seekTo(seconds, type);
         // Immediately update store progress to reflect the seek
         const duration = usePlaylistStore.getState().currentSongDuration;
         if (duration > 0) {
             const progressSeconds = type === 'seconds' ? seconds : seconds * duration;
             usePlaylistStore.setState({ currentSongProgress: Math.max(0, Math.min(progressSeconds, duration)) });
         } else {
              usePlaylistStore.setState({ currentSongProgress: 0 });
         }
         console.log(`[Player Control] seekPlayerTo called: ${seconds} (${type})`);
    } else {
        console.warn("[Player Control] Player ref not available for seekTo.");
    }
};
