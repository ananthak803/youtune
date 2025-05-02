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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      query: '',
    },
  });

  async function onSubmit(values: SearchFormValues) {
    setIsLoading(true);
    setSearchResults([]); // Clear previous results
    try {
      const results = await searchYoutubeAction(values.query);
      setSearchResults(results);
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
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Search YouTube</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 md:flex-nowrap md:gap-4">
              <FormField
                control={form.control}
                name="query"
                render={({ field }) => (
                  <FormItem className="flex-1 min-w-[200px]">
                    <FormLabel>Search Term</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter song title, artist, etc."
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
        </CardContent>
      </Card>

      {isLoading && (
         <div className="flex justify-center items-center p-8">
            <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
         </div>
      )}

      {!isLoading && searchResults.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Search Results</h3>
          <ScrollArea className="h-[40vh] pr-4"> {/* Adjust height as needed */}
            <div className="grid grid-cols-1 gap-4">
              {searchResults.map((result) => (
                <Card key={result.videoId} className="flex items-center p-3 gap-3">
                   <Image
                        src={result.thumbnailUrl || '/placeholder-album.svg'}
                        alt={result.title}
                        width={60} // Slightly larger for visibility
                        height={45} // Maintain 4:3 aspect ratio for default thumbs
                        className="rounded flex-shrink-0 object-cover"
                        data-ai-hint="youtube video thumbnail"
                        onError={(e) => { e.currentTarget.src = '/placeholder-album.svg'; }}
                    />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{result.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{result.author}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => handleInitiateAddSong(result)}
                    aria-label={`Add ${result.title} to playlist`}
                    disabled={isSelectPlaylistDialogOpen || songToAdd?.id === result.videoId} // Prevent spam clicking the same add button
                  >
                    <ListPlus className="h-5 w-5" />
                  </Button>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Playlist Selection Dialog */}
      <SelectPlaylistDialog
        isOpen={isSelectPlaylistDialogOpen}
        onOpenChange={(open) => {
          setIsSelectPlaylistDialogOpen(open);
          // If dialog is closed without selection, reset temp song
          if (!open) {
            setSongToAdd(null);
          }
        }}
        playlists={playlists}
        onSelectPlaylist={handlePlaylistSelected}
        songTitle={songToAdd?.title} // Pass song title for context
      />
    </>
  );
}
