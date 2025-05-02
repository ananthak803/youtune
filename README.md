# Firebase Studio - YouTune

This is a NextJS starter in Firebase Studio, creating a Spotify-like app ("YouTune") using YouTube for audio playback.

To get started, take a look at src/app/page.tsx.

## Features

*   Create and manage playlists.
*   Add songs to playlists using YouTube URLs.
*   Search YouTube for songs directly within the app and add them to playlists.
*   Playback controls (play, pause, next, previous, shuffle, loop).
*   Volume control and mute.
*   Song progress bar.
*   Drag-and-drop reordering of songs within a playlist.
*   Dark theme UI.

## Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Environment Variables:**
    *   Create a `.env.local` file in the root of the project.
    *   Add your Google Generative AI API key:
        ```
        GOOGLE_GENAI_API_KEY=YOUR_GOOGLE_GENAI_API_KEY
        ```
    *   **IMPORTANT:** Add your YouTube Data API v3 key. This is required for searching YouTube and fetching video metadata (titles, thumbnails). You can obtain one from the Google Cloud Console.
        ```
        YOUTUBE_API_KEY=YOUR_YOUTUBE_DATA_API_KEY
        ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:9002`.

4.  **(Optional) Run Genkit Development UI:**
    If you are developing AI flows, you can run the Genkit development UI separately:
    ```bash
    npm run genkit:dev
    # or for auto-reloading on changes:
    # npm run genkit:watch
    ```
    This typically runs on `http://localhost:4000`.

## Building for Production

```bash
npm run build
npm start
```