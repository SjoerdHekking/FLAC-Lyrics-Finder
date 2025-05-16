const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');
const colors = require('colors');
const yargs = require('yargs');

const argv = yargs
    .option('debug', {
        alias: 'd',
        type: 'boolean',
        description: 'Enable debug mode',
        default: false,
    })
    .option('dir', {
        alias: 'directory',
        type: 'string',
        description: 'Specify directory',
        default: __dirname,
    })
    .help()
    .alias('help', 'h')
    .argv;

const DEBUG = argv.debug;
const rootDir = argv.dir;

if (DEBUG) console.log(colors.yellow(`Using directory: ${rootDir}`));

const headers = {
    'User-Agent': 'FLAC-Lyrics-Finder (https://github.com/SjoerdHekking/FLAC-Lyrics-Finder)'
};

function getMetadata(filePath) {
    try {
        const fields = {
            title: '',
            artist: '',
            album: ''
        };

        const ffprobeCommand = `ffprobe -v quiet -show_entries format_tags=artist,album,title "${filePath}"`;
        const ffprobeOutput = execSync(ffprobeCommand, { encoding: 'utf8' });

        ffprobeOutput.split('\n').forEach(line => {
            const match = line.match(/^TAG:(TITLE|ARTIST|ALBUM)=(.*)$/);
            if (match) {
                const propertyName = match[1].toLowerCase();
                const propertyValue = match[2];
                fields[propertyName] = propertyValue;
            }
        });

        if (Object.keys(fields).length === 3) {
            return fields;
        } else {
            if (DEBUG) console.warn(colors.yellow(`Unexpected metadata format for file: ${filePath}`));
            return null;
        }
    } catch (error) {
        if (DEBUG) console.error(colors.red(`Failed to extract metadata for file: ${filePath}\n${error.message}`));
        return null;
    }
}

function uriEscape(str) {
    return encodeURIComponent(str);
}

async function fetchLyrics(artist, title, album) {
    const apiUrl = `https://lrclib.net/api/get?artist_name=${uriEscape(artist)}&track_name=${uriEscape(title)}&album_name=${uriEscape(album)}`;
    try {
        const response = await axios.get(apiUrl, { headers });
        return response.data;
    } catch (error) {
        if (DEBUG) console.error(colors.red(`Failed to fetch lyrics from /api/get: ${apiUrl}\n${error.message}`));
        return null;
    }
}

async function fetchFallbackLyrics(title, artist, album) {
    const apiUrl = `https://lrclib.net/api/search?track_name=${uriEscape(title)}&artist_name=${uriEscape(artist)}&album_name=${uriEscape(album)}`;
    const apiUrlNoAlbum = `https://lrclib.net/api/search?track_name=${uriEscape(title)}&artist_name=${uriEscape(artist)}`;

    try {
        const response = await axios.get(apiUrl, { headers });
        const results = response.data;

        if (Array.isArray(results) && results.length > 0) {
            if (DEBUG) console.log(colors.magenta(`Fallback search with album returned ${results.length} result(s). Using the first result.`));
            return results[0];
        } else {
            if (DEBUG) console.warn(colors.yellow(`Fallback search with album found no results for '${title}'.`));
        }
    } catch (error) {
        if (DEBUG) console.error(colors.red(`Failed to fetch lyrics from /api/search with album: ${apiUrl}\n${error.message}`));
    }

    try {
        const responseNoAlbum = await axios.get(apiUrlNoAlbum, { headers });
        const resultsNoAlbum = responseNoAlbum.data;

        if (Array.isArray(resultsNoAlbum) && resultsNoAlbum.length > 0) {
            if (DEBUG) console.log(colors.magenta(`Fallback search without album returned ${resultsNoAlbum.length} result(s). Using the first result.`));
            return resultsNoAlbum[0];
        } else {
            if (DEBUG) console.warn(colors.yellow(`Fallback search without album found no results for '${title}'.`));
            return null;
        }
    } catch (error) {
        if (DEBUG) console.error(colors.red(`Failed to fetch lyrics from /api/search without album: ${apiUrlNoAlbum}\n${error.message}`));
        return null;
    }
}

async function processFile(filePath) {
    const metadata = getMetadata(filePath);
    if (!metadata) {
        if (DEBUG) console.warn(colors.yellow(`Skipping file due to metadata extraction failure: ${filePath}`));
        return;
    }

    let { title, artist, album } = metadata;
    if (DEBUG) console.log(colors.cyan(`Extracted metadata: Title='${title}', Artist='${artist}', Album='${album}'`));

    if (!artist || !title) {
        if (DEBUG) console.warn(colors.yellow(`Incomplete metadata for '${filePath}'. Skipping...`));
        return;
    }

    const artists = artist.split(/[,;]/).map(a => a.trim());
    if (DEBUG) console.log(colors.cyan(`Artists found: ${artists.join(', ')}`));

    const lyricsFilePath = path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}.lrc`);
    if (fs.existsSync(lyricsFilePath)) {
        if (DEBUG) console.log(colors.yellow(`Lyrics file already exists for '${title}'. Skipping...`));
        return;
    }

    let lyricsFound = false;
    let instrumental = false;
    for (const currentArtist of artists) {
        if (DEBUG) console.log(colors.cyan(`Trying to fetch lyrics with artist='${currentArtist}' and title='${title}'`));
        const response = await fetchLyrics(currentArtist, title, album);

        if (response) {
            if (response.syncedLyrics) {
                fs.writeFileSync(lyricsFilePath, response.syncedLyrics, 'utf8');
                if (DEBUG) console.log(colors.green(`Downloaded synced lyrics for '${currentArtist} - ${title}'`));
                lyricsFound = true;
                break;
            } else if (response.plainLyrics) {
                fs.writeFileSync(lyricsFilePath, response.plainLyrics, 'utf8');
                if (DEBUG) console.log(colors.green(`Downloaded plain lyrics for '${currentArtist} - ${title}'`));
                lyricsFound = true;
                break;
            }
        } else {
            if (DEBUG) {
                if (artists.length === 1) {
                    console.log(colors.yellow(`Lyrics not found for '${currentArtist} - ${title}'.`));
                } else {
                    console.log(colors.yellow(`Lyrics not found for '${currentArtist} - ${title}'. Trying next artist...`));
                }
            }
        }        

        if (response && response.instrumental) {
            instrumental = true;
        }
    }

    if (!lyricsFound) {
        if (DEBUG) console.log(colors.magenta(`No lyrics found using /api/get. Attempting fallback search for '${title}'...`));
        const fallbackResponse = await fetchFallbackLyrics(title, artist, album);

        if (fallbackResponse) {
            if (fallbackResponse.syncedLyrics) {
                fs.writeFileSync(lyricsFilePath, fallbackResponse.syncedLyrics, 'utf8');
                if (DEBUG) console.log(colors.green(`Fallback: Downloaded synced lyrics for '${fallbackResponse.artistName} - ${fallbackResponse.trackName}'`));
                lyricsFound = true;
            } else if (fallbackResponse.plainLyrics) {
                fs.writeFileSync(lyricsFilePath, fallbackResponse.plainLyrics, 'utf8');
                if (DEBUG) console.log(colors.green(`Fallback: Downloaded plain lyrics for '${fallbackResponse.artistName} - ${fallbackResponse.trackName}'`));
                lyricsFound = true;
            }
        }
    }

    if (!lyricsFound) {
        if (DEBUG) {
            if (instrumental) {
                console.log(colors.yellow(`The lyrics were not found for '${title}' because this is an instrumental track.`));
            } else {
                console.warn(colors.red(`Lyrics not found for '${title}' with any of the provided artists: ${artists.join(', ')}`));
            }
        }
    }
}

(async function main() {
    const flacFiles = [];
    const gatherFlacFiles = (dir) => {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        items.forEach(item => {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                gatherFlacFiles(fullPath);
            } else if (path.extname(item.name).toLowerCase() === '.flac') {
                flacFiles.push(fullPath);
            }
        });
    };
    gatherFlacFiles(rootDir);

    if (DEBUG) console.log(colors.cyan(`Found ${flacFiles.length} .flac files.`));

    for (let i = 0; i < flacFiles.length; i++) {
        const file = flacFiles[i];

        if (DEBUG) {
            console.log(colors.cyan(`Processing file: ${file}`));
        } else {
            process.stdout.write(`\rProgress: ${i + 1}/${flacFiles.length}`);
        }

        await processFile(file);

        if (DEBUG) {
            console.log('');
        }
    }

    if (!DEBUG) {
        process.stdout.write('\r');
    }
    console.log(colors.green('Processing completed.'));
})();
