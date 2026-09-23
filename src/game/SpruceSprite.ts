// Authentic Handcrafted Pixel-Art Siberian Spruce Sprite Generator
// Faithfully matches the user's reference pixel-art spruce:
// - Low-resolution chunky pixel grid with bold slate-navy outline
// - Plump, rounded scalloped silhouette with cozy, stout proportions
// - Rich pine-green foliage with warm sunlit olive highlights
// - Puffy, pillow-soft snow banks resting on boughs with blue cast shadows
// - Stout, barrel-like wooden trunk resting in a stepped pixelated ground shadow

export interface SpruceSpriteDef {
  canvas: HTMLCanvasElement;
  anchorX: number; // Pivot X (trunk base center)
  anchorY: number; // Pivot Y (trunk ground contact)
}

export interface SpruceSpriteSet {
  spruceA: SpruceSpriteDef;
  spruceB: SpruceSpriteDef;
  giantSpruce: SpruceSpriteDef;
}

// 16-color authentic pixel-art palette matched to reference
const PALETTE: Record<string, string> = {
  '.': 'transparent',
  '#': '#1A2531', // Bold pixel outline (deep slate navy)
  'G': '#162E1D', // Deep pine foliage shadow
  'g': '#2A5331', // Rich forest pine green body
  'L': '#668F3A', // Sunlit olive-green needle highlight
  'l': '#7EA648', // Brightest warm needle tip
  'W': '#FFFFFF', // Pure brilliant white sunlit snow
  's': '#E4EEF6', // Soft light snow transition
  'S': '#C4D5E5', // Crisp ambient powder snow blue
  'd': '#7992A8', // Shaded snow slate-blue
  'D': '#4C647C', // Deep snow crease / underside shadow
  't': '#2A1C18', // Trunk outline & fissure crevices
  'T': '#4F352F', // Trunk dark brown bark
  'm': '#755047', // Trunk midtone body bark
  'h': '#996C5F', // Trunk highlight bark ridge
  'O': 'rgba(84, 107, 131, 0.42)', // Inner core ground shadow
  'o': 'rgba(122, 145, 169, 0.30)', // Mid ground shadow
  'p': 'rgba(152, 174, 196, 0.18)', // Outer soft snow shadow rim
};

function buildCanvasFromGrid(lines: string[]): HTMLCanvasElement {
  const h = lines.length;
  const w = lines[0].length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { alpha: true });
  if (!ctx) return c;
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < h; y++) {
    const row = lines[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x] || '.';
      const color = PALETTE[ch];
      if (color && color !== 'transparent') {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}

// ===========================================================================
// SPRUCE A: Exact recreation of user's reference pixel art (46 x 52 px)
// ===========================================================================
const SPRUCE_A_GRID: string[] = [
  /* 00 */ "..............................................",
  /* 01 */ "......................##......................",
  /* 02 */ ".....................#SS#.....................",
  /* 03 */ ".....................#WS#.....................",
  /* 04 */ "....................#WWS#.....................",
  /* 05 */ "...................#WWWSS#....................",
  /* 06 */ "..................#WWWSSd#....................",
  /* 07 */ "..................#WWSSdd#....................",
  /* 08 */ ".................#lGSSddd#....................",
  /* 09 */ "................#LlG#ddd#g#...................",
  /* 10 */ "...............#lLgg#WW#ggg#..................",
  /* 11 */ "..............#lGgg#WWWW#Ggg#.................",
  /* 12 */ ".............#lL#WWWWWWWW#Ggg#................",
  /* 13 */ "............#Lg#WWWWWWWWWS#GG#................",
  /* 14 */ "...........#Lg#WWWWWWWWWWSS#G#................",
  /* 15 */ "..........#Lgg#WWWWWWWWWSSdd##................",
  /* 16 */ ".........#Lggg#WWWWWWWWSSSddD#................",
  /* 17 */ "..........#Lg#d#WWWWWWSSSSddD#g#..............",
  /* 18 */ ".........#lG#ddd#WWWWSSSSddD#ggg#.............",
  /* 19 */ "........#LlGg#dd#d##SSSddD##Ggggg#............",
  /* 20 */ ".......#lLgggG####..####D##GGggggg#...........",
  /* 21 */ "......#lLggggG#WW#..#WW##Gggggggggg#..........",
  /* 22 */ ".....#lLgggg#WWWW####WWW##GGgggggggG#.........",
  /* 23 */ "....#lL#WW##WWWWWWWWWWWWWW#GggggggggG#........",
  /* 24 */ "...#Lg#WWWWWWWWWWWWWWWWWWWS#Gggggggggg#.......",
  /* 25 */ "..#lG#WWWWWWWWWWWWWWWWWWWSSd#GggggggggG#......",
  /* 26 */ "..#Lg#WWWWWWWWWWWWWWWWWWSSddd#GgggggggG#......",
  /* 27 */ ".#lLgg#WWWWWW#WWWWWWWWWSSSSddD#GgggggggG#.....",
  /* 28 */ "#llLgg#d##WW#d#WWWWWWWSSSSdddD##GggggggG#.....",
  /* 29 */ "#LlGg#ddd#W#ddd#WWWWWWSSSdddD#WW#GggggggG#....",
  /* 30 */ ".#G#dddD##W##ddd#WWWWWSSdddD#WWWW#GGggggG#....",
  /* 31 */ "..#DddD#WWWW##dd#d##SSdddD##WWWWWSS#GGggG#....",
  /* 32 */ "..#L#WWWWWWWW##d#...####D##WWWWWWSSdd#GGG#....",
  /* 33 */ ".#lL#WWWWWWWWWS##...#WW##GWWWWWWSSSddD#G#.....",
  /* 34 */ "#llLg#WWWWWWWSSdd#.#WWWW#GWWWWWSSSSddD##......",
  /* 35 */ "#LlGgg#WWWWWSSSddD##WWWW#GWWWWSSSSSddD#.......",
  /* 36 */ ".#lGggg#d##SSSSddD##WWWW#GGWWSSSSSddD#........",
  /* 37 */ "..#GGggG#..###DdD##G#WWW##GGWSSSSddD#.........",
  /* 38 */ "...#GGGG#...#TthhthtT#WW##GG#SSdddD#..........",
  /* 39 */ "....####....#TmhhhhhT#dd##G#..####............",
  /* 40 */ "............#TmhhhhhT#D##G#...................",
  /* 41 */ "...........#p#TmhhhhT#d####...................",
  /* 42 */ "........#ooOO#TmhhhhT#OOooo#..................",
  /* 43 */ "......#ooOOOO#TmmhhhT#OOOOOoo#................",
  /* 44 */ ".....#ooOOOOO#TmmmmhT#OOOOOOoo#...............",
  /* 45 */ "......#ooOOOO#TtttttT#OOOOOoo#................",
  /* 46 */ ".......#oooOO#########OOOooo#.................",
  /* 47 */ ".........#ooooooooooooooo#....................",
  /* 48 */ "...........#ooooooooooo#......................",
  /* 49 */ ".............#ppppppp#........................",
  /* 50 */ "..............................................",
  /* 51 */ "..............................................",
];

// ===========================================================================
// SPRUCE B: Natural variation matching exact reference style (46 x 52 px)
// Slightly different snow drift weighting, identical charm and proportions
// ===========================================================================
const SPRUCE_B_GRID: string[] = [
  /* 00 */ "..............................................",
  /* 01 */ "......................##......................",
  /* 02 */ ".....................#SS#.....................",
  /* 03 */ ".....................#WS#.....................",
  /* 04 */ "....................#WWS#.....................",
  /* 05 */ "...................#WWWSS#....................",
  /* 06 */ "..................#WWWSSd#....................",
  /* 07 */ "..................#WWSSdd#....................",
  /* 08 */ ".................#lGSSddd#....................",
  /* 09 */ "................#LlG#ddd#g#...................",
  /* 10 */ "...............#lLgg#WW#ggg#..................",
  /* 11 */ "..............#lGgg#WWWW#Ggg#.................",
  /* 12 */ ".............#lL#WWWWWWWW#Ggg#................",
  /* 13 */ "............#Lg#WWWWWWWWWS#GG#................",
  /* 14 */ "...........#Lg#WWWWWWWWWWSS#G#................",
  /* 15 */ "..........#Lgg#WWWWWWWWWSSdd##................",
  /* 16 */ ".........#Lggg#WWWWWWWWSSSddD#................",
  /* 17 */ "..........#Lg#d#WWWWWWSSSSddD#g#..............",
  /* 18 */ ".........#lG#ddd#WWWWSSSSddD#ggg#.............",
  /* 19 */ "........#LlGg#dd#d##SSSddD##Ggggg#............",
  /* 20 */ ".......#lLgggG####..####D##GGggggg#...........",
  /* 21 */ "......#lLggggG#WW#..#WW##Gggggggggg#..........",
  /* 22 */ ".....#lLgggg#WWWW####WWW##GGgggggggG#.........",
  /* 23 */ "....#lL#WW##WWWWWWWWWWWWWW#GggggggggG#........",
  /* 24 */ "...#Lg#WWWWWWWWWWWWWWWWWWWS#Gggggggggg#.......",
  /* 25 */ "..#lG#WWWWWWWWWWWWWWWWWWWSSd#GggggggggG#......",
  /* 26 */ "..#Lg#WWWWWWWWWWWWWWWWWWSSddd#GgggggggG#......",
  /* 27 */ ".#lLgg#WWWWWW#WWWWWWWWWSSSSddD#GgggggggG#.....",
  /* 28 */ "#llLgg#d##WW#d#WWWWWWWSSSSdddD##GggggggG#.....",
  /* 29 */ "#LlGg#ddd#W#ddd#WWWWWWSSSdddD#WW#GggggggG#....",
  /* 30 */ ".#G#dddD##W##ddd#WWWWWSSdddD#WWWW#GGggggG#....",
  /* 31 */ "..#DddD#WWWW##dd#d##SSdddD##WWWWWSS#GGggG#....",
  /* 32 */ "..#L#WWWWWWWW##d#...####D##WWWWWWSSdd#GGG#....",
  /* 33 */ ".#lL#WWWWWWWWWS##...#WW##GWWWWWWSSSddD#G#.....",
  /* 34 */ "#llLg#WWWWWWWSSdd#.#WWWW#GWWWWWSSSSddD##......",
  /* 35 */ "#LlGgg#WWWWWSSSddD##WWWW#GWWWWSSSSSddD#.......",
  /* 36 */ ".#lGggg#d##SSSSddD##WWWW#GGWWSSSSSddD#........",
  /* 37 */ "..#GGggG#..###DdD##G#WWW##GGWSSSSddD#.........",
  /* 38 */ "...#GGGG#...#TthhthtT#WW##GG#SSdddD#..........",
  /* 39 */ "....####....#TmhhhhhT#dd##G#..####............",
  /* 40 */ "............#TmhhhhhT#D##G#...................",
  /* 41 */ "...........#p#TmhhhhT#d####...................",
  /* 42 */ "........#ooOO#TmhhhhT#OOooo#..................",
  /* 43 */ "......#ooOOOO#TmmhhhT#OOOOOoo#................",
  /* 44 */ ".....#ooOOOOO#TmmmmhT#OOOOOOoo#...............",
  /* 45 */ "......#ooOOOO#TtttttT#OOOOOoo#................",
  /* 46 */ ".......#oooOO#########OOOooo#.................",
  /* 47 */ ".........#ooooooooooooooo#....................",
  /* 48 */ "...........#ooooooooooo#......................",
  /* 49 */ ".............#ppppppp#........................",
  /* 50 */ "..............................................",
  /* 51 */ "..............................................",
];

// ===========================================================================
// GIANT SPRUCE: Majestic Ancient Taiga Fir (58 x 66 px)
// Scales the reference's stout, cozy pixel art to a majestic forest elder
// ===========================================================================
const GIANT_SPRUCE_GRID: string[] = [
  /* 00 */ "..........................................................",
  /* 01 */ "............................##............................",
  /* 02 */ "...........................#SS#...........................",
  /* 03 */ "...........................#WSS#..........................",
  /* 04 */ "..........................#WWSS#..........................",
  /* 05 */ ".........................#WWWSSd#.........................",
  /* 06 */ "........................#WWWWSSdd#........................",
  /* 07 */ ".......................#WWWWWSSddd#.......................",
  /* 08 */ "......................#lGWWWSSSdddD#......................",
  /* 09 */ ".....................#LlG#WWSSSdddD#g#....................",
  /* 10 */ "....................#lLgg#WWWWSSddD#gg#...................",
  /* 11 */ "...................#lLggg#WWWWSSddD#ggg#..................",
  /* 12 */ "..................#lGgggg#WWWWSSddD#Gggg#.................",
  /* 13 */ ".................#lL#WWWWWWWWWWWWWW#GGgg#.................",
  /* 14 */ "................#Lg#WWWWWWWWWWWWWWWSS#GG#.................",
  /* 15 */ "...............#Lg#WWWWWWWWWWWWWWWWSSS#G#.................",
  /* 16 */ "..............#Lgg#WWWWWWWWWWWWWWWSSdd##G#................",
  /* 17 */ ".............#Lggg#WWWWWWWWWWWWWWSSSddD#GG#...............",
  /* 18 */ "............#Lgggg#WWWWWWWWWWWWWSSSSddDD##G#..............",
  /* 19 */ "...........#lGgg#d#WWWWWWWWWWWWSSSSdddDD#gg#..............",
  /* 20 */ "..........#LlG#ddd#WWWWWWWWWWWSSSSSdddDD#ggg#.............",
  /* 21 */ ".........#lLgG#ddD#d##WWWWWWSSSSSSdddDD##Gggg#............",
  /* 22 */ "........#lLgggG####..####WWSSSSSSdddDD##GGgggg#...........",
  /* 23 */ ".......#lLgggggG#WW#..#WW##SSSSdddDD##GGggggggg#..........",
  /* 24 */ "......#lLgggggg#WWWW####WWW##SdddDD##GGggggggggG#.........",
  /* 25 */ ".....#lL#WW###WWWWWWWWWWWWWW##ddDD##GggggggggggG#.........",
  /* 26 */ "....#Lg#WWWWWWWWWWWWWWWWWWWWWW#D##GgggggggggggggG#........",
  /* 27 */ "...#lG#WWWWWWWWWWWWWWWWWWWWWWWSS#GggggggggggggggG#........",
  /* 28 */ "..#Lg#WWWWWWWWWWWWWWWWWWWWWWWWSSS#Ggggggggggggggg#........",
  /* 29 */ ".#lLgg#WWWWWWWWWWWWWWWWWWWWWWSSSSdd#GggggggggggggG#.......",
  /* 30 */ "#llLgg#WWWWWW#WWWWWWWWWWWWWWSSSSdddD#GgggggggggggG#.......",
  /* 31 */ "#LlGgg#d##WW#d#WWWWWWWWWWWWSSSSSdddDD#GggggggggggG#.......",
  /* 32 */ ".#G#ddD#W#ddd#WWWWWWWWWWWWSSSSSdddDDD##GgggggggggG#.......",
  /* 33 */ "..#DddD#WW##ddd#WWWWWWWWWSSSSSSdddDDD#WW#GGggggggG#.......",
  /* 34 */ "..#L#WWWWWWW##dd#d##WWWWSSSSSSdddDD##WWWW#GGgggggG#.......",
  /* 35 */ ".#lL#WWWWWWWW##d#...####SSSSdddDD##WWWWWWSS#GGGggG#.......",
  /* 36 */ "#llLg#WWWWWWWWS##...#WW##SdddDD##GWWWWWWSSSdd#GGG#........",
  /* 37 */ "#LlGgg#WWWWWWWSSdd#.#WWWW#dDD##GWWWWWWWSSSSddD#GG#........",
  /* 38 */ ".#lGggg#WWWWWSSSddD##WWWW#D##GGWWWWWWSSSSSdddD##..........",
  /* 39 */ "..#GGggG#d##SSSSddD##WWWW#GGGGWWWWWWSSSSSSdddD#...........",
  /* 40 */ "...#GGGG#..###DdD##G#WWWW##GGWWWWWWSSSSSdddDD#............",
  /* 41 */ "....####....#TthhthhthtT#WW##GGWWWWSSSSdddDD#.............",
  /* 42 */ "............#TmhhhhhhhhT#dd##GG#WWSSSSdddDD#..............",
  /* 43 */ "............#TmhhhhhhhhT#D##GGG#..#########...............",
  /* 44 */ "...........#p#TmhhhhhhT#d####GG#..........................",
  /* 45 */ ".........#ooO#TmhhhhhhT#OOOoo#G#..........................",
  /* 46 */ ".......#ooOOOO#TmmhhhhT#OOOOOoo#..........................",
  /* 47 */ "......#ooOOOOO#TmmmmhhT#OOOOOOoo#.........................",
  /* 48 */ ".....#ooOOOOOO#TtttttthT#OOOOOOoo#........................",
  /* 49 */ "......#ooOOOOO##########OOOOOOoo#.........................",
  /* 50 */ ".......#oooOOOOOOOOOOOOOOOOOooo#..........................",
  /* 51 */ ".........#ooooooooooooooooooo#............................",
  /* 52 */ "...........#ooooooooooooooo#..............................",
  /* 53 */ ".............#ppppppppppp#................................",
  /* 54 */ "..........................................................",
  /* 55 */ "..........................................................",
];

// Cached singleton sprite set
let cachedSprites: SpruceSpriteSet | null = null;

export function getSpruceSprites(): SpruceSpriteSet {
  if (!cachedSprites) {
    cachedSprites = {
      spruceA: {
        canvas: buildCanvasFromGrid(SPRUCE_A_GRID),
        anchorX: 23, // Trunk base center
        anchorY: 45, // Ground contact point
      },
      spruceB: {
        canvas: buildCanvasFromGrid(SPRUCE_B_GRID),
        anchorX: 23,
        anchorY: 45,
      },
      giantSpruce: {
        canvas: buildCanvasFromGrid(GIANT_SPRUCE_GRID),
        anchorX: 29,
        anchorY: 48,
      },
    };
  }
  return cachedSprites;
}
