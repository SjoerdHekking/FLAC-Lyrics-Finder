# Lyrics Fetcher for FLAC Files

This script extracts metadata from FLAC files, searches for lyrics using an external API, and saves the lyrics in `.lrc` files alongside the corresponding FLAC files. It also supports a fallback search if the primary method fails.

## Features

- Extracts metadata (title, artist, album) from FLAC files.
- Searches for synced lyrics using the [lrclib.net](https://ffmpeg.org/download.html) API.
- Supports fallback lyrics search when the primary search fails.
- Handles multiple artists for a single track.
- Optionally runs in debug mode to provide more verbose logging.
- Tracks progress of processing FLAC files and saves lyrics as `.lrc` files.

## Prerequisites

Before running the script, make sure you have the following installed:

1. **FFmpeg**: The script uses `ffprobe` (part of the FFmpeg suite) to extract metadata from FLAC files. You need to have the FFmpeg binaries installed and added to your system’s `PATH`.

    ### Windows Installation
    - Download the FFmpeg binaries from the [official website](https://ffmpeg.org/download.html).
    - Extract the files and add the `bin` folder to your system’s `PATH` environment variable:
      - Right-click on **This PC** > **Properties** > **Advanced system settings**.
      - Click **Environment Variables**, under **System variables**, select **Path**, and click **Edit**.
      - Add the path to the `bin` folder of FFmpeg (e.g., `C:\ffmpeg\bin`).
      
    ### macOS/Linux Installation
    - You can install FFmpeg using `brew` (macOS) or your package manager (Linux):
      - **macOS**: `brew install ffmpeg`
      - **Ubuntu**: `sudo apt install ffmpeg`

2. **Node.js**: Ensure Node.js is installed. You can download it from [nodejs.org](https://nodejs.org/).

3. **Required Node Packages**:
    - `axios`: For making HTTP requests to fetch lyrics.
    - `yargs`: For parsing command-line arguments.
    - `colors`: For colorizing the console output.
    - `child_process` and `fs`: For interacting with the filesystem and running commands.

    To install the necessary packages, run the following:

    ```bash
    npm install
    ```

## Usage

### Running the Script

To run the script, you can use the following command:

```bash
node processLyrics.js --dir="C:/path/to/your/music/folder"
```
### Where:
- `--dir="C:/path/to/your/music/folder"`: Specifies the directory to scan for .flac files. If not provided, the script will default to the current directory (`__dirname`).
- `--debug`: Optional flag to enable debug mode, which outputs detailed logs about the script's progress.

### Example:
```bash
node processLyrics.js --debug --dir="C:/Users/YourUsername/Music"
```
This will process all .flac files in the specified directory and its subdirectories, trying to fetch lyrics for each song. The progress will be displayed, and additional details will be shown in debug mode.

### Additionally

The script can also be run from the provided NPM commands, albeit simple, they should work, but do not specify a directory, so the current directory is used.

## Script Behavior

1. The script will first attempt to fetch lyrics using the lrclib.net API (`/api/get`).
2. If not lyrics are found, but more artists are present, it will try to fetch the lyrics with a different artist.
3. If lyrics are not found, it will try a fallback search (different API; `/api/search`) with and without the album removed from the query.
4. Lyrics will be saved as .lrc files in the same directory as the .flac files.

### Example Output:

```bash
Progress: 20/20
Processing completed.
```

### Debug Mode Output:

```bash
Using directory: C:/Users/YourUsername/Music
Found 20 .flac files.
Processing file: C:\Users\YourUsername\Music\Artist\Artist - Album\song.flac
Extracted metadata: Title='song', Artist='Artist', Album='Album'
Artists found: Artist
Trying to fetch lyrics with artist='Artist' and title='song'
Failed to fetch lyrics from /api/get: https://lrclib.net/api/get?artist_name=Artist&track_name=song&album_name=album
Request failed with status code 404
Lyrics not found for 'Artist - song'.
No lyrics found using /api/get. Attempting fallback search for 'song'...
Fallback search with album found no results for 'song'.
Fallback search without album returned 1 result(s). Using the first result.
Fallback: Downloaded synced lyrics for 'Artist - song'
```
## Notes

- If lyrics are found, they will be saved in .lrc files in the same folder as the corresponding .flac file.
- If no lyrics are found for a track, the script will output a warning in debug mode.
- Instrumental tracks will be skipped.

## Troubleshooting

- No Lyrics Found: If no lyrics are found for a song, ensure that the metadata (artist, album, title) is correct and complete.
- FFmpeg Not Installed: Ensure that the FFmpeg binaries are correctly installed and added to the PATH environment variable.
- API Limitations: The lrclib.net API may not have lyrics for all tracks. Consider trying other lyric APIs or services if necessary.

## License
This project is open source and available under the MIT License.
