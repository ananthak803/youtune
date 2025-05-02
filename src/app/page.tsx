
'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Player } from '@/components/player';
import { PlaylistView } from '@/components/playlist-view';
import { AddSongForm } from '@/components/add-song-form';
import { YoutubeSearch } from '@/components/youtube-search'; // Import the new component
import type { Playlist } from '@/lib/types';
import { usePlaylistStore } from '@/store/playlist-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator'; // Import Separator

export default function Home() {
  // Get state from the store
  const playlists = usePlaylistStore((state) => state.playlists);
  const activePlaylistId = usePlaylistStore((state) => state.activePlaylistId); // ID of the playlist being *viewed*
  const setActivePlaylistId = usePlaylistStore((state) => state.setActivePlaylistId); // Action to change *viewed* playlist

  // Local state to hold the currently selected playlist object for viewing
  const [selectedPlaylistForView, setSelectedPlaylistForView] = useState<Playlist | null>(null);

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
        <main className="flex flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="container mx-auto px-4 py-8 md:px-8">
              {/* AddSongForm doesn't need the viewed playlist ID for adding songs anymore */}
              <AddSongForm selectedPlaylistId={null} />

              {/* YouTube Search Section */}
              <YoutubeSearch />

              <Separator className="my-8" /> {/* Add a separator */}

              {/* Playlist View Section */}
              {selectedPlaylistForView ? (
                // Pass the locally tracked selected playlist object to PlaylistView
                <PlaylistView playlist={selectedPlaylistForView} />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
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
