
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
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { searchYoutubeAction } from '@/actions/youtube-actions';
import type { YoutubeSearchResult, Song, Playlist } from '@/lib/types';
import { usePlaylistStore } from '@/store/playlist-store';
import { SelectPlaylistDialog } from './select-playlist-dialog';
import { ListPlus, Search, Loader2, Music } from 'lucide-react'; // Added Music icon for placeholder
import { ScrollArea } from '@/components/ui/scroll-area'; // Import ScrollArea

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

  // Simple placeholder rendering
  const renderPlaceholder = () => (
     <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-2 text-center px-4">
        <Search className="w-10 h-10 opacity-50" />
        <p className="text-sm">Search YouTube to find videos and add them to your playlists.</p>
     </div>
  );

  return (
    <>
      {/* Removed outer div, rely on SheetContent padding */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2 sticky top-0 bg-background z-10 py-4 border-b mb-4"> {/* Make form sticky */}
          <FormField
            control={form.control}
            name="query"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="sr-only">Search Term</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Search videos..."
                    {...field}
                    disabled={isLoading}
                    aria-label="YouTube Search Input"
                    className="h-9" // Slightly smaller input
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isLoading} aria-label="Search YouTube" size="sm"> {/* Smaller button */}
            {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
            <span className="sr-only sm:not-sr-only sm:ml-2">Search</span> {/* Hide text on small screens */}
          </Button>
        </form>
      </Form>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto pb-4"> {/* Allow results to scroll */}
         {isLoading && (
           <div className="flex justify-center items-center py-8">
               <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
           </div>
         )}

         {!isLoading && searchResults.length > 0 && (
           <div className="space-y-2"> {/* Reduced space between results */}
             {searchResults.map((result) => (
               <Card key={result.videoId} className="flex items-center p-2 gap-3 group hover:bg-muted/50 transition-colors"> {/* Use p-2, group hover */}
                  {/* Image Container */}
                  <div className="w-16 h-12 flex-shrink-0 relative rounded overflow-hidden bg-muted">
                      <Image
                           src={result.thumbnailUrl || '/placeholder-album.svg'}
                           alt={result.title}
                           fill
                           sizes="64px"
                           className="object-cover"
                           data-ai-hint="youtube video thumbnail"
                           onError={(e) => {
                             // Optionally replace with a placeholder icon on error
                             e.currentTarget.style.display = 'none';
                             const parent = e.currentTarget.parentElement;
                             if (parent && !parent.querySelector('.placeholder-icon')) {
                               const icon = document.createElement('div');
                               icon.className = 'placeholder-icon absolute inset-0 flex items-center justify-center text-muted-foreground';
                               icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-music h-6 w-6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
                               parent.appendChild(icon);
                             }
                           }}
                       />
                        {/* Fallback Icon structure (hidden initially, shown if image fails via JS above) */}
                        {/* <div className="absolute inset-0 flex items-center justify-center text-muted-foreground" style={{ display: 'none' }}>
                           <Music className="h-6 w-6" />
                        </div> */}
                  </div>
                 {/* Text Content */}
                 <div className="flex-1 min-w-0">
                   <p className="font-medium truncate text-sm leading-tight">{result.title}</p>
                   <p className="text-xs text-muted-foreground truncate">{result.author}</p>
                 </div>
                 {/* Add Button */}
                 <Button
                   variant="ghost"
                   size="icon"
                   className="h-8 w-8 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity" // Show on hover/focus
                   onClick={() => handleInitiateAddSong(result)}
                   aria-label={`Add "${result.title}" to playlist`}
                   disabled={isSelectPlaylistDialogOpen || (songToAdd !== null && songToAdd.id === result.videoId)}
                 >
                   <ListPlus className="h-5 w-5" />
                 </Button>
               </Card>
             ))}
           </div>
         )}

         {/* Show placeholder or "No results" message */}
         {!isLoading && !hasSearched && searchResults.length === 0 && renderPlaceholder()}
         {!isLoading && hasSearched && searchResults.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No results found.</p>
         )}
      </div>


      {/* Dialog remains the same */}
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
