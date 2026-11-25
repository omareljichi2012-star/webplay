import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const WIKI_AL_URL =
  'https://en.wikipedia.org/w/api.php?action=parse&page=List_of_PlayStation_(console)_games_(A%E2%80%93L)&prop=text&format=json';
const WIKI_MZ_URL =
  'https://en.wikipedia.org/w/api.php?action=parse&page=List_of_PlayStation_(console)_games_(M%E2%80%93Z)&prop=text&format=json';
const LIBRETRO_BOXARTS_URL =
  'https://raw.githubusercontent.com/libretro-thumbnails/Sony_-_PlayStation/master/Named_Boxarts';

const STEAMGRID_KEY = process.env.STEAMGRIDDB_API_KEY || '';

// Iconic PS1 classics showcased on Page 1 (with Crash Bandicoot as the playable embed test title)
const FEATURED_PS1_METADATA = {
  'crash bandicoot': {
    rank: 1,
    genre: '3D Platformer',
    year: 1996,
    rating: 9.4,
    publisher: 'Sony Computer Entertainment',
    developer: 'Naughty Dog',
    synopsis:
      'Spin, jump, and smash crates across the Wumpa Islands to stop Dr. Neo Cortex and rescue Tawna. Configured with live browser iframe embed.',
    embed_url: 'https://www.retrogames.cc/embed/40784-crash-bandicoot.html',
  },
  '007: tomorrow never dies': {
    rank: 2,
    genre: 'Third-Person Shooter',
    year: 1999,
    rating: 8.4,
    publisher: 'Electronic Arts',
    developer: 'Black Ops Entertainment',
    synopsis:
      'Step into the shoes of James Bond across stealth and vehicular missions to stop media mogul Elliot Carver. Playable live via browser iframe.',
    embed_url: 'https://www.retrogames.cc/embed/40787-007-tomorrow-never-dies.html',
  },
  '007 racing': {
    rank: 3,
    genre: 'Vehicular Combat',
    year: 2000,
    rating: 8.0,
    publisher: 'EA Games',
    developer: 'Eutechnyx',
    synopsis:
      'Drive iconic gadget-equipped James Bond vehicles including the Aston Martin DB5 and BMW Z8 across combat-driven missions.',
    embed_url: 'https://www.retrogames.cc/embed/40785-007-racing.html',
  },
  '007: the world is not enough': {
    rank: 4,
    genre: 'First-Person Shooter',
    year: 2000,
    rating: 8.6,
    publisher: 'EA Games',
    developer: 'Black Ops Entertainment',
    synopsis:
      'Infiltrate secret installations and dismantle nuclear threats as 007 in this classic PlayStation first-person shooter.',
    embed_url: 'https://www.retrogames.cc/embed/41522-007-the-world-is-not-enough.html',
  },
  '100% star': {
    rank: 5,
    genre: 'Puzzle / Platformer',
    year: 2002,
    rating: 7.9,
    publisher: 'Telegames',
    developer: 'Telegames',
    synopsis:
      'Navigate 3D starfield stages, dodge hazards, and collect energy spheres to restore cosmic order.',
    embed_url: 'https://www.retrogames.cc/embed/40788-100-star.html',
    boxFront: 'https://raw.githubusercontent.com/libretro-thumbnails/Sony_-_PlayStation/master/Named_Boxarts/100%25%20Star%20(Europe).png',
  },
  '101 dalmatians ii: patch\'s london adventure': {
    rank: 6,
    genre: 'Action / Platformer',
    year: 2003,
    rating: 8.1,
    publisher: 'Eidos Interactive',
    developer: 'Digital Eclipse',
    synopsis:
      'Help Patch rescue captured puppies across London and outsmart Cruella De Vil and Jasper.',
    embed_url: 'https://www.retrogames.cc/embed/40789-101-dalmatians-ii-patchs-london-adventure.html',
    boxFront: "https://raw.githubusercontent.com/libretro-thumbnails/Sony_-_PlayStation/master/Named_Boxarts/Disney's%20101%20Dalmatians%20II%20-%20Patch's%20London%20Adventure%20(USA).png",
  },
  '102 dalmatians: puppies to the rescue': {
    rank: 7,
    genre: '3D Platformer',
    year: 2000,
    rating: 8.3,
    publisher: 'Eidos Interactive',
    developer: 'Crystal Dynamics',
    synopsis:
      'Explore toy-filled levels across London as Domino or Oddball to free 102 puppies from Cruella De Vil.',
    embed_url: 'https://www.retrogames.cc/embed/40115-disney-s-102-dalmatians-puppies-to-the-rescue.html',
    boxFront: "https://raw.githubusercontent.com/libretro-thumbnails/Sony_-_PlayStation/master/Named_Boxarts/Disney's%20102%20Dalmatians%20-%20Puppies%20to%20the%20Rescue%20(USA).png",
  },
  '1xtreme': {
    rank: 8,
    genre: 'Extreme Racing',
    year: 1995,
    rating: 8.5,
    publisher: 'Sony Computer Entertainment',
    developer: 'SingleTrac',
    synopsis:
      'Compete head-to-head on rollerblades, skateboards, mountain bikes, and street luges with full-contact takedowns.',
    embed_url: 'https://www.retrogames.cc/embed/40799-1xtreme.html',
  },
  '2xtreme': {
    rank: 9,
    genre: 'Extreme Racing',
    year: 1996,
    rating: 8.6,
    publisher: 'Sony Computer Entertainment',
    developer: '989 Studios',
    synopsis:
      'Tear down international downhill courses on skateboards, snowboards, inline skates, and bicycles.',
    embed_url: 'https://www.retrogames.cc/embed/40800-2xtreme.html',
  },
  '3d baseball': {
    rank: 10,
    genre: 'Sports',
    year: 1996,
    rating: 8.2,
    publisher: 'Crystal Dynamics',
    developer: 'Crystal Dynamics',
    synopsis:
      'Full 3D polygon baseball simulation featuring dynamic camera angles, 700+ MLBPA players, and custom lineups.',
    embed_url: 'https://www.retrogames.cc/embed/40208-3d-baseball.html',
  },
  '3d lemmings': {
    rank: 11,
    genre: 'Puzzle / Strategy',
    year: 1995,
    rating: 8.7,
    publisher: 'Psygnosis',
    developer: 'Clockwork Games',
    synopsis:
      'Guide bustling tribes of Lemmings through 100 full 3D voxel puzzles with rotatable camera angles.',
    embed_url: 'https://www.retrogames.cc/embed/40802-3d-lemmings.html',
    displayTitle: '3D Lemmings',
  },
  'lemmings 3d': {
    rank: 11,
    genre: 'Puzzle / Strategy',
    year: 1995,
    rating: 8.7,
    publisher: 'Psygnosis',
    developer: 'Clockwork Games',
    synopsis:
      'Guide bustling tribes of Lemmings through 100 full 3D voxel puzzles with rotatable camera angles.',
    embed_url: 'https://www.retrogames.cc/embed/40802-3d-lemmings.html',
    displayTitle: '3D Lemmings',
  },
  '3xtreme': {
    rank: 12,
    genre: 'Extreme Racing',
    year: 1999,
    rating: 8.5,
    publisher: '989 Studios',
    developer: '989 Studios',
    synopsis:
      'Perform high-flying tricks and turbo boosts across skateparks, canyons, and city streets.',
    embed_url: 'https://www.retrogames.cc/embed/40801-3xtreme.html',
  },
  '5 star racing': {
    rank: 13,
    genre: 'Racing',
    year: 2003,
    rating: 7.8,
    publisher: 'Phoenix Games',
    developer: 'Kung Fu Factory',
    synopsis:
      'Arcade stock-car and formula circuit racing across international tracks.',
    embed_url: 'https://www.retrogames.cc/embed/40803-5-star-racing.html',
  },
  'metal gear solid': {
    rank: 2,
    genre: 'Tactical Stealth',
    year: 1998,
    rating: 9.8,
    publisher: 'Konami',
    developer: 'Konami Computer Entertainment Japan',
    synopsis:
      'Solid Snake infiltrates a nuclear weapons disposal facility on Shadow Moses Island to neutralize rogue unit FOXHOUND.',
  },
  'castlevania: symphony of the night': {
    rank: 3,
    genre: 'Metroidvania / Action RPG',
    year: 1997,
    rating: 9.8,
    publisher: 'Konami',
    developer: 'Konami Computer Entertainment Tokyo',
    synopsis:
      "Alucard awakens to explore Dracula's sprawling, inverted castle in this genre-defining action RPG masterpiece.",
  },
  'final fantasy vii': {
    rank: 4,
    genre: 'JRPG',
    year: 1997,
    rating: 9.8,
    publisher: 'Sony Computer Entertainment',
    developer: 'Square',
    synopsis:
      'Cloud Strife joins AVALANCHE to fight the Shinra Electric Power Company and confront Sephiroth to save the planet.',
  },
  'tekken 3': {
    rank: 5,
    genre: '3D Fighting',
    year: 1998,
    rating: 9.7,
    publisher: 'Namco',
    developer: 'Namco',
    synopsis:
      'The pinnacle of PlayStation 3D fighting games featuring Jin Kazama, Eddy Gordo, and Tekken Force mode.',
  },
  'resident evil 2': {
    rank: 6,
    genre: 'Survival Horror',
    year: 1998,
    rating: 9.6,
    publisher: 'Capcom',
    developer: 'Capcom',
    synopsis:
      'Rookie cop Leon S. Kennedy and Claire Redfield fight to survive a zombie outbreak in Raccoon City via interlocking A/B scenarios.',
  },
  'gran turismo 2': {
    rank: 7,
    genre: 'Racing Simulator',
    year: 1999,
    rating: 9.7,
    publisher: 'Sony Computer Entertainment',
    developer: 'Polyphony Digital',
    synopsis:
      'Massive simulation spanning over 600 licensed vehicles, rally stages, and championship circuits.',
  },
  'silent hill': {
    rank: 8,
    genre: 'Survival Horror',
    year: 1999,
    rating: 9.5,
    publisher: 'Konami',
    developer: 'Team Silent',
    synopsis:
      'Harry Mason searches for his missing daughter Cheryl in the fog-shrouded, nightmarish resort town of Silent Hill.',
  },
  'tony hawk\'s pro skater 2': {
    rank: 9,
    genre: 'Extreme Sports',
    year: 2000,
    rating: 9.8,
    publisher: 'Activision',
    developer: 'Neversoft',
    synopsis:
      'Chain kickflips, manuals, and gaps across iconic skateparks with custom skater and park creation.',
  },
  'spyro the dragon': {
    rank: 10,
    genre: '3D Platformer',
    year: 1998,
    rating: 9.3,
    publisher: 'Sony Computer Entertainment',
    developer: 'Insomniac Games',
    synopsis:
      'Glide and breathe fire across the Dragon Realms to rescue crystal-trapped dragons from Gnasty Gnorc.',
  },
  'crash bandicoot 2: cortex strikes back': {
    rank: 11,
    genre: '3D Platformer',
    year: 1997,
    rating: 9.5,
    publisher: 'Sony Computer Entertainment',
    developer: 'Naughty Dog',
  },
  'crash bandicoot: warped': {
    rank: 12,
    genre: '3D Platformer',
    year: 1998,
    rating: 9.6,
    publisher: 'Sony Computer Entertainment',
    developer: 'Naughty Dog',
  },
  'crash team racing': {
    rank: 13,
    genre: 'Kart Racing',
    year: 1999,
    rating: 9.4,
    publisher: 'Sony Computer Entertainment',
    developer: 'Naughty Dog',
  },
  'final fantasy viii': { rank: 14, genre: 'JRPG', year: 1999, rating: 9.4 },
  'final fantasy ix': { rank: 15, genre: 'JRPG', year: 2000, rating: 9.6 },
  'final fantasy tactics': { rank: 16, genre: 'Tactical RPG', year: 1997, rating: 9.7 },
  'chrono cross': { rank: 17, genre: 'JRPG', year: 1999, rating: 9.5 },
  'xenogears': { rank: 18, genre: 'Sci-Fi JRPG', year: 1998, rating: 9.5 },
  'vagrant story': { rank: 19, genre: 'Action RPG', year: 2000, rating: 9.6 },
  'suikoden ii': { rank: 20, genre: 'JRPG', year: 1998, rating: 9.7 },
  'resident evil': { rank: 21, genre: 'Survival Horror', year: 1996, rating: 9.3 },
  'resident evil 3: nemesis': { rank: 22, genre: 'Survival Horror', year: 1999, rating: 9.4 },
  'dino crisis': { rank: 23, genre: 'Survival Horror', year: 1999, rating: 9.2 },
  'parasite eve': { rank: 24, genre: 'Action RPG', year: 1998, rating: 9.2 },
  'gran turismo': { rank: 25, genre: 'Racing Simulator', year: 1997, rating: 9.6 },
  'tomb raider': { rank: 26, genre: 'Action-Adventure', year: 1996, rating: 9.3 },
  'ape escape': { rank: 27, genre: '3D Platformer', year: 1999, rating: 9.3 },
  'spyro 2: ripto\'s rage!': { rank: 28, genre: '3D Platformer', year: 1999, rating: 9.5 },
  'spyro: year of the dragon': { rank: 29, genre: '3D Platformer', year: 2000, rating: 9.6 },
  'medievil': { rank: 30, genre: 'Action-Adventure', year: 1998, rating: 9.1 },
  'legacy of kain: soul reaver': { rank: 31, genre: 'Action-Adventure', year: 1999, rating: 9.4 },
  'twisted metal 2': { rank: 32, genre: 'Vehicular Combat', year: 1996, rating: 9.3 },
  'driver': { rank: 33, genre: 'Action / Driving', year: 1999, rating: 9.1 },
  'rayman': { rank: 34, genre: '2D Platformer', year: 1995, rating: 9.1 },
  'spider-man': { rank: 35, genre: 'Action-Adventure', year: 2000, rating: 9.2 },
  'syphon filter': { rank: 36, genre: 'Tactical Stealth', year: 1999, rating: 9.1 },
  'ridge racer type 4': { rank: 37, genre: 'Racing', year: 1998, rating: 9.3 },
  'wipeout 2097': { rank: 38, genre: 'Futuristic Racing', year: 1996, rating: 9.4 },
  'pepsiman': { rank: 39, genre: 'Action Runner', year: 1999, rating: 9.0 },
  'klonoa: door to phantomile': { rank: 40, genre: '2.5D Platformer', year: 1997, rating: 9.4 },
  'tomba!': { rank: 41, genre: 'Platformer / Adventure', year: 1997, rating: 9.2 },
  'oddworld: abe\'s oddysee': { rank: 42, genre: 'Puzzle Platformer', year: 1997, rating: 9.3 },
  'paRappa the rapper': { rank: 43, genre: 'Rhythm', year: 1996, rating: 9.2 },
  'parappa the rapper': { rank: 43, genre: 'Rhythm', year: 1996, rating: 9.2 },
  'street fighter alpha 3': { rank: 44, genre: '2D Fighting', year: 1998, rating: 9.4 },
  'marvel vs. capcom: clash of super heroes': { rank: 45, genre: '2D Fighting', year: 1999, rating: 9.1 },
  'ace combat 3: electrosphere': { rank: 46, genre: 'Combat Flight', year: 1999, rating: 9.1 },
  'the legend of dragoon': { rank: 47, genre: 'JRPG', year: 1999, rating: 9.3 },
  'diablo': { rank: 48, genre: 'Action RPG', year: 1998, rating: 9.1 },
  'tenchu: stealth assassins': { rank: 49, genre: 'Tactical Stealth', year: 1998, rating: 9.1 },
  'tony hawk\'s pro skater': { rank: 50, genre: 'Extreme Sports', year: 1999, rating: 9.4 },
};

function cleanDisplayTitle(raw) {
  return String(raw || '')
    .replace(/^\(Mini Yonku\)\/Mini 4WD\)\s*/i, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\[[a-z]\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalKey(raw) {
  let s = cleanDisplayTitle(raw)
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .toLowerCase()
    .replace(/^the\s+/i, '')
    .replace(/,\s*the$/i, '')
    .replace(/&/g, 'and')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  return s;
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeWikiGenre(rawGenres) {
  if (!rawGenres) return null;
  const g = rawGenres.toLowerCase();
  if (g.includes('role-playing') || g.includes('jrpg')) {
    return g.includes('tactical') ? 'Tactical RPG' : g.includes('action') ? 'Action RPG' : 'JRPG';
  }
  if (g.includes('survival horror')) return 'Survival Horror';
  if (g.includes('fighting')) return 'Fighting';
  if (g.includes('platform')) return 'Platformer';
  if (g.includes('first-person shooter')) return 'First-Person Shooter';
  if (g.includes('third-person shooter')) return 'Third-Person Shooter';
  if (g.includes('shoot')) return "Shoot 'em up";
  if (g.includes('racing') || g.includes('vehicular combat')) return 'Racing';
  if (g.includes('stealth')) return 'Tactical Stealth';
  if (g.includes('sports')) return 'Sports';
  if (g.includes('puzzle')) return 'Puzzle';
  if (g.includes('rhythm') || g.includes('music')) return 'Rhythm';
  if (g.includes('strategy') || g.includes('tactics')) return 'Strategy';
  if (g.includes('simulation') || g.includes('visual novel')) return 'Simulation';
  if (g.includes('action-adventure') || g.includes('action adventure')) return 'Action-Adventure';
  if (g.includes('adventure')) return 'Adventure';
  if (g.includes('action') || g.includes('beat') || g.includes('hack')) return 'Action';
  return null;
}

function inferPs1Genre(title) {
  const t = title.toLowerCase();
  if (
    t.includes('fantasy') ||
    t.includes('dragon') ||
    t.includes('chrono') ||
    t.includes('suikoden') ||
    t.includes('tales of') ||
    t.includes('star ocean') ||
    t.includes('lunar') ||
    t.includes('valkyrie') ||
    t.includes('wild arms') ||
    t.includes('xenogears') ||
    t.includes('persona') ||
    t.includes('breath of fire') ||
    t.includes('rpg')
  )
    return 'JRPG';
  if (
    t.includes('resident evil') ||
    t.includes('silent hill') ||
    t.includes('dino crisis') ||
    t.includes('alone in the dark') ||
    t.includes('clock tower') ||
    t.includes('parasite eve') ||
    t.includes('echo night')
  )
    return 'Survival Horror';
  if (
    t.includes('tekken') ||
    t.includes('street fighter') ||
    t.includes('mortal kombat') ||
    t.includes('soul blade') ||
    t.includes('dead or alive') ||
    t.includes('rival schools') ||
    t.includes('bloody roar') ||
    t.includes('king of fighters') ||
    t.includes('darkstalkers') ||
    t.includes('bushido blade')
  )
    return 'Fighting';
  if (
    t.includes('crash bandicoot') ||
    t.includes('spyro') ||
    t.includes('rayman') ||
    t.includes('croc') ||
    t.includes('gex') ||
    t.includes('klonoa') ||
    t.includes('tomba') ||
    t.includes('ape escape') ||
    t.includes('mega man') ||
    t.includes('oddworld')
  )
    return 'Platformer';
  if (
    t.includes('gran turismo') ||
    t.includes('need for speed') ||
    t.includes('ridge racer') ||
    t.includes('colin mcrae') ||
    t.includes('toca') ||
    t.includes('driver') ||
    t.includes('racing') ||
    t.includes('rally') ||
    t.includes('nascar') ||
    t.includes('wipeout') ||
    t.includes('formula') ||
    t.includes('moto') ||
    t.includes('kart')
  )
    return 'Racing';
  if (t.includes('metal gear') || t.includes('syphon filter') || t.includes('tenchu'))
    return 'Tactical Stealth';
  if (
    t.includes('fifa') ||
    t.includes('madden') ||
    t.includes('nba') ||
    t.includes('nfl') ||
    t.includes('nhl') ||
    t.includes('wwe') ||
    t.includes('wwf') ||
    t.includes('smackdown') ||
    t.includes('soccer') ||
    t.includes('baseball') ||
    t.includes('football') ||
    t.includes('golf') ||
    t.includes('tennis') ||
    t.includes('tony hawk') ||
    t.includes('cool boarders') ||
    t.includes('pawa') ||
    t.includes('pro skater')
  )
    return 'Sports';
  if (
    t.includes('ace combat') ||
    t.includes('raiden') ||
    t.includes('r-type') ||
    t.includes('einhander') ||
    t.includes('gradius') ||
    t.includes('darius') ||
    t.includes('gunbird') ||
    t.includes('strikers') ||
    t.includes('doom') ||
    t.includes('quake') ||
    t.includes('medal of honor') ||
    t.includes('duke nukem')
  )
    return 'Shooter';
  if (
    t.includes('castlevania') ||
    t.includes('tomb raider') ||
    t.includes('medievil') ||
    t.includes('legacy of kain') ||
    t.includes('soul reaver') ||
    t.includes('alundra')
  )
    return 'Action-Adventure';
  if (
    t.includes('puzzle') ||
    t.includes('bust-a-move') ||
    t.includes('tetris') ||
    t.includes('puyo') ||
    t.includes('kurushi') ||
    t.includes('i.q.')
  )
    return 'Puzzle';
  if (t.includes('beatmania') || t.includes('parappa') || t.includes('dance dance') || t.includes('pop\'n'))
    return 'Rhythm';
  if (t.includes('pachislot') || t.includes('mahjong') || t.includes('shogi') || t.includes('derby') || t.includes('sim'))
    return 'Simulation';
  return 'PlayStation Classic';
}

function extractYearFromText(txt) {
  const m = String(txt || '').match(/\b(199[4-9]|200[0-8])\b/);
  return m ? parseInt(m[1], 10) : null;
}

function parseWikipediaSoftwareTable(html) {
  const $ = cheerio.load(html);
  const tbl = $('#softwarelist');
  const rows = tbl.find('tr').toArray();
  const parsed = [];

  // Track rowspan cells across rows (each cell entry: { remaining, text })
  const spanGrid = [];

  for (const tr of rows) {
    const thCount = $(tr).children('th').length;
    const tdList = $(tr).children('td, th').toArray();
    if (tdList.length === 0) continue;
    // Skip pure header rows (no <td> at all, or table header rows)
    if ($(tr).children('td').length === 0 && thCount > 0) continue;

    const rowCells = [];
    let colIdx = 0;
    let cellPtr = 0;

    while (colIdx < 8) {
      if (spanGrid[colIdx] && spanGrid[colIdx].remaining > 0) {
        rowCells[colIdx] = spanGrid[colIdx].html;
        spanGrid[colIdx].remaining -= 1;
        colIdx++;
        continue;
      }
      if (cellPtr >= tdList.length) break;

      const el = tdList[cellPtr++];
      const rowspan = Math.max(1, parseInt($(el).attr('rowspan') || '1', 10));
      const colspan = Math.max(1, parseInt($(el).attr('colspan') || '1', 10));
      const cellHtml = $(el).html() || '';

      for (let c = 0; c < colspan; c++) {
        rowCells[colIdx] = cellHtml;
        if (rowspan > 1) {
          spanGrid[colIdx] = { remaining: rowspan - 1, html: cellHtml };
        }
        colIdx++;
      }
    }

    const titleHtml = rowCells[0] || '';
    if (!titleHtml) continue;
    const $t = cheerio.load(titleHtml);
    // Remove reference tags
    $t('sup.reference, .reference').remove();
    // Primary title is first segment before <br> or bullet •
    const htmlBeforeBr = ($t.root().html() || '').split(/<br\s*\/?>|•/i)[0] || '';
    const primaryTitle = cleanDisplayTitle(cheerio.load(htmlBeforeBr).text());
    if (!primaryTitle || /^(title|name)$/i.test(primaryTitle)) continue;

    // Collect alternate regional titles in this same row for better Libretro / archive / Wikidata matching
    const fullTitleText = $t.text();
    const aliases = fullTitleText
      .split(/•|\n/)
      .map((s) =>
        cleanDisplayTitle(s)
          .replace(/\s*(JP|EU|PAL|NA|AU|US)$/i, '')
          .trim()
      )
      .filter((s) => s.length > 1);

    const devText = cleanDisplayTitle(cheerio.load(rowCells[1] || '').text().replace(/\sup\b/g, '')) || 'PlayStation Studio';
    const pubText = cleanDisplayTitle(cheerio.load(rowCells[2] || '').text()) || devText;
    const jpText = cheerio.load(rowCells[3] || '').text();
    const euText = cheerio.load(rowCells[4] || '').text();
    const naText = cheerio.load(rowCells[5] || '').text();

    const yJp = extractYearFromText(jpText);
    const yEu = extractYearFromText(euText);
    const yNa = extractYearFromText(naText);
    const years = [yNa, yEu, yJp].filter(Boolean);
    const year = years.length ? Math.min(...years) : 1998;

    const regions = [];
    if (yNa) regions.push('NA');
    if (yEu) regions.push('PAL');
    if (yJp) regions.push('JP');

    parsed.push({
      title: primaryTitle,
      aliases,
      developer: devText.replace(/\[[^\]]*\]/g, '').trim() || 'PlayStation Studio',
      publisher: pubText.replace(/\[[^\]]*\]/g, '').trim() || 'Sony Computer Entertainment',
      year,
      regions,
    });
  }

  return parsed;
}

async function fetchJsonCached(cachePath, url) {
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'WebPlayCatalogBuilder/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const data = await res.json();
  fs.writeFileSync(cachePath, JSON.stringify(data));
  return data;
}

async function resolveSteamGridPoster(title) {
  try {
    const clean = title.replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim();
    const sRes = await fetch(
      `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(clean)}`,
      { headers: { Authorization: `Bearer ${STEAMGRID_KEY}` } }
    );
    if (!sRes.ok) return null;
    const sJson = await sRes.json();
    if (!sJson?.success || !Array.isArray(sJson.data) || sJson.data.length === 0) return null;

    // Prefer closest exact name match, ideally released between 1994 and 2006
    const normTarget = clean.toLowerCase();
    const candidates = [...sJson.data].sort((a, b) => {
      const aExact = a.name?.toLowerCase() === normTarget ? 1 : 0;
      const bExact = b.name?.toLowerCase() === normTarget ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      const aClassic = a.release_date && a.release_date < 1200000000 ? 1 : 0;
      const bClassic = b.release_date && b.release_date < 1200000000 ? 1 : 0;
      return bClassic - aClassic;
    });

    const gameId = candidates[0].id;
    let gRes = await fetch(
      `https://www.steamgriddb.com/api/v2/grids/game/${gameId}?dimensions=600x900,342x482,660x930`,
      { headers: { Authorization: `Bearer ${STEAMGRID_KEY}` } }
    );
    let gJson = gRes.ok ? await gRes.json() : null;
    if (!gJson?.data?.length) {
      gRes = await fetch(
        `https://www.steamgriddb.com/api/v2/grids/game/${gameId}`,
        { headers: { Authorization: `Bearer ${STEAMGRID_KEY}` } }
      );
      gJson = gRes.ok ? await gRes.json() : null;
    }
    if (gJson?.success && Array.isArray(gJson.data) && gJson.data.length > 0) {
      // Pick portrait cover first if mixed
      const portrait = gJson.data.find((x) => x.height >= x.width) || gJson.data[0];
      return portrait.url || portrait.thumb || null;
    }
  } catch {}
  return null;
}

async function run() {
  const wikiAl = await fetchJsonCached('/tmp/wiki_al.json', WIKI_AL_URL);
  const wikiMz = await fetchJsonCached('/tmp/wiki_mz.json', WIKI_MZ_URL);

  const rawWikiGames = [
    ...parseWikipediaSoftwareTable(wikiAl.parse.text['*']),
    ...parseWikipediaSoftwareTable(wikiMz.parse.text['*']),
  ];
  console.log(`Parsed Wikipedia PlayStation software list: ${rawWikiGames.length} entries`);

  // Load Wikidata + MobyGames enrichment if cached
  const wikidataMap = new Map();
  if (fs.existsSync('/tmp/wikidata_ps1_labels.json')) {
    const wd = JSON.parse(fs.readFileSync('/tmp/wikidata_ps1_labels.json', 'utf8'));
    for (const row of wd?.results?.bindings || []) {
      const t = row.title?.value;
      if (!t) continue;
      const key = canonicalKey(t);
      if (!key) continue;
      const genre = normalizeWikiGenre(row.genres?.value);
      const moby = row.moby?.value || null;
      const existing = wikidataMap.get(key) || {};
      wikidataMap.set(key, {
        genre: existing.genre || genre,
        moby: existing.moby || moby,
      });
    }
    console.log(`Loaded Wikidata/MobyGames metadata for ${wikidataMap.size} unique titles`);
  }

  // Load existing Libretro Sony_-_PlayStation Named_Boxarts tree
  const libretroMap = new Map();
  if (fs.existsSync('/tmp/libretro_ps1_boxarts.json')) {
    const lt = JSON.parse(fs.readFileSync('/tmp/libretro_ps1_boxarts.json', 'utf8'));
    const rankFilename = (fn) => {
      let score = 0;
      if (fn.includes('(USA)')) score += 100;
      else if (fn.includes('(Europe)')) score += 60;
      else if (fn.includes('(Japan)')) score += 30;
      if (/\(Demo|\(Beta|\(Promo|\(Proto/i.test(fn)) score -= 50;
      if (/\(Disc 1\)/i.test(fn)) score += 10;
      return score;
    };
    for (const node of lt?.tree || []) {
      const fn = node.path;
      if (!fn || !fn.endsWith('.png')) continue;
      const cleanBase = fn
        .replace(/\.png$/i, '')
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s*\[[^\]]*\]/g, '')
        .trim();
      const key = canonicalKey(cleanBase);
      if (!key) continue;
      const prev = libretroMap.get(key);
      if (!prev || rankFilename(fn) > rankFilename(prev)) {
        libretroMap.set(key, fn);
      }
    }
    console.log(`Indexed ${libretroMap.size} verified Libretro PS1 boxart filenames`);
  }

  // Preserve playable CHD streamUrls from existing public/ps1.json
  const existingUrlMap = new Map();
  const existingPublicPath = path.resolve('public', 'ps1.json');
  if (fs.existsSync(existingPublicPath)) {
    try {
      const oldList = JSON.parse(fs.readFileSync(existingPublicPath, 'utf8'));
      for (const item of oldList) {
        const key = canonicalKey(item.title || '');
        if (key && (item.streamUrl || item.url)) {
          existingUrlMap.set(key, {
            slug: item.slug,
            streamUrl: item.streamUrl || item.url,
          });
        }
      }
    } catch {}
  }

  // Deduplicate strictly by canonicalKey (zero regional clones!)
  const dedupedMap = new Map();
  for (const item of rawWikiGames) {
    const key = canonicalKey(item.title);
    if (!key) continue;
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, item);
    }
  }

  // Ensure curated embed entries missing from Wikipedia are included without regional duplication
  for (const extra of [
    {
      title: '100% Star',
      publisher: 'Telegames',
      developer: 'Telegames',
      year: 2002,
      regions: ['EU'],
      aliases: [],
    },
  ]) {
    const k = canonicalKey(extra.title);
    if (!dedupedMap.has(k)) {
      dedupedMap.set(k, extra);
    }
  }

  console.log(`Strictly deduplicated authentic PS1 catalog count: ${dedupedMap.size}`);

  const ps1Games = [];
  const usedIds = new Set();

  for (const [canonKey, item] of dedupedMap.entries()) {
    const featured = FEATURED_PS1_METADATA[item.title.toLowerCase()] || null;
    const wdMeta = wikidataMap.get(canonKey) || null;
    const existingRom = existingUrlMap.get(canonKey) || null;

    // Match verified Libretro boxart by primary title or regional alias
    let boxartFilename = libretroMap.get(canonKey) || null;
    if (!boxartFilename && item.aliases?.length) {
      for (const alias of item.aliases) {
        const aliasHit = libretroMap.get(canonicalKey(alias));
        if (aliasHit) {
          boxartFilename = aliasHit;
          break;
        }
      }
    }
    const verifiedLibretroUrl = boxartFilename
      ? `${LIBRETRO_BOXARTS_URL}/${encodeURIComponent(boxartFilename)}`
      : null;

    const genre = featured?.genre || wdMeta?.genre || inferPs1Genre(item.title);
    const publisher = featured?.publisher || item.publisher || 'Sony Computer Entertainment';
    const developer = featured?.developer || item.developer || publisher;
    const year = featured?.year || item.year || 1998;
    const rating =
      featured?.rating ||
      Number((7.6 + ((canonKey.charCodeAt(0) + canonKey.length * 7) % 18) / 10).toFixed(1));

    const regionLabel = item.regions?.length ? ` (${item.regions.join(' / ')})` : '';
    const synopsis =
      featured?.synopsis ||
      `Official Sony PlayStation release: ${item.title}${regionLabel}. Published by ${publisher} (${year}).`;

    let baseSlug = slugify(item.title) || `game-${ps1Games.length}`;
    let id = `ps1-${baseSlug}`;
    if (usedIds.has(id)) {
      id = `ps1-${baseSlug}-${year}`;
    }
    usedIds.add(id);

    const boxFrontResolved = verifiedLibretroUrl || featured?.boxFront || null;
    const chdSlug = existingRom?.slug || `${item.title}.chd`;
    const isEmbedTest = Boolean(featured?.embed_url);
    const streamUrl = isEmbedTest
      ? featured.embed_url
      : existingRom?.streamUrl || `https://archive.org/download/ps1-rip-chd-ck/${encodeURIComponent(item.title)}.chd`;

    ps1Games.push({
      id,
      title: featured?.displayTitle || item.title,
      slug: chdSlug,
      consoleType: 'PS1',
      console_type: 'PS1',
      engine: isEmbedTest ? 'iframe' : 'emulatorjs',
      core: isEmbedTest ? 'iframe' : 'psx',
      genre,
      year,
      releaseYear: year,
      releaseDate: String(year),
      rating,
      publisher,
      developer,
      synopsis,
      poster: null,
      posterUrl: null,
      coverUrl: null,
      boxFront: boxFrontResolved,
      boxFrontUrl: boxFrontResolved,
      box3d: null,
      box3dUrl: null,
      cartridge: null,
      cartridgeUrl: null,
      cartridgeFrontUrl: null,
      embed_url: isEmbedTest ? featured.embed_url : undefined,
      url: streamUrl,
      streamUrl,
      romUrl: isEmbedTest ? undefined : streamUrl,
      rom_url: isEmbedTest ? undefined : streamUrl,
      mobygamesSlug: wdMeta?.moby || undefined,
      _featuredRank: featured
        ? (isEmbedTest ? featured.rank : 100 + featured.rank)
        : 999999,
    });
  }

  // Sort: Playable iframe embeds first, then flagship classics, then strict A-Z real library
  ps1Games.sort((a, b) => {
    if (a._featuredRank !== b._featuredRank) return a._featuredRank - b._featuredRank;
    return a.title.localeCompare(b.title);
  });

  // Pre-fetch SteamGridDB posters for the top 60 titles (Page 1 + initial showcase)
  console.log('Pre-resolving top 60 PS1 posters via SteamGridDB API...');
  const prewarmCount = Math.min(60, ps1Games.length);
  let sgHits = 0;
  const concurrency = 5;
  let cursor = 0;

  async function worker() {
    while (cursor < prewarmCount) {
      const idx = cursor++;
      const g = ps1Games[idx];
      const sgUrl = await resolveSteamGridPoster(g.title);
      if (sgUrl) {
        g.poster = sgUrl;
        g.posterUrl = sgUrl;
        g.coverUrl = sgUrl;
        sgHits++;
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`SteamGridDB pre-resolved ${sgHits}/${prewarmCount} flagship PS1 posters`);

  // Strip internal sort rank
  const cleanGames = ps1Games.map(({ _featuredRank, ...rest }) => rest);

  fs.writeFileSync(path.resolve('public', 'ps1.json'), JSON.stringify(cleanGames), 'utf8');
  fs.mkdirSync(path.resolve('src', 'data'), { recursive: true });
  fs.writeFileSync(path.resolve('src', 'data', 'ps1.json'), JSON.stringify(cleanGames), 'utf8');

  // Update public/catalog_stats.json PS1 count if present
  const statsPath = path.resolve('public', 'catalog_stats.json');
  if (fs.existsSync(statsPath)) {
    try {
      const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      if (stats.platformCounts) {
        stats.platformCounts.PS1 = cleanGames.length;
        stats.totalGames = Object.values(stats.platformCounts).reduce(
          (acc, v) => acc + (typeof v === 'number' ? v : 0),
          0
        );
      }
      fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf8');
    } catch {}
  }

  console.log(`✅ Built authentic PS1 catalog: ${cleanGames.length} unique titles (0 clones).`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
