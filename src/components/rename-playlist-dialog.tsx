// src/components/rename-playlist-dialog.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Playlist } from '@/lib/types'; // Import Playlist type

interface RenamePlaylistDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  playlist: Playlist; // The playlist to rename
  onRename: (newName: string) => void; // Callback with the new name
}

export function RenamePlaylistDialog({
  isOpen,
  onOpenChange,
  playlist,
  onRename
}: RenamePlaylistDialogProps) {
  const [playlistName, setPlaylistName] = useState(playlist.name);

  // Update input field if the playlist prop changes while dialog is open
  // or when dialog opens initially
  useEffect(() => {
    if (isOpen) {
      setPlaylistName(playlist.name);
    }
  }, [isOpen, playlist.name]);

  const handleRenameClick = () => {
    // No need to check if name changed here, let the parent handler do it
    onRename(playlistName.trim());
     // Let the parent handler close the dialog via onRename -> onOpenChange
  };

   const handleCancel = () => {
    // Resetting input is handled by the useEffect when isOpen changes
    onOpenChange(false);
  };

   // Handle Enter key press
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleRenameClick();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Playlist</DialogTitle>
          <DialogDescription>
            Enter a new name for the playlist "{playlist.name}".
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="playlist-rename-name" className="text-right">
              Name
            </Label>
            <Input
              id="playlist-rename-name"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              className="col-span-3"
              placeholder="New Playlist Name"
              onKeyDown={handleKeyDown}
              aria-label="New Playlist Name Input"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleRenameClick} disabled={!playlistName.trim()}>Rename</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}