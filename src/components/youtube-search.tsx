
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
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { searchYoutubeAction, getYoutubeMetadataAction } from '@/actions/youtube-actions';
import type { YoutubeSearchResult, Song, Playlist, YoutubeVideoMetadata } from '@/lib/types';
import { usePlaylistStore } from '@/store/playlist-store';
import { SelectPlaylistDialog } from './select-playlist-dialog';
import { ListPlus, Search, Loader2, Music, Youtube } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';


const searchSchema = z.object({
  query: z.string().min(1, { message: 'Please enter a search term.' }),
});

type SearchFormValues = z.infer<typeof searchSchema>;

export function YoutubeSearch() {
  const { toast } = useToast();
  const { addSongToPlaylist, createPlaylist } = usePlaylistStore.getState();

  const [searchResults, setSearchResults] = useState<YoutubeSearchResult[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<string | null>(null); // Track loading state per item
  const [isSelectPlaylistDialogOpen, setIsSelectPlaylistDialogOpen] = useState(false);
  const [songToAdd, setSongToAdd] = useState<Song | null>(null);
  const [hasSearched, setHasSearched] = useState(false); // Track if a search has been performed

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      query: '',
    },
  });

  async function onSubmit(values: SearchFormValues) {
    setIsLoadingSearch(true);
    setHasSearched(true); // Mark that a search has been initiated
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
      setSearchResults([]); // Clear results on error
    } finally {
      setIsLoadingSearch(false);
    }
  }

  // Fetch full metadata for a single video ID
  const fetchMetadata = async (videoId: string): Promise<Song | null> => {
    setIsLoadingMetadata(videoId); // Set loading state for this specific item
    try {
      const metadata: YoutubeVideoMetadata = await getYoutubeMetadataAction(videoId);
      const song: Song = {
        id: videoId,
        title: metadata.title,
        author: metadata.author,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl: metadata.thumbnailUrl,
      };
      return song;
    } catch (error: any) {
      console.error('Error fetching metadata for search result:', error);
      toast({
        title: 'Error Fetching Video Info',
        description: error.message || 'Could not fetch video details.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoadingMetadata(null); // Clear loading state for this item
    }
  };

  // Initiate adding process (fetch metadata, then handle playlist selection)
  const handleInitiateAddSong = async (result: YoutubeSearchResult) => {
    const preparedSong = await fetchMetadata(result.videoId);
    if (!preparedSong) return; // Stop if metadata fetch failed

    setSongToAdd(preparedSong); // Store the song data temporarily

    // Check playlist state
    const currentPlaylists = usePlaylistStore.getState().playlists;
    if (currentPlaylists.length === 0) {
        // Create default playlist and add song directly
        const defaultPlaylistName = "My Playlist";
        createPlaylist(defaultPlaylistName);
        const updatedPlaylists = usePlaylistStore.getState().playlists; // Get updated state
        if (updatedPlaylists.length > 0) {
             const newPlaylistId = updatedPlaylists[0].id;
             addSongToSpecificPlaylist(newPlaylistId, preparedSong, defaultPlaylistName);
        } else {
             console.error("[YoutubeSearch] Failed to create or find the new default playlist.");
             toast({ title: "Error", description: "Could not create default playlist.", variant: "destructive" });
             setSongToAdd(null);
        }
    } else if (currentPlaylists.length === 1) {
      // Add directly to the only existing playlist
      addSongToSpecificPlaylist(currentPlaylists[0].id, preparedSong, currentPlaylists[0].name);
    } else {
      // Open dialog to select playlist
      setIsSelectPlaylistDialogOpen(true);
    }
  };

  // Called from SelectPlaylistDialog or directly if only one/default playlist
  const addSongToSpecificPlaylist = (playlistId: string, song: Song, playlistName?: string) => {
    const added = addSongToPlaylist(playlistId, song); // Use store action
    if (added) {
      toast({
        title: 'Song Added',
        description: `"${song.title}" added to playlist "${playlistName || 'Selected Playlist'}".`,
      });
    }
    setSongToAdd(null); // Clear temporary song data
    setIsSelectPlaylistDialogOpen(false); // Ensure dialog is closed
  };

  // Handle selection from the playlist dialog
  const handlePlaylistSelected = (playlistId: string) => {
    if (songToAdd) {
       const selectedPlaylist = usePlaylistStore.getState().playlists.find(p => p.id === playlistId);
      addSongToSpecificPlaylist(playlistId, songToAdd, selectedPlaylist?.name);
    } else {
      // Should not happen, but handle defensively
      console.error("[YoutubeSearch] Error: No song data available when playlist was selected.");
      toast({ title: "Error", description: "Could not add song. Please try again.", variant: "destructive" });
      setIsSelectPlaylistDialogOpen(false);
      setSongToAdd(null);
    }
  };

  // Render placeholder when no search has been done
  const renderPlaceholder = () => (
     <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-4 text-center p-8 select-none">
        <Youtube className="w-16 h-16 opacity-30 text-destructive" />
        <p className="text-base font-medium">Search YouTube</p>
        <p className="text-sm">Find videos and add them directly to your playlists.</p>
     </div>
  );

  // Render loading state during search
  const renderLoading = () => (
    <div className="flex justify-center items-center py-12 flex-col gap-4">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
        <p className="text-muted-foreground">Searching...</p>
    </div>
  );

  // Render "No results" message
   const renderNoResults = () => (
     <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-2 text-center p-8 select-none">
       <Search className="w-12 h-12 opacity-30" />
       <p className="text-sm mt-2">No results found.</p>
       <p className="text-xs text-muted-foreground/80">Try searching for something else.</p>
     </div>
   );

  return (
    <>
      {/* Search Form */}
      <Form {...form}>
        {/* Sticky form part */}
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="p-4 sticky top-0 bg-background/95 backdrop-blur-sm border-b z-10 mb-4"
        >
          <div className="flex items-center gap-2">
            <FormField
              control={form.control}
              name="query"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="sr-only">Search Term</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search videos..."
                        {...field}
                        disabled={isLoadingSearch}
                        aria-label="YouTube Search Input"
                        className="h-9 pl-8 rounded-md focus-visible:ring-primary bg-muted border-transparent focus:border-border focus:bg-background"
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs mt-1" />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoadingSearch} aria-label="Search YouTube" size="icon" className="h-9 w-9 flex-shrink-0">
              {isLoadingSearch ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
              <span className="sr-only">Search</span>
            </Button>
          </div>
        </form>
      </Form>

      {/* Results Area - Scrollable */}
      <ScrollArea className="flex-1 px-4 pb-6">
         {isLoadingSearch && renderLoading()}

         {!isLoadingSearch && searchResults.length > 0 && (
           <div className="space-y-3">
             {searchResults.map((result) => (
               <Card key={result.videoId} className="group overflow-hidden transition-shadow hover:shadow-md border border-transparent hover:border-border bg-card/50 hover:bg-card">
                 <CardContent className="p-0 flex items-center gap-3">
                   {/* Image */}
                   <div className="w-20 h-16 sm:w-24 sm:h-[68px] flex-shrink-0 relative bg-muted overflow-hidden rounded-l-md">
                     <Image
                       src={result.thumbnailUrl || '/placeholder-album.svg'}
                       alt={result.title}
                       fill
                       sizes="(max-width: 640px) 80px, 96px"
                       className="object-cover transition-transform group-hover:scale-105"
                       data-ai-hint="youtube video thumbnail"
                       unoptimized
                       onError={(e) => {
                         e.currentTarget.style.display = 'none'; // Hide broken image
                         const parent = e.currentTarget.parentElement;
                         // Add placeholder icon if not already present
                         if (parent && !parent.querySelector('.placeholder-icon')) {
                           const icon = document.createElement('div');
                           icon.className = 'placeholder-icon absolute inset-0 flex items-center justify-center text-muted-foreground bg-muted';
                           icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-music h-6 w-6 opacity-50"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
                           parent.appendChild(icon);
                         }
                       }}
                     />
                   </div>
                   {/* Text Content */}
                   <div className="flex-1 min-w-0 py-2 pr-2">
                     {/* Title with line clamping */}
                     <p className="font-medium text-sm leading-snug line-clamp-2 mb-0.5 group-hover:text-primary transition-colors">{result.title}</p>
                     {/* Author with line clamping */}
                     <p className="text-xs text-muted-foreground line-clamp-1">{result.author}</p>
                   </div>
                   {/* Add Button */}
                   <div className="pr-3 pl-1 flex-shrink-0">
                       <Button
                         variant="ghost"
                         size="icon"
                         className={cn(
                            "h-8 w-8 text-muted-foreground transition-opacity",
                            "hover:bg-accent/50 hover:text-accent-foreground",
                             isLoadingMetadata === result.videoId && "cursor-not-allowed opacity-50" // Specific loading state
                         )}
                         onClick={() => handleInitiateAddSong(result)}
                         aria-label={`Add "${result.title}" to playlist`}
                         disabled={!!isLoadingMetadata} // Disable if *any* metadata is loading
                       >
                         {isLoadingMetadata === result.videoId ? (
                             <Loader2 className="h-5 w-5 animate-spin"/>
                         ) : (
                             <ListPlus className="h-5 w-5" /> // Use ListPlus icon
                         )}
                       </Button>
                   </div>
                 </CardContent>
               </Card>
             ))}
           </div>
         )}

         {/* Placeholder or "No results" message */}
         {!isLoadingSearch && !hasSearched && searchResults.length === 0 && renderPlaceholder()}
         {!isLoadingSearch && hasSearched && searchResults.length === 0 && renderNoResults()}
      </ScrollArea>

      {/* Playlist Selection Dialog */}
      <SelectPlaylistDialog
        isOpen={isSelectPlaylistDialogOpen}
        onOpenChange={(open) => {
          setIsSelectPlaylistDialogOpen(open);
          if (!open) {
            setSongToAdd(null); // Clear song if dialog is closed without selection
          }
        }}
        playlists={usePlaylistStore(state => state.playlists)}
        onSelectPlaylist={handlePlaylistSelected}
        songTitle={songToAdd?.title}
      />
    </>
  );
}
