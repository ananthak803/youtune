
'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Player } from '@/components/player';
import { PlaylistView } from '@/components/playlist-view';
import { AddSongForm } from '@/components/add-song-form';
import { YoutubeSearch } from '@/components/youtube-search'; // Import the search component
import type { Playlist } from '@/lib/types';
import { usePlaylistStore } from '@/store/playlist-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator'; // Import Separator
import { Button } from '@/components/ui/button'; // Import Button
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet'; // Import Sheet components
import { Youtube } from 'lucide-react'; // Import Youtube icon

export default function Home() {
  // Get state from the store
  const playlists = usePlaylistStore((state) => state.playlists);
  const activePlaylistId = usePlaylistStore((state) => state.activePlaylistId); // ID of the playlist being *viewed*
  const setActivePlaylistId = usePlaylistStore((state) => state.setActivePlaylistId); // Action to change *viewed* playlist

  // Local state to hold the currently selected playlist object for viewing
  const [selectedPlaylistForView, setSelectedPlaylistForView] = useState<Playlist | null>(null);
  const [isSearchSidebarOpen, setIsSearchSidebarOpen] = useState(false); // State for search sidebar

  // Effect to update the local state when the activePlaylistId changes in the store
  useEffect(() => {
    const newlySelectedPlaylist = playlists.find((p) => p.id === activePlaylistId) ?? null;
    setSelectedPlaylistForView(newlySelectedPlaylist);
  }, [activePlaylistId, playlists]);

  // Handler for selecting a playlist in the sidebar - now just updates the *viewed* playlist ID
  const handleSelectPlaylistForView = (playlist: Playlist) => {
    setActivePlaylistId(playlist.id); // This updates the store's activePlaylistId
  };

  // Create playlist action is handled directly by the store via Sidebar component

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          playlists={playlists}
          selectedPlaylistId={activePlaylistId} // Pass the active *viewed* ID for highlighting
          onSelectPlaylist={handleSelectPlaylistForView}
          // onCreatePlaylist is handled by store via Sidebar component
        />
        <main className="flex flex-1 flex-col overflow-hidden relative"> {/* Added relative positioning */}
           {/* Search Sidebar Trigger Button */}
           <Sheet open={isSearchSidebarOpen} onOpenChange={setIsSearchSidebarOpen}>
             <SheetTrigger asChild>
               <Button
                 variant="ghost"
                 size="icon"
                 className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground" // Positioned top-right
                 aria-label="Open YouTube Search"
               >
                 <Youtube className="h-5 w-5" />
               </Button>
             </SheetTrigger>
             {/* Adjust SheetContent: remove padding, use flex, and let YoutubeSearch handle scrolling */}
             <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0"> {/* Removed default padding */}
                {/* Keep Header for title, but add padding here */}
               <SheetHeader className="px-6 pt-6 pb-4 border-b"> {/* Add padding and border to header */}
                 <SheetTitle>Search YouTube</SheetTitle>
                 <SheetDescription>
                   Find videos and add them to your playlists.
                 </SheetDescription>
               </SheetHeader>
               {/* YoutubeSearch component now manages its own layout and scrolling within this container */}
               <div className="flex-1 overflow-hidden flex flex-col px-4"> {/* Add padding around search content */}
                  <YoutubeSearch />
               </div>
             </SheetContent>
           </Sheet>

          <ScrollArea className="flex-1">
            <div className="container mx-auto px-4 py-8 md:px-8">
              {/* AddSongForm doesn't need the viewed playlist ID for adding songs anymore */}
              <AddSongForm selectedPlaylistId={null} />

              <Separator className="my-8" /> {/* Add a separator */}

              {/* Playlist View Section */}
              {selectedPlaylistForView ? (
                // Pass the locally tracked selected playlist object to PlaylistView
                <PlaylistView playlist={selectedPlaylistForView} />
              ) : (
                <div className="flex h-[50vh] items-center justify-center text-muted-foreground"> {/* Added height */}
                  <p>Select or create a playlist to get started.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
      {/* Player is independent and uses its own state from the store */}
      <Player />
    </div>
  );
}
