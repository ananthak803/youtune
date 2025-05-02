
'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Player } from '@/components/player';
import { PlaylistView } from '@/components/playlist-view';
import { AddSongForm } from '@/components/add-song-form'; // Re-import AddSongForm
import { YoutubeSearch } from '@/components/youtube-search'; // Import the search component
import { QueueView } from '@/components/queue-view'; // Import QueueView
import type { Playlist } from '@/lib/types';
import { usePlaylistStore } from '@/store/playlist-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator'; // Import Separator
import { Button } from '@/components/ui/button'; // Import Button
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetClose } from '@/components/ui/sheet'; // Import Sheet components
import { Plus, ListMusic, Search, Settings, ListOrdered } from 'lucide-react'; // Import required icons (incl ListOrdered)
import { useIsMobile } from '@/hooks/use-mobile'; // Import useIsMobile

export default function Home() {
  // Get state from the store
  const playlists = usePlaylistStore((state) => state.playlists);
  const activePlaylistId = usePlaylistStore((state) => state.activePlaylistId); // ID of the playlist being *viewed*
  const setActivePlaylistId = usePlaylistStore((state) => state.setActivePlaylistId); // Action to change *viewed* playlist

  // Local state to hold the currently selected playlist object for viewing
  const [selectedPlaylistForView, setSelectedPlaylistForView] = useState<Playlist | null>(null);
  const [isSearchSidebarOpen, setIsSearchSidebarOpen] = useState(false); // State for search sidebar
  const [isPlaylistSheetOpen, setIsPlaylistSheetOpen] = useState(false); // State for mobile playlist sheet
  const [isQueueSidebarOpen, setIsQueueSidebarOpen] = useState(false); // State for queue sidebar

  const isMobile = useIsMobile(); // Check if mobile

  // Effect to update the local state when the activePlaylistId changes in the store
  useEffect(() => {
    const newlySelectedPlaylist = playlists.find((p) => p.id === activePlaylistId) ?? null;
    setSelectedPlaylistForView(newlySelectedPlaylist);
  }, [activePlaylistId, playlists]);

  // Handler for selecting a playlist in the sidebar - now just updates the *viewed* playlist ID
  const handleSelectPlaylistForView = (playlist: Playlist) => {
    setActivePlaylistId(playlist.id); // This updates the store's activePlaylistId
     if (isMobile) {
       setIsPlaylistSheetOpen(false); // Close sheet on selection in mobile
     }
  };

  // Create playlist action is handled directly by the store via Sidebar component

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground overflow-hidden"> {/* Use dvh for dynamic viewport height */}
       {/* Header for Mobile */}
       {isMobile && (
         <header className="flex items-center justify-between p-3 border-b bg-card sticky top-0 z-20">
             <h1 className="text-xl font-bold text-primary">YouTune</h1>
             {/* Add Settings or other mobile header items here if needed */}
             {/* <Button variant="ghost" size="icon"><Settings className="h-5 w-5" /></Button> */}
         </header>
       )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (Hidden on Mobile, shown in Sheet) */}
         {!isMobile && (
             <Sidebar
               playlists={playlists}
               selectedPlaylistId={activePlaylistId} // Pass the active *viewed* ID for highlighting
               onSelectPlaylist={handleSelectPlaylistForView}
               // onCreatePlaylist is handled by store via Sidebar component
             />
          )}

        <main className="flex flex-1 flex-col overflow-hidden relative">
           {/* Button to open YouTube Search */}
           <Sheet open={isSearchSidebarOpen} onOpenChange={setIsSearchSidebarOpen}>
             <SheetTrigger asChild>
               <Button
                 variant="ghost"
                 size="sm"
                 className="absolute top-4 right-16 sm:right-20 z-10 text-muted-foreground hover:text-foreground flex items-center gap-2 px-3" // Adjusted position
                 aria-label="Search YouTube"
               >
                 <Search className="h-4 w-4" />
                 <span className="hidden sm:inline">Search</span> {/* Shorter text */}
               </Button>
             </SheetTrigger>
             <SheetContent side="right" className="w-full sm:max-w-lg md:max-w-xl flex flex-col p-0">
               <SheetHeader className="px-4 sm:px-6 pt-6 pb-4 border-b">
                  <SheetTitle>Search YouTube</SheetTitle>
                  <SheetDescription>
                    Find videos and add them to your playlists.
                  </SheetDescription>
                </SheetHeader>
               <div className="flex-1 overflow-hidden flex flex-col">
                  <YoutubeSearch />
               </div>
               <SheetClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                 <span className="sr-only">Close</span>
               </SheetClose>
             </SheetContent>
           </Sheet>

            {/* Button to open Queue */}
            <Sheet open={isQueueSidebarOpen} onOpenChange={setIsQueueSidebarOpen}>
             <SheetTrigger asChild>
                <Button
                 variant="ghost"
                 size="icon"
                 className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground" // Adjusted position
                 aria-label="Show queue"
                >
                 <ListOrdered className="h-5 w-5" />
                </Button>
             </SheetTrigger>
             <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
               <SheetHeader className="px-4 sm:px-6 pt-6 pb-4 border-b">
                 <SheetTitle>Playback Queue</SheetTitle>
                 <SheetDescription>See what's playing next.</SheetDescription>
               </SheetHeader>
               <QueueView /> {/* Add QueueView */}
                <SheetClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                 <span className="sr-only">Close</span>
               </SheetClose>
             </SheetContent>
           </Sheet>

          <ScrollArea className="flex-1">
            <div className="container mx-auto px-4 pt-16 pb-8 md:px-8">

              {/* Add Song Form (via URL) */}
              <AddSongForm />
              <Separator className="my-8" />

              {/* Playlist View Section */}
              {selectedPlaylistForView ? (
                // Pass the locally tracked selected playlist object to PlaylistView
                <PlaylistView playlist={selectedPlaylistForView} />
              ) : (
                 <div className="flex h-[50vh] items-center justify-center text-muted-foreground text-center px-4"> {/* Centered text */}
                  <p>Select or create a playlist to get started.</p>
                 </div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
      {/* Player */}
      <Player />

       {/* Mobile Bottom Navigation */}
       {isMobile && (
         <nav className="flex justify-around items-center p-2 border-t bg-card sticky bottom-0 z-20">
           {/* Button to open playlists sheet */}
            <Sheet open={isPlaylistSheetOpen} onOpenChange={setIsPlaylistSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="flex flex-col h-auto items-center gap-1 text-muted-foreground text-xs">
                   <ListMusic className="h-5 w-5" />
                   Playlists
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-4/5 max-w-xs p-0"> {/* Adjust width and padding */}
                 <Sidebar
                   playlists={playlists}
                   selectedPlaylistId={activePlaylistId}
                   onSelectPlaylist={handleSelectPlaylistForView}
                 />
              </SheetContent>
            </Sheet>
           {/* Button to open search sheet */}
           <Button
             variant="ghost"
             size="sm"
             onClick={() => setIsSearchSidebarOpen(true)}
             className="flex flex-col h-auto items-center gap-1 text-muted-foreground text-xs"
           >
             <Search className="h-5 w-5" />
             Search
           </Button>
           {/* Button to open queue sheet */}
           <Button
             variant="ghost"
             size="sm"
             onClick={() => setIsQueueSidebarOpen(true)}
             className="flex flex-col h-auto items-center gap-1 text-muted-foreground text-xs"
           >
             <ListOrdered className="h-5 w-5" />
             Queue
           </Button>
           {/* Add other mobile navigation items here if needed */}
         </nav>
       )}
    </div>
  );
}

