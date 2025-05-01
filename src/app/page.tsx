'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Player } from '@/components/player';
import { PlaylistView } from '@/components/playlist-view';
import { AddSongForm } from '@/components/add-song-form';
import type { Playlist, Song } from '@/lib/types';
import { usePlaylistStore } from '@/store/playlist-store';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Home() {
  const playlists = usePlaylistStore((state) => state.playlists);
  const activePlaylistId = usePlaylistStore((state) => state.activePlaylistId);
  const setActivePlaylistId = usePlaylistStore(
    (state) => state.setActivePlaylistId
  );
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    playlists.find((p) => p.id === activePlaylistId) ?? playlists[0] ?? null
  );

  const handleSelectPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setActivePlaylistId(playlist.id);
  };

  const handleCreatePlaylist = (name: string) => {
    // Logic to create a new playlist will be handled by the store
    // Selecting the new playlist can be done here if needed after creation
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          playlists={playlists}
          selectedPlaylistId={selectedPlaylist?.id ?? null}
          onSelectPlaylist={handleSelectPlaylist}
          onCreatePlaylist={handleCreatePlaylist}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="container mx-auto px-4 py-8 md:px-8">
              <AddSongForm
                selectedPlaylistId={selectedPlaylist?.id ?? null}
              />
              {selectedPlaylist ? (
                <PlaylistView playlist={selectedPlaylist} />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <p>Select or create a playlist to get started.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
      <Player />
    </div>
  );
}
