'use client';

import React, { useState } from 'react';
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

interface CreatePlaylistDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}

export function CreatePlaylistDialog({ isOpen, onOpenChange, onCreate }: CreatePlaylistDialogProps) {
  const [playlistName, setPlaylistName] = useState('');

  const handleCreateClick = () => {
    if (playlistName.trim()) {
      onCreate(playlistName.trim());
      setPlaylistName(''); // Reset input after creation
      // onOpenChange(false); // Dialog closure handled by parent via onOpenChange
    }
  };

   const handleCancel = () => {
    setPlaylistName(''); // Reset input on cancel
    onOpenChange(false);
  };

   // Handle Enter key press
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleCreateClick();
    }
  };

  // Update local state when dialog opens/closes to reset input
  React.useEffect(() => {
      if (!isOpen) {
          setPlaylistName('');
      }
  }, [isOpen]);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Playlist</DialogTitle>
          <DialogDescription>
            Enter a name for your new playlist.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="playlist-name" className="text-right">
              Name
            </Label>
            <Input
              id="playlist-name"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              className="col-span-3"
              placeholder="My Awesome Mix"
              onKeyDown={handleKeyDown}
              aria-label="Playlist Name Input"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleCreateClick} disabled={!playlistName.trim()}>Create Playlist</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
