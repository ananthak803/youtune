// src/components/youtube-search.tsx
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
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
import { Card } from '@/components/ui/card'; // Keep Card for individual results
import { useToast } from '@/hooks/use-toast';
import { searchYoutubeAction } from '@/actions/youtube-actions';
import type { YoutubeSearchResult, Song, Playlist } from '@/lib/types';
import { usePlaylistStore } from '@/store/playlist-store';
import { SelectPlaylistDialog } from './select-playlist-dialog';
import { ListPlus, Search, Loader2 } from 'lucide-react';

const searchSchema = z.object({
  query: z.string().min(1, { message: 'Please enter a search term.' }),
});

type SearchFormValues = z.infer<typeof searchSchema>;

export function YoutubeSearch() {
  const { toast } = useToast();
  const { playlists, addSongToPlaylist } = usePlaylistStore((state) => ({
    playlists: state.playlists,
    addSongToPlaylist: state.addSongToPlaylist,
  }));

  const [searchResults, setSearchResults] = useState<YoutubeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelectPlaylistDialogOpen, setIsSelectPlaylistDialogOpen] = useState(false);
  const [songToAdd, setSongToAdd] = useState<Song | null>(null); // Song derived from search result
  const [hasSearched, setHasSearched] = useState(false); // Track if a search has been performed

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      query: '',
    },
  });

  async function onSubmit(values: SearchFormValues) {
    setIsLoading(true);
    setHasSearched(true); // Mark that a search has been attempted
    // setSearchResults([]); // Keep results while loading to avoid flicker
    try {
      const results = await searchYoutubeAction(values.query);
      setSearchResults(results); // Update results only after fetching
      if (results.length === 0) {
        toast({
          title: 'No Results',
          description: 'No videos found for your search query.',
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: 'Search Error',
        description: error instanceof Error ? error.message : 'Could not perform search.',
        variant: 'destructive',
      });
      setSearchResults([]); // Clear results on error
    } finally {
      setIsLoading(false);
    }
  }

  // Convert search result to Song format and initiate adding process
  const handleInitiateAddSong = (result: YoutubeSearchResult) => {
    const song: Song = {
      id: result.videoId,
      title: result.title,
      author: result.author,
      url: `https://www.youtube.com/watch?v=${result.videoId}`,
      // Ensure we use the correct thumbnail URL (hqdefault used in service now)
      thumbnailUrl: result.thumbnailUrl,
    };
    setSongToAdd(song);

    if (playlists.length === 0) {
      toast({
        title: 'No Playlists',
        description: 'Please create a playlist first.',
        variant: 'destructive',
      });
      setSongToAdd(null);
    } else if (playlists.length === 1) {
      // Add directly to the only playlist
      addSongToSpecificPlaylist(playlists[0].id, song);
    } else {
      // Open dialog to select playlist
      setIsSelectPlaylistDialogOpen(true);
    }
  };

  // Final step after playlist selection (or if only one playlist exists)
  const addSongToSpecificPlaylist = (playlistId: string, song: Song) => {
    const added = addSongToPlaylist(playlistId, song);
    if (added) {
      toast({
        title: 'Song Added',
        description: `"${song.title}" added to playlist.`,
      });
    }
    // Reset state regardless of add success/fail (duplicate check in store)
    setSongToAdd(null);
    setIsSelectPlaylistDialogOpen(false);
  };

  // Called from the SelectPlaylistDialog
  const handlePlaylistSelected = (playlistId: string) => {
    if (songToAdd) {
      addSongToSpecificPlaylist(playlistId, songToAdd);
    } else {
      console.error("Error: No song data available when playlist was selected.");
      toast({ title: "Error", description: "Could not add song. Please try again.", variant: "destructive" });
      setIsSelectPlaylistDialogOpen(false); // Ensure dialog closes on error
      setSongToAdd(null);
    }
  };

  return (
    <>
      <div className="space-y-4"> {/* Adjusted spacing */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 md:flex-nowrap md:gap-4">
              <FormField
                control={form.control}
                name="query"
                render={({ field }) => (
                  <FormItem className="flex-1 min-w-[150px]">
                    <FormLabel className="sr-only">Search Term</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter song title, artist..."
                        {...field}
                        disabled={isLoading}
                        aria-label="YouTube Search Input"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} aria-label="Search YouTube">
                {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Search className="mr-2 h-4 w-4" />}
                Search
              </Button>
            </form>
          </Form>

        {isLoading && (
          <div className="flex justify-center items-center p-8">
              <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
          </div>
        )}

        {!isLoading && searchResults.length > 0 && (
          <div className="mt-4"> {/* Adjusted top margin */}
            <h3 className="text-lg font-semibold mb-3">Results</h3>
            <div className="space-y-3">
              {searchResults.map((result) => (
                // Increase vertical padding on the Card for more height
                <Card key={result.videoId} className="flex items-center p-3 py-4 gap-3 overflow-hidden">
                   {/* Use a fixed width and aspect ratio for the image container */}
                   <div className="w-[80px] h-[60px] flex-shrink-0 relative rounded overflow-hidden">
                       <Image
                            src={result.thumbnailUrl || '/placeholder-album.svg'}
                            alt={result.title} // Use title as alt text
                            fill // Use fill to cover the container
                            sizes="(max-width: 768px) 80px, 80px" // Provide sizes hint
                            className="object-cover" // Ensure image covers the area
                            data-ai-hint="youtube video thumbnail"
                            // unoptimized // Keep unoptimized for external URLs unless configured (Removed as i.ytimg.com is configured)
                            onError={(e) => { e.currentTarget.src = '/placeholder-album.svg'; }}
                        />
                   </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{result.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{result.author}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground" // Button is always rendered here
                    onClick={() => handleInitiateAddSong(result)}
                    aria-label={`Add "${result.title}" to playlist`}
                    // Disable if the selection dialog is open OR if this specific song is the one currently being processed for adding
                    disabled={isSelectPlaylistDialogOpen || (songToAdd !== null && songToAdd.id === result.videoId)}
                  >
                    <ListPlus className="h-5 w-5" />
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

         {/* Show "No results found" only if a search was done and there are no results */}
         {!isLoading && hasSearched && searchResults.length === 0 && (
             <p className="text-muted-foreground text-sm text-center mt-6">No results found.</p>
         )}
      </div>

      <SelectPlaylistDialog
        isOpen={isSelectPlaylistDialogOpen}
        onOpenChange={(open) => {
          setIsSelectPlaylistDialogOpen(open);
          if (!open) {
            setSongToAdd(null);
          }
        }}
        playlists={playlists}
        onSelectPlaylist={handlePlaylistSelected}
        songTitle={songToAdd?.title}
      />
    </>
  );
}
