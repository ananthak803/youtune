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
      playlists: [], // Initialize with empty playlists
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


      _generateQueueId: () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,

       // --- Playlist Management ---
       createPlaylist: (name) =>
         set((state) => {
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
           }
           return newStateUpdate;
         }),

      deletePlaylist: (playlistId) =>
         set((state) => {
           const updatedPlaylists = state.playlists.filter((p) => p.id !== playlistId);
           let newActivePlaylistId = state.activePlaylistId;
           let newQueue = [...state.queue]; // Clone queue
           let newCurrentQueueIndex = state.currentQueueIndex;
           let newIsPlaying = state.isPlaying;
           let newContextId = state.currentPlaylistContextId;

           // If the deleted playlist was the one being *viewed*
           if (state.activePlaylistId === playlistId) {
             newActivePlaylistId = updatedPlaylists[0]?.id ?? null;
           }

           // If the deleted playlist was the context for the current queue
           if (state.currentPlaylistContextId === playlistId) {
               newQueue = [];
               newCurrentQueueIndex = -1;
               newIsPlaying = false;
               newContextId = null;
           } else {
               // Filter out songs from the deleted playlist context, just in case
               const initialQueueLength = newQueue.length;
               newQueue = newQueue.filter(qSong => qSong.playlistContextId !== playlistId);

               if (newQueue.length < initialQueueLength) {
                   // Recalculate current index if queue was modified
                   const currentSongStillExists = newQueue.some(qSong => qSong.queueId === state.queue[state.currentQueueIndex]?.queueId);
                   if (!currentSongStillExists && state.currentQueueIndex !== -1) {
                       newCurrentQueueIndex = newQueue.length > 0 ? 0 : -1;
                       if (newCurrentQueueIndex === -1) newIsPlaying = false;
                   } else if (newQueue.length > 0) {
                       newCurrentQueueIndex = 0; // Ensure index is 0 if queue is not empty
                   } else {
                       newCurrentQueueIndex = -1;
                       newIsPlaying = false;
                       newContextId = null;
                   }
               }
           }


           const finalState = {
              playlists: updatedPlaylists,
              activePlaylistId: newActivePlaylistId,
              queue: newQueue,
              currentQueueIndex: newCurrentQueueIndex,
              isPlaying: newIsPlaying,
              currentSongProgress: newIsPlaying ? state.currentSongProgress : 0,
              currentSongDuration: newIsPlaying ? state.currentSongDuration : 0,
              currentPlaylistContextId: newContextId,
            };
           return finalState;
         }),

      renamePlaylist: (playlistId, newName) =>
        set((state) => {
          if (!newName.trim()) {
             toast({ title: "Invalid Name", description: "Playlist name cannot be empty.", variant: "destructive"});
             return {};
          }
          const updatedPlaylists = state.playlists.map((p) =>
            p.id === playlistId ? { ...p, name: newName.trim() } : p
          );
          return { playlists: updatedPlaylists };
        }),

      addSongToPlaylist: (playlistId, song) => {
        let songAdded = false;
        set((state) => {
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
            return state;
          }

          const updatedSongs = [...playlist.songs, song];
          const updatedPlaylist = { ...playlist, songs: updatedSongs };
          const updatedPlaylists = [...state.playlists];
          updatedPlaylists[playlistIndex] = updatedPlaylist;
          songAdded = true;

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
                } else {
                    // Insert at the end of the queue
                    updatedQueue.push(newQueueItem);
                }

                return { playlists: updatedPlaylists, queue: updatedQueue };
            }


          return { playlists: updatedPlaylists };
        });
        return songAdded;
      },

      removeSongFromPlaylist: (playlistId, songId) =>
         set((state) => {
           let songRemovedFromQueue = false;
           let playlistModified = false;
           const updatedPlaylists = state.playlists.map((p) => {
             if (p.id === playlistId) {
                const initialSongCount = p.songs.length;
                const updatedSongs = p.songs.filter((s) => s.id !== songId);
                if (updatedSongs.length < initialSongCount) {
                   playlistModified = true;
                }
                return { ...p, songs: updatedSongs };
             }
             return p;
           });

           if (!playlistModified) return { playlists: updatedPlaylists };

           // Also update queue if the context matches
           let newQueue = [...state.queue];
           let newCurrentQueueIndex = state.currentQueueIndex;
           let newIsPlaying = state.isPlaying;

           if (state.currentPlaylistContextId === playlistId) {
                const initialQueueLength = state.queue.length;
                const currentSongQueueId = state.queue[state.currentQueueIndex]?.queueId;

                newQueue = state.queue.filter(queueSong => queueSong.id !== songId);
                songRemovedFromQueue = newQueue.length < initialQueueLength;

                if (songRemovedFromQueue) {
                    const currentSongStillExists = newQueue.some(q => q.queueId === currentSongQueueId);

                    if (!currentSongStillExists && state.currentQueueIndex !== -1) {
                         // Currently playing song was removed
                         if (newQueue.length > 0) {
                             newCurrentQueueIndex = 0; // Play the new song at index 0
                         } else {
                             newCurrentQueueIndex = -1;
                             newIsPlaying = false;
                         }
                    } else if (newQueue.length > 0) {
                         newCurrentQueueIndex = 0; // Index is always 0
                    } else {
                         newCurrentQueueIndex = -1;
                         newIsPlaying = false;
                    }
                }
            }


           const finalState = {
              playlists: updatedPlaylists,
              queue: newQueue,
              currentQueueIndex: newCurrentQueueIndex,
              isPlaying: newIsPlaying,
              currentSongProgress: newIsPlaying ? (songRemovedFromQueue && !newQueue.some(q=>q.queueId === state.queue[state.currentQueueIndex]?.queueId) ? 0 : state.currentSongProgress) : 0,
              currentSongDuration: newIsPlaying ? (songRemovedFromQueue && !newQueue.some(q=>q.queueId === state.queue[state.currentQueueIndex]?.queueId) ? 0 : state.currentSongDuration) : 0,
            };
           return finalState;
         }),

      reorderSongInPlaylist: (playlistId, fromIndex, toIndex) =>
         set((state) => {
           const playlistIndex = state.playlists.findIndex((p) => p.id === playlistId);
           if (playlistIndex === -1) return {};

           const playlist = state.playlists[playlistIndex];
           if (fromIndex < 0 || fromIndex >= playlist.songs.length || toIndex < 0 || toIndex >= playlist.songs.length) return {};

           const newSongs = Array.from(playlist.songs);
           const [movedItem] = newSongs.splice(fromIndex, 1);
           newSongs.splice(toIndex, 0, movedItem);

           const updatedPlaylists = [...state.playlists];
           updatedPlaylists[playlistIndex] = { ...playlist, songs: newSongs };

           // If the reordered playlist is the current context AND shuffle is OFF, rebuild the queue
           let updatedQueue = state.queue;
           let updatedIndex = state.currentQueueIndex;
           if (state.currentPlaylistContextId === playlistId && !state.isShuffling) {
               const currentQueueId = state.queue[state.currentQueueIndex]?.queueId;
               const updatedPlaylistSource = updatedPlaylists.find(p => p.id === playlistId);
               if(updatedPlaylistSource) {
                    // Find the original index of the current song
                    const currentSongId = state.queue.find(q => q.queueId === currentQueueId)?.id;
                    const newStartIndex = newSongs.findIndex(s => s.id === currentSongId);

                    updatedQueue = state._buildQueueFromPlaylist(updatedPlaylistSource, newStartIndex >= 0 ? newStartIndex : 0, false, currentQueueId);
                    updatedIndex = 0; // Current song should now be at index 0
               } else {
                    updatedQueue = [];
                    updatedIndex = -1;
               }
           }

           return { playlists: updatedPlaylists, queue: updatedQueue, currentQueueIndex: updatedIndex };
         }),

      setActivePlaylistId: (playlistId) =>
        set((state) => {
           if (playlistId !== state.activePlaylistId) {
              return { activePlaylistId: playlistId };
           }
           return {};
        }),

      // --- Queue & Playback ---

      _buildQueueFromPlaylist: (playlist, startIndex, shuffle, currentQueueIdToKeep = undefined): QueueSong[] => {
          if (!playlist || playlist.songs.length === 0) return [];

          const sourceSongs = [...playlist.songs];
          let songsToQueue: Song[] = [];
          let currentSong: Song | undefined = undefined;
          let currentQueueId: string | undefined = currentQueueIdToKeep;

          // Try to find the song corresponding to currentQueueIdToKeep within the source playlist
          const currentSongFromState = get().queue.find(q => q.queueId === currentQueueIdToKeep);
          if (currentSongFromState) {
             currentSong = sourceSongs.find(s => s.id === currentSongFromState.id);
             // If the kept song is no longer in the source playlist, we can't use it as the current song
             if (!currentSong) {
                  currentSong = undefined;
                  currentQueueId = undefined; // Cannot keep the ID if the song isn't there
             }
          }

          // If not keeping a specific song (or it wasn't valid), use the start index
          if (!currentSong) {
             const effectiveStartIndex = Math.max(0, Math.min(startIndex, sourceSongs.length - 1));
             currentSong = sourceSongs[effectiveStartIndex];
             currentQueueId = get()._generateQueueId(); // Generate new ID if not keeping one
          }

          if (!currentSong) return []; // Should not happen if sourceSongs is not empty

          if (shuffle) {
              const otherSongs = sourceSongs.filter(s => s.id !== currentSong!.id);
              const shuffledOtherSongs = shuffleArray(otherSongs);
              songsToQueue = [currentSong, ...shuffledOtherSongs];
          } else {
              const currentSongIndexInSource = sourceSongs.findIndex(s => s.id === currentSong!.id);
              const effectiveCurrentIndex = currentSongIndexInSource !== -1 ? currentSongIndexInSource : 0;
              const part1 = sourceSongs.slice(effectiveCurrentIndex);
              const part2 = sourceSongs.slice(0, effectiveCurrentIndex);
              songsToQueue = [...part1, ...part2];
          }

          // Map to QueueSong format, ensuring the current song uses the correct queueId
          const newQueue = songsToQueue.map((song) => {
              if (song.id === currentSong!.id) {
                  return {
                      ...song,
                      queueId: currentQueueId!, // Use the determined queue ID for the current song
                      playlistContextId: playlist.id,
                  };
              }
              return {
                  ...song,
                  queueId: get()._generateQueueId(),
                  playlistContextId: playlist.id,
              };
          });
          return newQueue;
      },


       playPlaylist: (playlistId, startIndex = 0) => set((state) => {
          const playlist = state.playlists.find((p) => p.id === playlistId);
          if (!playlist) {
              toast({ title: "Error", description: "Playlist not found.", variant: "destructive" });
              return {};
          }
          if (playlist.songs.length === 0) {
              toast({ title: "Empty Playlist", description: "Cannot play an empty playlist.", variant: "default" });
              return {};
          }

          const newQueue = state._buildQueueFromPlaylist(playlist, startIndex, state.isShuffling);

          if (newQueue.length === 0) {
              console.error("[Store playPlaylist] Failed to build queue.");
              return { currentPlaylistContextId: null }; // Reset context if queue build fails
          }

          const finalState = {
            queue: newQueue,
            currentQueueIndex: 0, // Always start at 0 in the new queue
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            currentPlaylistContextId: playlistId,
          };
          return finalState;
       }),

      playSongInPlaylistContext: (song, playlistId) => {
         const playlist = get().playlists.find(p => p.id === playlistId);
         if (!playlist) {
              toast({ title: "Error", description: "Playlist not found.", variant: "destructive" });
              return;
          }
         const songIndex = playlist.songs.findIndex(s => s.id === song.id);
         if (songIndex === -1) {
              toast({ title: "Error", description: "Song not found in this playlist.", variant: "destructive" });
             return;
         }
         // Call playPlaylist, which handles queue building and state updates
         get().playPlaylist(playlistId, songIndex);
       },

      playSingleSong: (song) => set((state) => {
          const newQueueItem: QueueSong = {
              ...song,
              queueId: state._generateQueueId(),
              // No playlist context
          };
          const finalState = {
            queue: [newQueueItem],
            currentQueueIndex: 0,
            isPlaying: true,
            currentSongProgress: 0,
            currentSongDuration: 0,
            isLoopingPlaylist: false, // Turn off playlist loop
            currentPlaylistContextId: null, // Clear context
          };
          return finalState;
      }),

       playNextSong: () => set((state) => {
         const { queue, isLooping, isLoopingPlaylist, currentPlaylistContextId, _buildQueueFromPlaylist, isShuffling } = state;

         if (queue.length === 0) return { isPlaying: false, currentQueueIndex: -1 };

         // Handle single song loop
         if (isLooping) {
             seekPlayerTo(0);
             return { currentSongProgress: 0, isPlaying: true };
         }

         // Remove the song that just finished (index 0)
         const newQueue = [...queue];
         newQueue.shift(); // Remove the first element

         // Check if queue is empty after removing the song
         if (newQueue.length === 0) {
             // Check for playlist looping
             if (isLoopingPlaylist && currentPlaylistContextId) {
                 const playlist = state.playlists.find(p => p.id === currentPlaylistContextId);
                 if (playlist && playlist.songs.length > 0) {
                     // Rebuild queue from start (respecting shuffle)
                     const rebuiltQueue = _buildQueueFromPlaylist(playlist, 0, isShuffling);
                     if (rebuiltQueue.length > 0) {
                         return {
                             queue: rebuiltQueue,
                             currentQueueIndex: 0,
                             isPlaying: true,
                             currentSongProgress: 0,
                             currentSongDuration: 0,
                         };
                     }
                 }
             }
             // If no loop or playlist invalid, stop playback
             return {
                 queue: [],
                 isPlaying: false,
                 currentQueueIndex: -1,
                 currentSongProgress: 0,
                 currentSongDuration: 0,
             };
         } else {
             // Queue is not empty, the next song is now at index 0
             return {
                 queue: newQueue,
                 currentQueueIndex: 0, // Always 0
                 isPlaying: true,
                 currentSongProgress: 0,
                 currentSongDuration: 0,
             };
         }
     }),


    playPreviousSong: () => set((state) => {
        const { queue, currentQueueIndex, currentSongProgress } = state;
        if (queue.length === 0 || currentQueueIndex === -1) return {};

        // Always restart the current song (Spotify behavior)
        seekPlayerTo(0);
        return { currentSongProgress: 0, isPlaying: true };
    }),


      togglePlayPause: () => set((state) => {
          if (state.queue.length === 0 && !state.isPlaying) return {};
           if (state.queue.length > 0 && state.currentQueueIndex === -1 && !state.isPlaying) {
               // Start playing the first song if queue exists but index is -1
               return { isPlaying: true, currentQueueIndex: 0, currentSongProgress: 0, currentSongDuration: 0 };
           }
          return { isPlaying: !state.isPlaying };
      }),

     toggleShuffle: () => set((state) => {
        const turningShuffleOn = !state.isShuffling;

        // If there's no playlist context, just toggle the state without rebuilding queue
        if (!state.currentPlaylistContextId) {
             return { isShuffling: turningShuffleOn };
        }

         const playlist = state.playlists.find(p => p.id === state.currentPlaylistContextId);
         if (!playlist || playlist.songs.length === 0) {
             // If context is invalid or playlist is empty, still toggle state, but clear queue
             return {
                 isShuffling: turningShuffleOn,
                 queue: [],
                 currentQueueIndex: -1,
                 isPlaying: false,
                 currentSongProgress: 0,
                 currentSongDuration: 0,
             };
         }

         // Get the currently playing song's queue ID to keep it at the front
         const currentQueueId = state.queue[state.currentQueueIndex]?.queueId;
         const currentSong = state.queue.find(q => q.queueId === currentQueueId);

         // If there's no current song playing, just rebuild from start
         if (!currentSong) {
              const rebuiltQueue = state._buildQueueFromPlaylist(playlist, 0, turningShuffleOn);
              return {
                 isShuffling: turningShuffleOn,
                 queue: rebuiltQueue,
                 currentQueueIndex: rebuiltQueue.length > 0 ? 0 : -1,
                 isPlaying: rebuiltQueue.length > 0 ? state.isPlaying : false, // Keep playing if queue not empty
             };
         }

         // Rebuild the queue using the helper, preserving the current song
         const rebuiltQueue = state._buildQueueFromPlaylist(playlist, 0, turningShuffleOn, currentQueueId);

         return {
            isShuffling: turningShuffleOn,
            queue: rebuiltQueue,
            currentQueueIndex: rebuiltQueue.length > 0 ? 0 : -1, // Current song is at index 0
            isPlaying: rebuiltQueue.length > 0 ? state.isPlaying : false, // Keep playing state if possible
        };
    }),


      toggleLoop: () => set((state) => {
           const newState = !state.isLooping;
           // If turning single loop ON, turn playlist loop OFF
           return { isLooping: newState, ...(newState && { isLoopingPlaylist: false }) };
       }),

      toggleLoopPlaylist: () => set((state) => {
           const newState = !state.isLoopingPlaylist;
           // If turning playlist loop ON, turn single loop OFF
           return { isLoopingPlaylist: newState, ...(newState && { isLooping: false }) };
       }),

       setCurrentSongProgress: (progress) => set((state) => {
           const currentSong = state.queue[state.currentQueueIndex];
           if (currentSong && progress >= 0) {
               const duration = state.currentSongDuration || Infinity;
               const clampedProgress = Math.min(progress, duration);
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
            return { volume: newVolume, isMuted: newMuteState };
          }
          return {};
      }),

      toggleMute: () => set((state) => {
           const newMuteState = !state.isMuted;
           // If unmuting and volume is 0, set a small default volume
           const newVolume = !newMuteState && state.volume === 0 ? 0.1 : state.volume;
           return { isMuted: newMuteState, volume: newVolume };
       }),

       clearQueue: () => set((state) => {
            const finalState = {
                queue: [],
                currentQueueIndex: -1,
                isPlaying: false,
                currentSongProgress: 0,
                currentSongDuration: 0,
                currentPlaylistContextId: null,
             };
             // Optionally seek player to 0 and pause if needed
             // seekPlayerTo(0);
            return finalState;
        }),

      removeSongFromQueue: (queueIdToRemove: string) => set((state) => {
         const initialQueueLength = state.queue.length;
         if (initialQueueLength === 0) return {};

         const removedSongIndex = state.queue.findIndex(q => q.queueId === queueIdToRemove);
         if (removedSongIndex === -1) return {};

         // Cannot remove the currently playing song (index 0)
         if (removedSongIndex === 0) {
             toast({ title: "Cannot Remove", description: "Skip the current song instead.", variant: "default"});
             return {};
         }

         const newQueue = state.queue.filter(q => q.queueId !== queueIdToRemove);
         const newCurrentQueueIndex = state.currentQueueIndex; // Stays 0

         const finalState = {
            queue: newQueue,
            currentQueueIndex: newCurrentQueueIndex,
            isPlaying: state.isPlaying,
         };
         return finalState;
      }),


      reorderSongInQueue: (fromIndex, toIndex) => set((state) => {
         if (fromIndex < 0 || fromIndex >= state.queue.length || toIndex < 0 || toIndex >= state.queue.length) return {};
         // Cannot move the currently playing song (index 0) or move to index 0
         if (fromIndex === 0 || toIndex === 0) return {};

         const newQueue = Array.from(state.queue);
         const [movedItem] = newQueue.splice(fromIndex, 1);
         newQueue.splice(toIndex, 0, movedItem);

         const newCurrentQueueIndex = 0; // Index remains 0

         return { queue: newQueue, currentQueueIndex: newCurrentQueueIndex };
       }),

       playFromQueueIndex: (index) => set((state) => {
         if (index < 0 || index >= state.queue.length) return {};
         // If clicking the currently playing song (index 0), just ensure it's playing
          if (index === 0) {
             return { isPlaying: true };
         }

           const targetSong = state.queue[index];
           const newQueue = [...state.queue];
           // Move the selected song to the front by removing it and adding it back
           newQueue.splice(index, 1);
           newQueue.unshift(targetSong);

          const finalState = {
             queue: newQueue,
             currentQueueIndex: 0, // Always play from index 0
             isPlaying: true,
             currentSongProgress: 0,
             currentSongDuration: 0,
          };
          return finalState;
       }),

    }),
    {
      name: 'youtune-playlist-storage-v6', // Increment version for latest changes
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        playlists: state.playlists,
        activePlaylistId: state.activePlaylistId,
        volume: state.volume,
        isMuted: state.isMuted,
        isShuffling: state.isShuffling,
        isLooping: state.isLooping,
        isLoopingPlaylist: state.isLoopingPlaylist,
        currentPlaylistContextId: state.currentPlaylistContextId,
      }),
      version: 6, // Incremented version
       migrate: (persistedState: any, version: number) => {
         // Run migration for each version gap
         if (version < 6) {
             // v5->v6: No breaking structural changes, but removing sample playlist logic requires clean state on hydrate
             // The logic will now be handled in onRehydrateStorage
         }
         // Add future migrations here following the pattern
         // if (version < 7) { ... }

         return persistedState as PlaylistState;
       },
       onRehydrateStorage: (state) => {
        return (persistedState, error) => {
          if (error) {
            console.error("[Store] Hydration error:", error);
          } else if (persistedState) {
             // De-duplicate songs within each playlist on load
              const dedupedPlaylists = persistedState.playlists?.map(playlist => {
                 if (!playlist || !Array.isArray(playlist.songs)) {
                     console.warn(`[Store Rehydrate] Playlist ${playlist?.id} has invalid 'songs' property. Resetting songs.`);
                     return { ...playlist, songs: [] };
                 }
               const uniqueSongs = new Map<string, Song>();
               playlist.songs.forEach(song => {
                 if (song && song.id) {
                     if (!uniqueSongs.has(song.id)) uniqueSongs.set(song.id, song);
                     else console.warn(`[Store Rehydrate] Duplicate song ID ${song.id} removed from playlist ${playlist.id}.`);
                 } else console.warn(`[Store Rehydrate] Invalid song object found in playlist ${playlist.id}. Skipping.`);
               });
               return { ...playlist, songs: Array.from(uniqueSongs.values()) };
             }) ?? [];
             persistedState.playlists = dedupedPlaylists;

            // Reset transient state (Queue, Playback) - ALWAYS reset these on load
            persistedState.queue = [];
            persistedState.currentQueueIndex = -1;
            persistedState.isPlaying = false;
            persistedState.currentSongProgress = 0;
            persistedState.currentSongDuration = 0;

             // Validate activePlaylistId
             let activeIdIsValid = false;
             if (persistedState.activePlaylistId) {
                 activeIdIsValid = persistedState.playlists.some(p => p.id === persistedState.activePlaylistId);
             }
             // If active ID is invalid OR no playlists exist, set to null or first available
             if (!activeIdIsValid) {
                 persistedState.activePlaylistId = persistedState.playlists[0]?.id ?? null;
             }

             // Validate currentPlaylistContextId
             let contextIdIsValid = false;
             if (persistedState.currentPlaylistContextId) {
                  contextIdIsValid = persistedState.playlists.some(p => p.id === persistedState.currentPlaylistContextId);
             }
              if (!contextIdIsValid) {
                  persistedState.currentPlaylistContextId = null;
              }

          } else {
             // No persisted state found, initialize with defaults (empty playlists)
             if (state) {
                state.playlists = []; // Start with empty playlists
                state.activePlaylistId = null; // No active playlist initially
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

// --- Derived State Hooks ---
// Gets the *currently playing* song (always at index 0 if playing)
export const useCurrentSong = () => {
  return usePlaylistStore((state) => state.queue[0] ?? null);
};

// Gets the *entire upcoming queue* (excluding the currently playing song)
export const useUpcomingQueue = () => {
  return usePlaylistStore((state) => state.queue.slice(1));
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
    } else {
        console.warn("[Player Control] Player ref not available for seekTo.");
    }
};
