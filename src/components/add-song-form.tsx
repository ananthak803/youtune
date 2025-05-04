
// src/components/add-song-form.tsx
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { getYoutubeMetadataAction } from '@/actions/youtube-actions'; // Action to get metadata
import { extractYoutubeVideoId } from '@/services/youtube'; // Helper to get video ID
import type { Song, Playlist, YoutubeVideoMetadata } from '@/lib/types';
import { usePlaylistStore } from '@/store/playlist-store';
import { SelectPlaylistDialog } from './select-playlist-dialog';
import { Plus, Play, Loader2, Youtube, Music, Link as LinkIcon } from 'lucide-react'; // Import necessary icons

// Schema for the URL input form
const addSongSchema = z.object({
  url: z.string().url({ message: 'Please enter a valid URL.' }).refine(
    (url) => {
        const videoId = extractYoutubeVideoId(url);
        return !!videoId; // Ensure a video ID can be extracted
    },
    { message: 'Please enter a valid YouTube video URL.' }
  ),
});

type AddSongFormValues = z.infer<typeof addSongSchema>;

interface AddSongFormProps {
  onSongAdded?: () => void; // Optional callback for when a song is successfully added/played
}

export function AddSongForm({ onSongAdded }: AddSongFormProps) {
  const { toast } = useToast();
  // Access store actions and state non-reactively for handlers
  const { addSongToPlaylist, playSingleSong, createPlaylist } = usePlaylistStore.getState();

  const [isLoading, setIsLoading] = useState(false);
  const [isSelectPlaylistDialogOpen, setIsSelectPlaylistDialogOpen] = useState(false);
  const [songToAdd, setSongToAdd] = useState<Song | null>(null); // Song derived from fetched metadata

  const form = useForm<AddSongFormValues>({
    resolver: zodResolver(addSongSchema),
    defaultValues: {
      url: '',
    },
  });

  // --- Fetch Metadata and Prepare Song ---
  const fetchAndPrepareSong = async (url: string): Promise<Song | null> => {
    setIsLoading(true);
    const videoId = extractYoutubeVideoId(url);

    if (!videoId) {
      toast({
        title: 'Invalid URL',
        description: 'Could not extract YouTube video ID from the URL.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return null;
    }

    try {
      // Use the server action to fetch metadata (requires API key)
      console.log(`[AddSongForm] Fetching metadata for video ID: ${videoId}`);
      const metadata: YoutubeVideoMetadata = await getYoutubeMetadataAction(videoId);
      console.log(`[AddSongForm] Metadata received:`, metadata);
      const song: Song = {
        id: videoId,
        title: metadata.title,
        author: metadata.author,
        url: `https://www.youtube.com/watch?v=${videoId}`, // Standard URL format
        thumbnailUrl: metadata.thumbnailUrl,
      };
      return song;
    } catch (error: any) {
      console.error('[AddSongForm] Error fetching metadata via action:', error);
      let description = 'Could not fetch video details.';
       if (error instanceof Error) {
           description = error.message;
           if (error.message.includes('Server configuration error: YouTube API key is missing')) {
               description = 'Configuration Error: YouTube API key is missing or invalid. Please check server setup.';
               throw new Error(description); // Throw specific error
           }
           if (error.message.includes('YouTube API Error:')) {
               // Extract the specific API error message if possible
               const apiErrorMsg = error.message.replace('YouTube API Error:', '').trim();
               description = `YouTube API Error: ${apiErrorMsg}`;
               throw new Error(description); // Throw specific error
           }
           if (error.message.includes('NetworkError')) {
              description = 'Failed to fetch YouTube video metadata due to a network issue.';
               throw new Error(description);
           }
       }
       toast({ title: 'Error', description: description, variant: 'destructive'});
       throw new Error(`Failed to fetch YouTube video metadata. ${error.message}`); // Rethrow generic for other cases

    } finally {
      setIsLoading(false);
    }
  };


  // --- Submit Handlers ---

  // Handler for "Add to Playlist" button
  const onAddToPlaylist = async (values: AddSongFormValues) => {
    try {
      const preparedSong = await fetchAndPrepareSong(values.url);
      if (!preparedSong) return; // Stop if metadata fetch failed or was caught

      setSongToAdd(preparedSong);

      // Get the current playlists state directly
      const currentPlaylists = usePlaylistStore.getState().playlists;

      if (currentPlaylists.length === 0) {
        // No playlists exist, create a default one
        console.log("[AddSongForm] No playlists found. Creating default 'My Playlist'.");
        createPlaylist("My Playlist"); // Call the store action
        // Get the updated state immediately after creation
        const updatedPlaylists = usePlaylistStore.getState().playlists;
        if (updatedPlaylists.length > 0) {
           const newPlaylistId = updatedPlaylists[0].id;
           console.log(`[AddSongForm] Adding song to newly created playlist ID: ${newPlaylistId}`);
           addSongToSpecificPlaylist(newPlaylistId, preparedSong, "My Playlist");
           form.reset(); // Clear form after successful add
           onSongAdded?.(); // Call callback if provided
        } else {
           console.error("[AddSongForm] Failed to create or find the new default playlist.");
           toast({ title: "Error", description: "Could not create default playlist.", variant: "destructive" });
           setSongToAdd(null);
        }

      } else if (currentPlaylists.length === 1) {
        // Add directly to the only playlist
        addSongToSpecificPlaylist(currentPlaylists[0].id, preparedSong, currentPlaylists[0].name);
        form.reset(); // Clear form after successful add
        onSongAdded?.(); // Call callback if provided
      } else {
        // Multiple playlists exist, open dialog to select
        setIsSelectPlaylistDialogOpen(true);
      }
    } catch (error: any) {
       // Catch errors from fetchAndPrepareSong
       console.error('[AddSongForm] Failed to prepare song:', error);
       toast({
         title: 'Error Preparing Song',
         description: error.message || 'Could not get video details.',
         variant: 'destructive',
       });
       setSongToAdd(null); // Clear song state on error
    }
  };

  // Handler for "Play Now" button
  const onPlayNow = async (values: AddSongFormValues) => {
    try {
      const preparedSong = await fetchAndPrepareSong(values.url);
      if (!preparedSong) return; // Stop if metadata fetch failed

      playSingleSong(preparedSong); // Play the song directly
      form.reset(); // Clear form after playing
      onSongAdded?.(); // Call callback if provided
    } catch (error: any) {
      // Catch errors from fetchAndPrepareSong
      console.error('[AddSongForm] Failed to prepare song for Play Now:', error);
      toast({
        title: 'Error Preparing Song',
        description: error.message || 'Could not get video details.',
        variant: 'destructive',
      });
    }
  };

  // --- Playlist Selection Logic ---

  // Called from the SelectPlaylistDialog
  const handlePlaylistSelected = (playlistId: string) => {
    if (songToAdd) {
      const selectedPlaylist = usePlaylistStore.getState().playlists.find(p => p.id === playlistId);
      addSongToSpecificPlaylist(playlistId, songToAdd, selectedPlaylist?.name);
      form.reset(); // Clear form after successful selection and add
      onSongAdded?.(); // Call callback if provided
    } else {
      console.error("[AddSongForm] Error: No song data available when playlist was selected.");
      toast({ title: "Error", description: "Could not add song. Please try again.", variant: "destructive" });
      setIsSelectPlaylistDialogOpen(false); // Ensure dialog closes on error
      setSongToAdd(null);
    }
  };

  // Final step after playlist selection (or if only one/default playlist exists)
  const addSongToSpecificPlaylist = (playlistId: string, song: Song, playlistName?: string) => {
    const added = addSongToPlaylist(playlistId, song);
    if (added) {
      toast({
        title: 'Song Added',
        description: `"${song.title}" added to playlist "${playlistName || 'Selected Playlist'}".`,
      });
    }
    // Reset state regardless of add success/fail (duplicate check in store)
    setSongToAdd(null);
    setIsSelectPlaylistDialogOpen(false);
  };

  return (
    <>
      {/* Removed the surrounding Card/div - this form is now intended to be placed inside a Dialog */}
      <Form {...form}>
        <form
          // onSubmit is not used directly on the form tag
          className="flex flex-col sm:flex-row items-start sm:items-center gap-2"
        >
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem className="flex-1 w-full sm:w-auto">
                <FormLabel className="sr-only">YouTube URL</FormLabel>
                <FormControl>
                  <div className="relative">
                    <LinkIcon className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Paste YouTube video URL..."
                      {...field}
                      disabled={isLoading}
                      aria-label="YouTube URL Input"
                      className="h-9 pl-8" // Add padding for icon
                    />
                  </div>
                </FormControl>
                <FormMessage className="mt-1 text-xs" />
              </FormItem>
            )}
          />
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            {/* Add to Playlist Button */}
            <Button
              type="button"
              onClick={form.handleSubmit(onAddToPlaylist)}
              disabled={isLoading || !form.formState.isValid}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial"
              aria-label="Add song to playlist"
            >
              {isLoading ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Add to Playlist</span>
              <span className="ml-2 sm:hidden">Add</span>
            </Button>

            {/* Play Now Button */}
            <Button
              type="button"
              onClick={form.handleSubmit(onPlayNow)}
              disabled={isLoading || !form.formState.isValid}
              variant="secondary"
              size="sm"
              className="flex-1 sm:flex-initial"
              aria-label="Play song now"
            >
              {isLoading ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              <span className="ml-2 hidden sm:inline">Play Now</span>
              <span className="ml-2 sm:hidden">Play</span>
            </Button>
          </div>
        </form>
      </Form>

      {/* Playlist Selection Dialog */}
      <SelectPlaylistDialog
        isOpen={isSelectPlaylistDialogOpen}
        onOpenChange={(open) => {
          setIsSelectPlaylistDialogOpen(open);
          if (!open) {
            setSongToAdd(null);
          }
        }}
        // Get playlists reactively for the dialog list
        playlists={usePlaylistStore(state => state.playlists)}
        onSelectPlaylist={handlePlaylistSelected}
        songTitle={songToAdd?.title}
      />
    </>
  );
}
