import {
  WorldTile,
  PlayerStats,
  CargoItem,
  PlacedStructure,
  AnomalyEntity,
  WeatherState,
  WeatherType,
  Footstep,
  TileType,
  WorldResourceNode,
  WorldNPC
} from '../types/game';
import { TILE_SIZE, STATIONS } from '../utils/constants';
import { getSpruceSprites } from './SpruceSprite';

export class TaigaRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not get canvas context');
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
  }

  private zoom: number = 1.0;

  public setZoom(zoom: number) {
    this.zoom = Math.max(0.65, Math.min(3.0, zoom));
  }

  public getZoom(): number {
    return this.zoom;
  }

  public render(
    tiles: WorldTile[][],
    player: PlayerStats,
    cargo: CargoItem[],
    structures: PlacedStructure[],
    anomalies: AnomalyEntity[],
    weather: WeatherState,
    footsteps: Footstep[],
    lostCaches: { id: string; x: number; y: number; name: string }[],
    snowParticles: { x: number; y: number; speed: number; size: number }[],
    time: number,
    resourceNodes: WorldResourceNode[] = [],
    npcs: WorldNPC[] = [],
    activeQuestTarget: { x: number; y: number; title: string } | null = null,
    zoom: number = 1.0
  ) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    this.zoom = Math.max(0.65, Math.min(3.0, zoom));
    const z = this.zoom;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Viewport dimensions in world-space coordinates
    const viewWidth = width / z;
    const viewHeight = height / z;

    // Camera centered on player
    const cameraX = Math.floor(player.x * TILE_SIZE - viewWidth / 2);
    const cameraY = Math.floor(player.y * TILE_SIZE - viewHeight / 2);

    // Visible tile bounds in world coordinates (expanded buffer so tall trees from below top edge don't clip)
    const minCol = Math.max(0, Math.floor(cameraX / TILE_SIZE) - 3);
    const maxCol = Math.min(tiles[0].length - 1, Math.ceil((cameraX + viewWidth) / TILE_SIZE) + 3);
    const minRow = Math.max(0, Math.floor(cameraY / TILE_SIZE) - 4);
    const maxRow = Math.min(tiles.length - 1, Math.ceil((cameraY + viewHeight) / TILE_SIZE) + 3);

    // =========================================================================
    // 1. WORLD-SPACE PASS: Scaled by Zoom factor (all world objects rendered here)
    // =========================================================================
    ctx.save();
    ctx.scale(z, z);

    // 1. Render Terrain Tiles
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const tile = tiles[r][c];
        const screenX = c * TILE_SIZE - cameraX;
        const screenY = r * TILE_SIZE - cameraY;

        this.drawTile(ctx, tile.type, screenX, screenY, c, r, z);

        // Terrain scan holographic overlay if scanned
        if (tile.scannedUntil && tile.scannedUntil > time) {
          const scanAlpha = Math.min(1, (tile.scannedUntil - time) / 2000);
          this.drawScanOverlay(ctx, tile.type, screenX, screenY, scanAlpha);
        }
      }
    }

    // 2. Render Footstep trail with lug tread detail at higher zoom
    for (const step of footsteps) {
      const sx = step.x * TILE_SIZE - cameraX;
      const sy = step.y * TILE_SIZE - cameraY;
      if (sx >= -20 && sx <= viewWidth + 20 && sy >= -20 && sy <= viewHeight + 20) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(step.angle);
        ctx.fillStyle = step.depth > 1 ? `rgba(140, 160, 185, ${step.alpha * 0.7})` : `rgba(180, 200, 220, ${step.alpha * 0.5})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // High zoom detail: boot tread lug profile
        if (z >= 1.25) {
          ctx.fillStyle = `rgba(90, 115, 140, ${step.alpha * 0.65})`;
          ctx.fillRect(-2, 2, 4, 2); // Heel
          ctx.fillRect(-2.5, -3, 5, 1); // Front lug
          ctx.fillRect(-2, -0.5, 4, 1); // Mid lug
          if (z >= 1.7) {
            ctx.fillStyle = `rgba(255, 255, 255, ${step.alpha * 0.55})`;
            ctx.fillRect(-3.5, -2, 1, 3);
            ctx.fillRect(2.5, -2, 1, 3);
          }
        }
        ctx.restore();
      }
    }

    // 3. Render Stations & Structures on ground
    this.drawStations(ctx, cameraX, cameraY, viewWidth, viewHeight, time, z);
    this.drawStructures(ctx, structures, cameraX, cameraY, time, z);

    // 4. Lost Caches on ground
    for (const cache of lostCaches) {
      const sx = cache.x * TILE_SIZE - cameraX;
      const sy = cache.y * TILE_SIZE - cameraY;
      if (sx >= -40 && sx <= viewWidth + 40 && sy >= -40 && sy <= viewHeight + 40) {
        this.drawLostContainer(ctx, sx, sy, time, z);
      }
    }

    // 5. Natural Resource Nodes in the Taiga
    this.drawResourceNodes(ctx, resourceNodes, cameraX, cameraY, time, player, z);

    // 6. Active Quest Objective Holographic Waypoint
    this.drawQuestObjective(ctx, activeQuestTarget, cameraX, cameraY, time);

    // 7. Trees and natural obstacles (Y-sorted with entities for natural depth)
    const campfires = structures.filter(s => s.type === 'CAMPFIRE');
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const tile = tiles[r][c];
        if (tile.tree) {
          const sx = c * TILE_SIZE - cameraX + TILE_SIZE / 2;
          const sy = r * TILE_SIZE - cameraY + TILE_SIZE / 2;
          this.drawTree(ctx, tile.tree, sx, sy, c, r, time, campfires, cameraX, cameraY, z);
        }
      }
    }

    // 8. World NPCs (Taras, Stepan, Ulukitkan, Vera)
    this.drawWorldNPCs(ctx, npcs, cameraX, cameraY, time, player, z);

    // 9. Anomalies
    for (const anom of anomalies) {
      const sx = anom.x * TILE_SIZE - cameraX;
      const sy = anom.y * TILE_SIZE - cameraY;
      if (sx >= -100 && sx <= viewWidth + 100 && sy >= -100 && sy <= viewHeight + 100) {
        this.drawAnomaly(ctx, anom, sx, sy, time, player, z);
      }
    }

    // 10. Scanner Pulse wave effect
    if (player.scannerActive && player.scannerPulseProgress < 1.0) {
      const px = player.x * TILE_SIZE - cameraX;
      const py = player.y * TILE_SIZE - cameraY;
      const radius = player.scannerPulseProgress * 280;
      ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0, 1 - player.scannerPulseProgress)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner ping ring
      ctx.strokeStyle = `rgba(125, 211, 252, ${Math.max(0, 0.7 - player.scannerPulseProgress * 0.7)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0, radius - 15), 0, Math.PI * 2);
      ctx.stroke();
    }

    // 11. Player Courier & Stacked Cargo Containers
    const pScreenX = player.x * TILE_SIZE - cameraX;
    const pScreenY = player.y * TILE_SIZE - cameraY;
    this.drawCourier(ctx, player, cargo, pScreenX, pScreenY, time, anomalies, z);

    // 12. Dynamic Twilight Lighting Pass (Cozy fire illumination & atmospheric twilight dusk)
    this.drawDynamicLighting(ctx, structures, pScreenX, pScreenY, viewWidth, viewHeight, time, weather, cameraX, cameraY);

    ctx.restore(); // Restore from world scale(z, z)

    // =========================================================================
    // 2. SCREEN-SPACE PASS: Full Resolution (1:1 viewport pixels)
    // =========================================================================
    // 13. Weather overlay (Snow particles, blizzard mist, aurora borealis, starry sky)
    this.drawWeather(ctx, weather, snowParticles, width, height, time, z);

    // 14. Vignette & Frost on screen edges
    this.drawScreenFrost(ctx, width, height, player.warmth, weather);

    ctx.restore(); // Restore from initial root save
  }

  // Draw tile textures matching the arctic/tundra pixel-art reference aesthetics with dynamic LOD
  private drawTile(ctx: CanvasRenderingContext2D, type: TileType, x: number, y: number, col: number, row: number, zoom: number = 1.0) {
    switch (type) {
      case 'SNOW_HARD': {
        // Crisp northern tundra snow with subtle wind-carved sastrugi drifts (Ref Screenshot 2 & 3)
        ctx.fillStyle = (col + row) % 2 === 0 ? '#EAF1F7' : '#F3F8FC';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Wind-sculpted sastrugi ridges (diagonal drift crests)
        const drift = (col * 5 + row * 11) % 7;
        if (drift === 0 || drift === 3) {
          ctx.fillStyle = '#BED0E0';
          ctx.fillRect(x + 2, y + 8, 16, 2);
          ctx.fillStyle = '#A2B8CC';
          ctx.fillRect(x + 3, y + 10, 14, 1);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x + 1, y + 7, 12, 1);
        } else if (drift === 5) {
          ctx.fillStyle = '#C5D6E5';
          ctx.fillRect(x + 14, y + 20, 14, 2);
          ctx.fillStyle = '#A9BFD3';
          ctx.fillRect(x + 15, y + 22, 11, 1);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x + 13, y + 19, 10, 1);
        }

        // Crystalline snow sparkle flecks
        if ((col * 13 + row * 7) % 11 === 0) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x + 8, y + 14, 1, 1);
          ctx.fillRect(x + 24, y + 6, 1, 1);
        }

        // Fallen dry pine needle specks on snow crust
        if ((col * 17 + row * 23) % 13 === 0) {
          ctx.fillStyle = '#3D2F24';
          ctx.fillRect(x + 18, y + 16, 3, 1);
          ctx.fillRect(x + 20, y + 15, 1, 2);
        }

        // --- PROGRESSIVE LEVEL OF DETAIL (LOD) ---
        if (zoom >= 1.25) {
          // Extra sastrugi wind ripples & crust shading
          ctx.fillStyle = '#CBDCEB';
          ctx.fillRect(x + 6, y + 24, 18, 1);
          ctx.fillRect(x + 10, y + 4, 12, 1);

          // Tiny wildlife ptarmigan/hare tracks on the crust
          if ((col * 9 + row * 13) % 8 === 2) {
            ctx.fillStyle = '#9FB4C7';
            ctx.fillRect(x + 12, y + 13, 2, 1);
            ctx.fillRect(x + 16, y + 10, 2, 1);
            ctx.fillRect(x + 20, y + 7, 2, 1);
          }

          if (zoom >= 1.7) {
            // Micro-crystalline firn snow facets (glinting ice crystals)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x + 4, y + 5, 1, 1);
            ctx.fillRect(x + 19, y + 23, 1, 1);
            ctx.fillRect(x + 27, y + 12, 1, 1);
            ctx.fillStyle = '#D2E3F1';
            ctx.fillRect(x + 5, y + 6, 1, 1);
            ctx.fillRect(x + 20, y + 24, 1, 1);
          }
        }
        break;
      }

      case 'SNOW_DEEP': {
        // Billowing powder snowbanks with rich slate-blue shade contours (Ref Screenshot 2 & 3)
        ctx.fillStyle = '#B8CCE0';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Undulating snow pillows
        ctx.fillStyle = '#8FA8C0'; // Deep drift shadow
        ctx.fillRect(x + 1, y + 16, 22, 8);
        ctx.fillRect(x + 12, y + 12, 18, 10);

        ctx.fillStyle = '#D6E5F2'; // Soft snow midtone
        ctx.fillRect(x + 1, y + 10, 20, 7);
        ctx.fillRect(x + 12, y + 6, 18, 7);

        ctx.fillStyle = '#FFFFFF'; // Bright pillow crests
        ctx.fillRect(x + 3, y + 8, 16, 2);
        ctx.fillRect(x + 14, y + 4, 14, 2);

        // --- PROGRESSIVE LEVEL OF DETAIL (LOD) ---
        if (zoom >= 1.25) {
          // Fine powder cornice drop shadow and secondary drifts
          ctx.fillStyle = '#7892AA';
          ctx.fillRect(x + 5, y + 21, 14, 2);
          ctx.fillStyle = '#E5EFF8';
          ctx.fillRect(x + 6, y + 7, 10, 1);

          if (zoom >= 1.7) {
            // Individual soft powder clumps and micro-shadows
            ctx.fillStyle = '#A3B8CC';
            ctx.fillRect(x + 2, y + 14, 3, 2);
            ctx.fillRect(x + 23, y + 18, 3, 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x + 2, y + 13, 2, 1);
            ctx.fillRect(x + 23, y + 17, 2, 1);
          }
        }
        break;
      }

      case 'ICE_RIVER': {
        // Glaciated Siberian river ice (Ref Screenshot 3)
        ctx.fillStyle = '#4D728E';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Translucent ice plates
        ctx.fillStyle = '#658BA7';
        ctx.fillRect(x + 1, y + 2, TILE_SIZE - 2, TILE_SIZE - 4);
        ctx.fillStyle = '#7CA1BE';
        ctx.fillRect(x + 3, y + 4, TILE_SIZE - 6, TILE_SIZE - 8);

        // Crystalline fracture fissures & veins (distinct pixel angles)
        const crackVariant = (col * 3 + row * 7) % 4;
        ctx.fillStyle = '#9FC3DE';
        if (crackVariant === 0) {
          ctx.fillRect(x + 4, y + 8, 14, 1);
          ctx.fillRect(x + 17, y + 9, 2, 7);
          ctx.fillRect(x + 18, y + 16, 10, 1);
          ctx.fillRect(x + 27, y + 17, 2, 8);
          ctx.fillStyle = '#EDF6FD';
          ctx.fillRect(x + 6, y + 7, 8, 1);
          ctx.fillRect(x + 19, y + 15, 6, 1);
        } else if (crackVariant === 1) {
          ctx.fillRect(x + 2, y + 18, 12, 1);
          ctx.fillRect(x + 13, y + 14, 2, 5);
          ctx.fillRect(x + 14, y + 13, 14, 1);
          ctx.fillStyle = '#EDF6FD';
          ctx.fillRect(x + 15, y + 12, 9, 1);
        } else if (crackVariant === 2) {
          ctx.fillRect(x + 8, y + 4, 2, 12);
          ctx.fillRect(x + 9, y + 15, 12, 1);
          ctx.fillRect(x + 20, y + 16, 2, 11);
          ctx.fillStyle = '#EDF6FD';
          ctx.fillRect(x + 11, y + 14, 7, 1);
        } else {
          ctx.fillRect(x + 6, y + 22, 18, 1);
          ctx.fillRect(x + 14, y + 8, 1, 14);
          ctx.fillStyle = '#EDF6FD';
          ctx.fillRect(x + 8, y + 21, 10, 1);
        }

        // Frozen sub-surface air bubble clusters
        ctx.fillStyle = '#CBE1F2';
        ctx.fillRect(x + 7, y + 11, 2, 2);
        ctx.fillRect(x + 22, y + 21, 2, 2);
        ctx.fillRect(x + 24, y + 9, 1, 1);

        // Frosty shoreline snow encroachments on edges
        if (col % 4 === 0) {
          ctx.fillStyle = '#D6E5F2';
          ctx.fillRect(x, y, 4, 6);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x, y, 2, 4);
        }

        // --- PROGRESSIVE LEVEL OF DETAIL (LOD) ---
        if (zoom >= 1.25) {
          // Secondary hairline stress cracks branching off primary fissures
          ctx.fillStyle = '#BCE0F5';
          ctx.fillRect(x + 10, y + 9, 5, 1);
          ctx.fillRect(x + 15, y + 10, 1, 4);
          ctx.fillRect(x + 21, y + 17, 4, 1);

          // Deep spherical air bubble 3D highlights
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x + 7, y + 11, 1, 1);
          ctx.fillRect(x + 22, y + 21, 1, 1);

          if (zoom >= 1.7) {
            // Microscopic sled runner skate scratches & cyan prismatic refraction
            ctx.fillStyle = '#67E8F9';
            ctx.fillRect(x + 14, y + 14, 6, 1);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(x + 3, y + 19, 11, 1);
            ctx.fillRect(x + 18, y + 7, 9, 1);
          }
        }
        break;
      }

      case 'ROCKS': {
        // Stratified mountain granite with rounded snow-caps (Ref Screenshot 2 & 4)
        ctx.fillStyle = '#263341';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Jagged stone facets
        ctx.fillStyle = '#1B242F'; // Deep stone shadow
        ctx.fillRect(x + 2, y + 10, 20, 16);
        ctx.fillStyle = '#394B5E'; // Granite body
        ctx.fillRect(x + 4, y + 7, 18, 15);
        ctx.fillStyle = '#546A80'; // Upper stone plane
        ctx.fillRect(x + 5, y + 6, 16, 8);
        ctx.fillStyle = '#768EAA'; // Rock edge bevel
        ctx.fillRect(x + 6, y + 6, 14, 2);

        // Smooth rounded snow mantle draped over the rock top (Ref Screenshot 2)
        ctx.fillStyle = '#9FB6CC'; // Cold snow under-shadow
        ctx.fillRect(x + 4, y + 4, 18, 3);
        ctx.fillStyle = '#DCE8F3'; // Snow midtone
        ctx.fillRect(x + 5, y + 2, 16, 3);
        ctx.fillStyle = '#FFFFFF'; // Sunlit snow crest
        ctx.fillRect(x + 7, y + 1, 12, 2);

        // Lichen / moss trace in stone crack
        if ((col + row) % 3 === 0) {
          ctx.fillStyle = '#495B44';
          ctx.fillRect(x + 8, y + 15, 3, 4);
        }

        // --- PROGRESSIVE LEVEL OF DETAIL (LOD) ---
        if (zoom >= 1.25) {
          // Orange Xanthoria arctic lichen crusts & sharp fracture facets
          ctx.fillStyle = '#D97706';
          ctx.fillRect(x + 15, y + 12, 2, 2);
          ctx.fillRect(x + 18, y + 14, 3, 2);
          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(x + 16, y + 13, 1, 1);

          // Scree talus chips at the base
          ctx.fillStyle = '#182029';
          ctx.fillRect(x + 1, y + 27, 4, 3);
          ctx.fillRect(x + 24, y + 26, 5, 4);
          ctx.fillStyle = '#475569';
          ctx.fillRect(x + 2, y + 27, 2, 2);

          if (zoom >= 1.7) {
            // Quartz mineral veins slicing through dark granite
            ctx.fillStyle = '#E2E8F0';
            ctx.fillRect(x + 8, y + 8, 1, 5);
            ctx.fillRect(x + 9, y + 13, 1, 4);
            ctx.fillRect(x + 10, y + 17, 1, 3);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x + 8, y + 10, 1, 2);
          }
        }
        break;
      }

      case 'CLIFF': {
        // Blocky stratified cliff steps with deep drop shadows (Ref Screenshot 4)
        ctx.fillStyle = '#121A23'; // Chasm shadow
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Vertical stratified rock bands
        ctx.fillStyle = '#222F3D';
        ctx.fillRect(x + 1, y + 5, TILE_SIZE - 2, TILE_SIZE - 5);
        ctx.fillStyle = '#37495C';
        ctx.fillRect(x + 2, y + 4, TILE_SIZE - 4, 9);
        ctx.fillStyle = '#4F647B';
        ctx.fillRect(x + 4, y + 3, TILE_SIZE - 8, 4);

        // Stone shelf horizontal ledges
        ctx.fillStyle = '#18222C';
        ctx.fillRect(x + 2, y + 16, TILE_SIZE - 4, 3);
        ctx.fillStyle = '#2D3D4E';
        ctx.fillRect(x + 3, y + 18, TILE_SIZE - 6, 8);

        // Top ledge snow rim
        ctx.fillStyle = '#9EB5CB';
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 2);
        ctx.fillStyle = '#E6F0F8';
        ctx.fillRect(x + 4, y + 1, TILE_SIZE - 8, 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x + 7, y, TILE_SIZE - 14, 2);

        // --- PROGRESSIVE LEVEL OF DETAIL (LOD) ---
        if (zoom >= 1.25) {
          // Sedimentary stratum lines & hanging mini-icicles
          ctx.fillStyle = '#5A6F87';
          ctx.fillRect(x + 4, y + 9, TILE_SIZE - 8, 1);
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(x + 3, y + 10, TILE_SIZE - 6, 1);

          // Hanging mini icicles under ledge
          ctx.fillStyle = '#BAE6FD';
          ctx.fillRect(x + 8, y + 5, 2, 3);
          ctx.fillRect(x + 18, y + 5, 2, 4);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x + 8, y + 5, 1, 2);

          if (zoom >= 1.7) {
            // Scree erosion grooves and deep vertical cracks
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(x + 12, y + 6, 1, 14);
            ctx.fillRect(x + 22, y + 11, 1, 10);
          }
        }
        break;
      }

      case 'FROZEN_BOG': {
        // Cold northern tundra peat with sage lichen & crimson berry shrubs (Ref Screenshot 1)
        ctx.fillStyle = '#3C3127';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Sage-green olive lichen patches
        ctx.fillStyle = '#778A73';
        ctx.fillRect(x + 2, y + 2, 14, 12);
        ctx.fillRect(x + 14, y + 12, 14, 14);
        ctx.fillStyle = '#8F9F8B';
        ctx.fillRect(x + 4, y + 4, 10, 8);
        ctx.fillRect(x + 16, y + 14, 10, 10);

        // Dried golden-buff tundra straw
        ctx.fillStyle = '#B4A57C';
        ctx.fillRect(x + 18, y + 3, 10, 7);
        ctx.fillRect(x + 3, y + 17, 9, 8);
        ctx.fillStyle = '#8F815C';
        ctx.fillRect(x + 19, y + 6, 8, 3);
        ctx.fillRect(x + 4, y + 20, 7, 3);

        // Clusters of deep crimson dwarf cranberry / heather shrubs (Ref Screenshot 1)
        ctx.fillStyle = '#701D1D';
        ctx.fillRect(x + 5, y + 8, 5, 4);
        ctx.fillRect(x + 21, y + 18, 6, 5);
        ctx.fillStyle = '#9C2B2B';
        ctx.fillRect(x + 6, y + 9, 4, 3);
        ctx.fillRect(x + 22, y + 19, 4, 3);
        // Bright ruby/pink lingonberry dots
        ctx.fillStyle = '#E11D48';
        ctx.fillRect(x + 6, y + 8, 2, 2);
        ctx.fillRect(x + 22, y + 18, 2, 2);
        ctx.fillRect(x + 24, y + 21, 2, 2);
        ctx.fillStyle = '#FDA4AF';
        ctx.fillRect(x + 7, y + 8, 1, 1);
        ctx.fillRect(x + 23, y + 18, 1, 1);

        // Frozen ice glaze puddles
        ctx.fillStyle = '#5A7285';
        ctx.fillRect(x + 12, y + 7, 6, 4);
        ctx.fillStyle = '#C0D5E4';
        ctx.fillRect(x + 13, y + 8, 4, 2);

        // --- PROGRESSIVE LEVEL OF DETAIL (LOD) ---
        if (zoom >= 1.25) {
          // Reindeer lichen (ягель) pale tufts & fine moss fibers
          ctx.fillStyle = '#D1D5DB';
          ctx.fillRect(x + 7, y + 3, 4, 2);
          ctx.fillRect(x + 17, y + 15, 4, 2);
          ctx.fillStyle = '#15803D'; // Dark evergreen leaves around berries
          ctx.fillRect(x + 5, y + 10, 2, 2);
          ctx.fillRect(x + 20, y + 21, 2, 2);

          if (zoom >= 1.7) {
            // Glossy lingonberry highlights & frost rime on dried grass stems
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x + 6, y + 8, 1, 1);
            ctx.fillRect(x + 22, y + 18, 1, 1);
            ctx.fillStyle = '#F3F4F6';
            ctx.fillRect(x + 19, y + 4, 1, 4);
            ctx.fillRect(x + 5, y + 18, 1, 4);
          }
        }
        break;
      }

      case 'OLD_ROAD': {
        // Natural mountain stone path with irregular flagstones & gravel (Ref Screenshot 4)
        ctx.fillStyle = '#524438'; // Compacted gravel/soil base
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Natural stone pavers and flagstones
        ctx.fillStyle = '#657687';
        ctx.fillRect(x + 2, y + 2, 11, 10);
        ctx.fillRect(x + 15, y + 3, 9, 9);
        ctx.fillRect(x + 3, y + 15, 10, 9);
        ctx.fillRect(x + 16, y + 14, 10, 11);

        // Paver top bevel highlights
        ctx.fillStyle = '#8799AA';
        ctx.fillRect(x + 3, y + 2, 9, 2);
        ctx.fillRect(x + 16, y + 3, 7, 2);
        ctx.fillRect(x + 4, y + 15, 8, 2);
        ctx.fillRect(x + 17, y + 14, 8, 2);
        ctx.fillStyle = '#B4C5D4';
        ctx.fillRect(x + 4, y + 2, 4, 1);
        ctx.fillRect(x + 17, y + 3, 4, 1);

        // Dirt and dark moss in flagstone joints
        ctx.fillStyle = '#223223';
        ctx.fillRect(x + 13, y, 2, TILE_SIZE);
        ctx.fillRect(x, y + 12, TILE_SIZE, 2);

        // Alpine cranberry sprig sprouting along trail edge
        if ((col + row) % 3 === 0) {
          ctx.fillStyle = '#E11D48';
          ctx.fillRect(x + 1, y + 1, 2, 2);
          ctx.fillStyle = '#166534';
          ctx.fillRect(x + 2, y + 3, 2, 1);
        }

        // --- PROGRESSIVE LEVEL OF DETAIL (LOD) ---
        if (zoom >= 1.25) {
          // Sled runner compression groove tracks in snow/dirt
          ctx.fillStyle = '#372B23';
          ctx.fillRect(x + 7, y, 2, TILE_SIZE);
          ctx.fillRect(x + 23, y, 2, TILE_SIZE);
          ctx.fillStyle = '#6B7280';
          ctx.fillRect(x + 8, y + 4, 1, 6);
          ctx.fillRect(x + 24, y + 12, 1, 6);

          if (zoom >= 1.7) {
            // Fine frost crystals and individual gravel grains
            ctx.fillStyle = '#E2E8F0';
            ctx.fillRect(x + 6, y + 8, 1, 2);
            ctx.fillRect(x + 22, y + 16, 1, 2);
            ctx.fillStyle = '#9CA3AF';
            ctx.fillRect(x + 11, y + 18, 2, 2);
          }
        }
        break;
      }

      case 'STATION_PLATFORM': {
        // Heavy Siberian timber duckboards & decking
        ctx.fillStyle = '#3E2A1C';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Weathered pine timber planks
        ctx.fillStyle = '#684A33';
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 5);
        ctx.fillRect(x + 2, y + 9, TILE_SIZE - 4, 5);
        ctx.fillRect(x + 2, y + 16, TILE_SIZE - 4, 5);
        ctx.fillRect(x + 2, y + 23, TILE_SIZE - 4, 5);

        // Wood grain highlights
        ctx.fillStyle = '#8A6649';
        ctx.fillRect(x + 4, y + 3, 14, 2);
        ctx.fillRect(x + 6, y + 10, 13, 2);
        ctx.fillRect(x + 5, y + 17, 15, 2);

        // Forged iron rivets & frost rime
        ctx.fillStyle = '#1C1917';
        ctx.fillRect(x + 3, y + 4, 2, 2);
        ctx.fillRect(x + TILE_SIZE - 5, y + 4, 2, 2);
        ctx.fillStyle = '#D6E4F0'; // Frost along board edge
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 1);

        // --- PROGRESSIVE LEVEL OF DETAIL (LOD) ---
        if (zoom >= 1.25) {
          // Yellow hazard anti-slip grip grooves and industrial bolt washers
          ctx.fillStyle = '#CA8A04';
          ctx.fillRect(x + 4, y + 2, 4, 1);
          ctx.fillRect(x + 12, y + 2, 4, 1);
          ctx.fillRect(x + 20, y + 2, 4, 1);
          ctx.fillStyle = '#44403C';
          ctx.fillRect(x + 2, y + 11, 2, 2);
          ctx.fillRect(x + TILE_SIZE - 4, y + 11, 2, 2);

          if (zoom >= 1.7) {
            // Wood knot rings & fine snow dusting trapped in plank grooves
            ctx.fillStyle = '#452A18';
            ctx.fillRect(x + 18, y + 18, 3, 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x + 3, y + 7, TILE_SIZE - 6, 1);
            ctx.fillRect(x + 3, y + 14, TILE_SIZE - 6, 1);
          }
        }
        break;
      }
    }
  }

  // Odradek-like terrain scanner overlay (Death Stranding holographic icons)
  private drawScanOverlay(ctx: CanvasRenderingContext2D, type: TileType, x: number, y: number, alpha: number) {
    ctx.save();
    ctx.globalAlpha = alpha;

    if (type === 'SNOW_HARD' || type === 'OLD_ROAD' || type === 'STATION_PLATFORM') {
      // Safe terrain: Blue topographic square with small cross
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(x + 15, y + 14, 2, 4);
      ctx.fillRect(x + 14, y + 15, 4, 2);
    } else if (type === 'SNOW_DEEP' || type === 'FROZEN_BOG') {
      // Rough terrain: Yellow topographic cross and warning dot
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(x + 16, y + 16, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'ICE_RIVER' || type === 'ROCKS' || type === 'CLIFF') {
      // Hazardous terrain: Red hazard stripes and exclamation
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      // Diagonal hazard line
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 4);
      ctx.lineTo(x + TILE_SIZE - 4, y + TILE_SIZE - 4);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draw Taiga Trees (Pine, Giant Pine, Siberian Larch, Birch, Red Berry Bush, Deadwood)
  private drawTree(
    ctx: CanvasRenderingContext2D,
    tree: 'PINE' | 'BIRCH' | 'DEAD_TREE' | 'BUSH' | 'GIANT_PINE' | 'RED_BERRY_BUSH' | 'LARCH',
    x: number,
    y: number,
    c: number,
    r: number,
    time: number,
    campfires: PlacedStructure[] = [],
    cameraX: number = 0,
    cameraY: number = 0,
    zoom: number = 1.0
  ) {
    ctx.save();
    // Subtle organic wind sway
    const sway = Math.sin(time * 0.002 + c * 1.3 + r * 0.7) * 1.4;

    // Check campfire proximity to render warm firelight bounce
    let fireDist = 999;
    let fireDir = 1; // 1 = campfire is to the left, -1 = right
    for (const fire of campfires) {
      const fsx = fire.x * TILE_SIZE - cameraX;
      const fsy = fire.y * TILE_SIZE - cameraY;
      const d = Math.hypot(x - fsx, y - fsy);
      if (d < fireDist) {
        fireDist = d;
        fireDir = x > fsx ? 1 : -1;
      }
    }
    const hasFireGlow = fireDist < 140;
    const fireIntensity = hasFireGlow ? Math.max(0, 1 - fireDist / 140) : 0;

    if (tree === 'PINE' || tree === 'GIANT_PINE') {
      // Hand-crafted Siberian Fir / Taiga Spruce matching the user's pixel-art reference
      this.drawReferenceSpruce(
        ctx,
        x,
        y,
        c,
        r,
        sway,
        hasFireGlow,
        fireIntensity,
        fireDir,
        zoom,
        tree === 'GIANT_PINE'
      );
    } else if (tree === 'LARCH') {
      // Slender, delicate Siberian Larch (лиственница) with fine frosted branches (Ref Screenshot 2)
      // Ground shadow
      ctx.fillStyle = 'rgba(28, 42, 60, 0.28)';
      ctx.beginPath();
      ctx.ellipse(x + 1, y + 8, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tall, tapering brown bark trunk
      ctx.fillStyle = '#261C16';
      ctx.fillRect(x - 2, y - 18, 4, 26);
      ctx.fillStyle = '#3E2E24';
      ctx.fillRect(x - 1, y - 16, 2, 24);
      ctx.fillStyle = '#5A4638';
      ctx.fillRect(x, y - 14, 1, 20);

      // Delicate fine branching structure with rime frost
      ctx.strokeStyle = '#3E2E24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Lower branches
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x - 10 + sway * 0.4, y - 7);
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 11 + sway * 0.4, y - 9);
      // Mid branches
      ctx.moveTo(x, y - 11);
      ctx.lineTo(x - 8 + sway * 0.6, y - 16);
      ctx.moveTo(x, y - 13);
      ctx.lineTo(x + 8 + sway * 0.6, y - 18);
      // Crown twigs
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x - 5 + sway * 0.8, y - 26);
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x + 5 + sway * 0.8, y - 26);
      ctx.stroke();

      // Frost needle tufts & snow clumps resting on branch nodes
      ctx.fillStyle = '#9EB5CC';
      ctx.fillRect(x - 9 + sway * 0.4, y - 8, 5, 2);
      ctx.fillRect(x + 8 + sway * 0.4, y - 10, 5, 2);
      ctx.fillRect(x - 7 + sway * 0.6, y - 17, 4, 2);
      ctx.fillRect(x + 6 + sway * 0.6, y - 19, 4, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - 8 + sway * 0.4, y - 9, 3, 1);
      ctx.fillRect(x + 9 + sway * 0.4, y - 11, 3, 1);
      ctx.fillRect(x - 1, y - 20, 2, 2);

      // Progressive LOD: Frozen cones and rime crystals
      if (zoom >= 1.25) {
        ctx.fillStyle = '#221711';
        ctx.fillRect(x - 9 + sway * 0.4, y - 6, 2, 2);
        ctx.fillRect(x + 10 + sway * 0.4, y - 8, 2, 2);
        ctx.fillStyle = '#E0F2FE';
        ctx.fillRect(x - 9 + sway * 0.4, y - 7, 2, 1);

        if (zoom >= 1.7) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x - 5 + sway * 0.4, y - 14, 1, 1);
          ctx.fillRect(x + 6 + sway * 0.4, y - 16, 1, 1);
        }
      }
    } else if (tree === 'BIRCH') {
      // Elegant Siberian Birch (берёза) with white bark and dark lenticels
      ctx.fillStyle = 'rgba(28, 42, 60, 0.28)';
      ctx.beginPath();
      ctx.ellipse(x + 1, y + 8, 10, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#E8EEF5'; // White bark
      ctx.fillRect(x - 2, y - 20, 4, 28);
      ctx.fillStyle = '#BCC8D4'; // Shadow side
      ctx.fillRect(x + 1, y - 20, 1, 28);

      // Authentic dark horizontal bark notches & lenticels
      ctx.fillStyle = '#1A1D22';
      ctx.fillRect(x - 2, y - 14, 3, 2);
      ctx.fillRect(x, y - 7, 2, 2);
      ctx.fillRect(x - 2, y + 1, 4, 2);
      ctx.fillRect(x - 1, y + 5, 2, 2);

      // Fine wintry branches
      ctx.strokeStyle = '#4A3B30';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x - 10 + sway * 0.7, y - 23);
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 10 + sway * 0.7, y - 20);
      ctx.stroke();

      // Frosted branch tips
      ctx.fillStyle = '#D6E4F0';
      ctx.fillRect(x - 9 + sway * 0.7, y - 24, 4, 2);
      ctx.fillRect(x + 8 + sway * 0.7, y - 21, 4, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - 8 + sway * 0.7, y - 24, 2, 1);
      ctx.fillRect(x + 9 + sway * 0.7, y - 21, 2, 1);

      if (zoom >= 1.25) {
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(x - 2, y - 17, 2, 1);
        ctx.fillRect(x, y - 11, 3, 1);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - 3, y - 12, 1, 3);

        if (zoom >= 1.7) {
          ctx.fillStyle = '#C8B69E';
          ctx.fillRect(x - 10 + sway * 0.7, y - 21, 1, 3);
          ctx.fillRect(x + 10 + sway * 0.7, y - 18, 1, 3);
        }
      }
    } else if (tree === 'RED_BERRY_BUSH') {
      // Natural tundra hummock with snow pillows and scarlet lingonberries (Ref Screenshot 2)
      // Ground shadow
      ctx.fillStyle = 'rgba(28, 42, 60, 0.32)';
      ctx.beginPath();
      ctx.ellipse(x, y + 6, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rounded peat / frozen humus base
      ctx.fillStyle = '#1D130C';
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 11, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2F1E14';
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dark evergreen heather/lingonberry foliage
      ctx.fillStyle = '#12251A';
      ctx.fillRect(x - 9, y - 1, 4, 3);
      ctx.fillRect(x - 4, y, 4, 3);
      ctx.fillRect(x + 1, y - 1, 4, 3);
      ctx.fillRect(x + 6, y, 4, 3);
      ctx.fillStyle = '#1B3B2B';
      ctx.fillRect(x - 8, y, 2, 2);
      ctx.fillRect(x + 7, y + 1, 2, 2);

      // Deep ruby & crimson lingonberry clusters
      ctx.fillStyle = '#9F1239';
      ctx.fillRect(x - 7, y + 1, 3, 3);
      ctx.fillRect(x - 2, y + 2, 3, 3);
      ctx.fillRect(x + 3, y + 1, 3, 3);
      ctx.fillRect(x + 7, y + 2, 3, 3);

      ctx.fillStyle = '#E11D48'; // Bright scarlet
      ctx.fillRect(x - 7, y + 1, 2, 2);
      ctx.fillRect(x - 2, y + 2, 2, 2);
      ctx.fillRect(x + 3, y + 1, 2, 2);
      ctx.fillRect(x + 7, y + 2, 2, 2);

      // Specular berry shine
      ctx.fillStyle = '#FECDD3';
      ctx.fillRect(x - 7, y + 1, 1, 1);
      ctx.fillRect(x - 2, y + 2, 1, 1);
      ctx.fillRect(x + 3, y + 1, 1, 1);
      ctx.fillRect(x + 7, y + 2, 1, 1);

      // Drooping snow pillow crest on top of mound
      ctx.fillStyle = '#4B6278'; // Underside shadow
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#8AA5BF'; // Midtone
      ctx.beginPath();
      ctx.ellipse(x, y - 3, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#CDE0EF'; // Light
      ctx.beginPath();
      ctx.ellipse(x, y - 4, 7, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF'; // Bright crest
      ctx.beginPath();
      ctx.ellipse(x, y - 5, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Progressive LOD: fine leaf serrations and frost crystals
      if (zoom >= 1.25) {
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(x - 9, y - 1, 1, 1);
        ctx.fillRect(x + 8, y, 1, 1);
        if (zoom >= 1.7) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x - 5, y - 4, 1, 1);
          ctx.fillRect(x + 4, y - 4, 1, 1);
        }
      }
    } else if (tree === 'DEAD_TREE') {
      // Gnarled weathered deadwood snag
      ctx.fillStyle = 'rgba(28, 42, 60, 0.28)';
      ctx.beginPath();
      ctx.ellipse(x + 1, y + 7, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#241B15';
      ctx.fillRect(x - 2, y - 14, 4, 21);
      ctx.fillStyle = '#3D2F25';
      ctx.fillRect(x - 1, y - 12, 2, 18);

      ctx.strokeStyle = '#241B15';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x - 8, y - 16);
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 7, y - 12);
      ctx.stroke();

      // Snow cap on dead stump
      ctx.fillStyle = '#B4C8DC';
      ctx.fillRect(x - 3, y - 15, 6, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - 2, y - 16, 4, 2);

      if (zoom >= 1.25) {
        ctx.fillStyle = '#17100D';
        ctx.fillRect(x - 1, y - 7, 1, 9);
        ctx.fillStyle = '#8FA382';
        ctx.fillRect(x - 2, y, 1, 3);
      }
    } else if (tree === 'BUSH') {
      // Natural tundra snow hummock with willow twigs (Ref Screenshot 2)
      ctx.fillStyle = 'rgba(28, 42, 60, 0.32)';
      ctx.beginPath();
      ctx.ellipse(x, y + 5, 12, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#261A12';
      ctx.beginPath();
      ctx.ellipse(x, y + 3, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Exposed dark willow twigs
      ctx.strokeStyle = '#3E2A1C';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 2);
      ctx.lineTo(x - 9, y - 2);
      ctx.moveTo(x + 5, y + 2);
      ctx.lineTo(x + 8, y - 2);
      ctx.stroke();

      // Pillow snow mound
      ctx.fillStyle = '#4B6278';
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8AA5BF';
      ctx.beginPath();
      ctx.ellipse(x, y - 3.5, 8, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#CDE0EF';
      ctx.beginPath();
      ctx.ellipse(x, y - 4.5, 7, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(x, y - 5.5, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Authentic Handcrafted Pixel-Art Siberian Spruce matching the user's reference
  private drawReferenceSpruce(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    c: number,
    r: number,
    sway: number,
    hasFireGlow: boolean,
    fireIntensity: number,
    fireDir: number,
    zoom: number = 1.0,
    isGiant: boolean = false
  ) {
    const sprites = getSpruceSprites();
    const isVariantB = !isGiant && (c * 19 + r * 37) % 2 === 1;
    const spriteDef = isGiant
      ? sprites.giantSpruce
      : isVariantB
      ? sprites.spruceB
      : sprites.spruceA;

    const sprite = spriteDef.canvas;
    const anchorX = spriteDef.anchorX;
    const anchorY = spriteDef.anchorY;

    const drawX = Math.round(x - anchorX);
    const drawY = Math.round(y + 8 - anchorY);

    ctx.save();
    // Guarantee 100% crisp pixel art rendering without blur or antialiasing
    ctx.imageSmoothingEnabled = false;

    // Subtle integer pixel sway on upper crown (true retro pixel-art animation)
    const pixelSway = Math.round(sway * 0.7);

    if (pixelSway !== 0) {
      // Draw lower base/trunk fixed to snow
      const splitY = isGiant ? 28 : 22;
      ctx.drawImage(
        sprite,
        0, splitY, sprite.width, sprite.height - splitY,
        drawX, drawY + splitY, sprite.width, sprite.height - splitY
      );
      // Draw swayed upper canopy
      ctx.drawImage(
        sprite,
        0, 0, sprite.width, splitY,
        drawX + pixelSway, drawY, sprite.width, splitY
      );
    } else {
      ctx.drawImage(sprite, drawX, drawY);
    }

    // Warm campfire light bounce on tree side facing the fire
    if (hasFireGlow) {
      const glowAlpha = Math.min(0.35, fireIntensity * 0.4);
      ctx.fillStyle = `rgba(245, 158, 11, ${glowAlpha})`;
      const glowW = isGiant ? 10 : 8;
      const glowX = fireDir === 1 ? drawX + 4 : drawX + sprite.width - 4 - glowW;
      ctx.fillRect(glowX, drawY + (isGiant ? 22 : 18), glowW, isGiant ? 28 : 20);
    }

    // Specular frost sparkle on apex at high zoom
    if (zoom >= 1.5) {
      ctx.fillStyle = '#FFFFFF';
      const tipX = drawX + anchorX + pixelSway;
      const tipY = drawY + 2;
      ctx.fillRect(tipX, tipY, 1, 1);
    }

    ctx.restore();
  }

  // Draw Stations (Polar Outposts, Weather Cabins, Communication Relays matching Ref Screenshot 2)
  private drawStations(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    width: number,
    height: number,
    time: number,
    zoom: number = 1.0
  ) {
    STATIONS.forEach(st => {
      const sx = st.x * TILE_SIZE - cameraX;
      const sy = st.y * TILE_SIZE - cameraY;
      if (sx < -120 || sx > width + 120 || sy < -120 || sy > height + 120) return;

      ctx.save();
      // Ground shadow beneath outpost
      ctx.fillStyle = 'rgba(15, 23, 34, 0.45)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 18, 38, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Station cabin body: Insulated polar expedition bunker / heavy timber base
      ctx.fillStyle = '#1E2836'; // Dark foundation
      ctx.fillRect(sx - 32, sy - 20, 64, 36);
      ctx.fillStyle = '#2B394A'; // Outer insulated cladding
      ctx.fillRect(sx - 30, sy - 18, 60, 32);

      // Horizontal timber/panel grooves
      ctx.fillStyle = '#19222D';
      ctx.fillRect(sx - 30, sy - 10, 60, 2);
      ctx.fillRect(sx - 30, sy - 2, 60, 2);
      ctx.fillRect(sx - 30, sy + 6, 60, 2);

      // Sloped polar roof with thick snow pillow mantle (Ref Screenshot 2 & 3)
      ctx.fillStyle = '#1A232E'; // Roof overhang structure
      ctx.beginPath();
      ctx.moveTo(sx - 36, sy - 20);
      ctx.lineTo(sx, sy - 38);
      ctx.lineTo(sx + 36, sy - 20);
      ctx.closePath();
      ctx.fill();

      // Deep snow pillow covering the roof
      ctx.fillStyle = '#8FA6BC'; // Snow underside shadow
      ctx.beginPath();
      ctx.moveTo(sx - 37, sy - 21);
      ctx.lineTo(sx, sy - 40);
      ctx.lineTo(sx + 37, sy - 21);
      ctx.lineTo(sx + 35, sy - 26);
      ctx.lineTo(sx, sy - 45);
      ctx.lineTo(sx - 35, sy - 26);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#D6E6F4'; // Midtone snow
      ctx.beginPath();
      ctx.moveTo(sx - 35, sy - 24);
      ctx.lineTo(sx, sy - 43);
      ctx.lineTo(sx + 35, sy - 24);
      ctx.lineTo(sx + 33, sy - 28);
      ctx.lineTo(sx, sy - 47);
      ctx.lineTo(sx - 33, sy - 28);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FFFFFF'; // Sunlit snow crest
      ctx.beginPath();
      ctx.moveTo(sx - 33, sy - 27);
      ctx.lineTo(sx, sy - 46);
      ctx.lineTo(sx + 33, sy - 27);
      ctx.lineTo(sx + 31, sy - 30);
      ctx.lineTo(sx, sy - 49);
      ctx.lineTo(sx - 31, sy - 30);
      ctx.closePath();
      ctx.fill();

      // Reinforced airtight polar airlock door
      ctx.fillStyle = '#D97706'; // Warning orange door frame
      ctx.fillRect(sx - 8, sy - 2, 16, 16);
      ctx.fillStyle = '#1C1917';
      ctx.fillRect(sx - 6, sy, 12, 14);
      ctx.fillStyle = '#F59E0B'; // Small door porthole
      ctx.fillRect(sx - 2, sy + 2, 4, 4);

      // Warm glowing triple-pane windows with interior firelight (Ref Screenshot 2)
      const flicker = Math.sin(time * 0.008) * 0.08 + 0.92;
      // Left window
      ctx.fillStyle = '#1A212B';
      ctx.fillRect(sx - 25, sy - 14, 12, 10);
      ctx.fillStyle = `rgba(251, 191, 36, ${flicker})`;
      ctx.fillRect(sx - 24, sy - 13, 10, 8);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(sx - 22, sy - 11, 6, 4);

      // Right window
      ctx.fillStyle = '#1A212B';
      ctx.fillRect(sx + 13, sy - 14, 12, 10);
      ctx.fillStyle = `rgba(251, 191, 36, ${flicker})`;
      ctx.fillRect(sx + 14, sy - 13, 10, 8);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(sx + 16, sy - 11, 6, 4);

      // Tall communications & weather mast
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + 24, sy - 24);
      ctx.lineTo(sx + 24, sy - 58);
      ctx.lineTo(sx + 18, sy - 50);
      ctx.moveTo(sx + 24, sy - 58);
      ctx.lineTo(sx + 30, sy - 50);
      ctx.stroke();

      // Flashing red obstruction beacon
      const blink = Math.sin(time * 0.007) > 0.1;
      ctx.fillStyle = blink ? '#EF4444' : '#581C1C';
      ctx.beginPath();
      ctx.arc(sx + 24, sy - 60, 3, 0, Math.PI * 2);
      ctx.fill();

      // Chiral Network Uplink Beam if connected
      if (st.connected) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx + 24, sy - 60);
        ctx.lineTo(sx + 24, sy - 180);
        ctx.stroke();
      }

      // Station Callsign Plate
      ctx.fillStyle = '#0B111A';
      ctx.fillRect(sx - 34, sy + 18, 68, 14);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 34, sy + 18, 68, 14);
      ctx.fillStyle = '#E0F2FE';
      ctx.font = 'bold 9px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(st.callsign, sx, sy + 28);

      // Progressive LOD for Stations
      if (zoom >= 1.25) {
        // Icicles hanging along cabin roof eaves
        ctx.fillStyle = '#BAE6FD';
        ctx.fillRect(sx - 30, sy - 18, 2, 6);
        ctx.fillRect(sx - 18, sy - 18, 2, 4);
        ctx.fillRect(sx + 15, sy - 18, 2, 5);
        ctx.fillRect(sx + 28, sy - 18, 2, 7);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(sx - 30, sy - 18, 1, 4);
        ctx.fillRect(sx + 28, sy - 18, 1, 5);

        // Heavy steel corner brackets with bolts
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(sx - 32, sy - 18, 3, 4);
        ctx.fillRect(sx + 29, sy - 18, 3, 4);
        ctx.fillRect(sx - 32, sy + 10, 3, 4);
        ctx.fillRect(sx + 29, sy + 10, 3, 4);
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(sx - 31, sy - 17, 1, 1);
        ctx.fillRect(sx + 30, sy - 17, 1, 1);

        // Guy-wire antenna supports
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx + 24, sy - 52);
        ctx.lineTo(sx + 8, sy - 20);
        ctx.moveTo(sx + 24, sy - 52);
        ctx.lineTo(sx + 38, sy - 20);
        ctx.stroke();

        // Technical warning stencil
        ctx.fillStyle = '#F59E0B';
        ctx.font = '7px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ГОСТ-СЕВЕР [УЗЕЛ]', sx, sy - 3);

        if (zoom >= 1.7) {
          // Cozy window interior silhouettes: thermos kettle steam wisp & radio receiver dials
          ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
          ctx.fillRect(sx - 20, sy - 10, 3, 4); // Radio receiver
          ctx.fillRect(sx + 18, sy - 10, 2, 5); // Thermos
          // Window frost frame
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx - 24, sy - 13, 10, 8);
          ctx.strokeRect(sx + 14, sy - 13, 10, 8);
        }
      }

      ctx.restore();
    });
  }

  // Draw Player structures (Ladders, Ropes, Campfires, Beacons)
  private drawStructures(
    ctx: CanvasRenderingContext2D,
    structures: PlacedStructure[],
    cameraX: number,
    cameraY: number,
    time: number,
    zoom: number = 1.0
  ) {
    structures.forEach(struct => {
      const sx = struct.x * TILE_SIZE - cameraX;
      const sy = struct.y * TILE_SIZE - cameraY;

      ctx.save();
      if (struct.type === 'LADDER') {
        // Metallic extension ladder
        ctx.strokeStyle = '#F97316';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx - 6, sy - 18);
        ctx.lineTo(sx - 6, sy + 18);
        ctx.moveTo(sx + 6, sy - 18);
        ctx.lineTo(sx + 6, sy + 18);
        ctx.stroke();

        ctx.lineWidth = 2;
        for (let step = -14; step <= 14; step += 7) {
          ctx.beginPath();
          ctx.moveTo(sx - 6, sy + step);
          ctx.lineTo(sx + 6, sy + step);
          ctx.stroke();
        }
      } else if (struct.type === 'ROPE') {
        // Piton anchor + coiled rope
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(sx, sy - 12, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#EAB308';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 12);
        ctx.lineTo(sx, sy + 22);
        ctx.stroke();
      } else if (struct.type === 'CAMPFIRE') {
        // Natural mountain stone ring around campfire pit (Matching reference image)
        ctx.fillStyle = '#22303E';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 3, 13, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#18232E';
        ctx.fillRect(sx - 10, sy + 2, 4, 3);
        ctx.fillRect(sx + 6, sy + 2, 4, 3);
        ctx.fillRect(sx - 5, sy + 6, 4, 3);
        ctx.fillRect(sx + 2, sy + 6, 4, 3);
        ctx.fillRect(sx - 4, sy - 2, 4, 3);
        ctx.fillRect(sx + 2, sy - 2, 4, 3);
        ctx.fillStyle = '#475569';
        ctx.fillRect(sx - 9, sy + 2, 2, 1);
        ctx.fillRect(sx + 7, sy + 2, 2, 1);

        // Glowing charcoal ember bed
        ctx.fillStyle = '#7C2D12';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 2, 7, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(sx - 3, sy + 1, 3, 2);
        ctx.fillRect(sx + 1, sy + 2, 3, 2);

        // Crossed cedar/pine firewood logs
        ctx.fillStyle = '#26150F';
        ctx.fillRect(sx - 7, sy, 14, 3);
        ctx.fillRect(sx - 3, sy - 3, 5, 9);
        ctx.fillStyle = '#451A03';
        ctx.fillRect(sx - 6, sy + 1, 12, 1);

        // Multi-tier animated pixel flame tongues
        const flicker = Math.sin(time * 0.02) * 2;
        const flameHeight = 11 + Math.sin(time * 0.015) * 4;

        // Outer orange/red flame
        ctx.fillStyle = '#EA580C';
        ctx.beginPath();
        ctx.moveTo(sx - 6, sy + 2);
        ctx.lineTo(sx + 6, sy + 2);
        ctx.lineTo(sx + flicker, sy - flameHeight);
        ctx.closePath();
        ctx.fill();

        // Secondary flame tongue
        ctx.beginPath();
        ctx.moveTo(sx - 4, sy + 1);
        ctx.lineTo(sx + 2, sy + 1);
        ctx.lineTo(sx - 2 + flicker * 0.5, sy - flameHeight * 0.85);
        ctx.closePath();
        ctx.fill();

        // Inner bright amber/yellow flame
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.moveTo(sx - 4, sy + 1);
        ctx.lineTo(sx + 4, sy + 1);
        ctx.lineTo(sx + flicker * 0.7, sy - flameHeight * 0.7);
        ctx.closePath();
        ctx.fill();

        // Incandescent core
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.moveTo(sx - 2, sy);
        ctx.lineTo(sx + 2, sy);
        ctx.lineTo(sx + flicker * 0.3, sy - flameHeight * 0.4);
        ctx.closePath();
        ctx.fill();

        // Floating embers / sparks rising upward into the cold twilight air
        for (let i = 0; i < 5; i++) {
          const sparkTime = (time * 0.0018 + i * 0.22) % 1.0;
          const sparkY = sy - 2 - sparkTime * 32;
          const sparkX = sx + Math.sin(time * 0.005 + i * 2.1) * (3 + sparkTime * 10) + (sparkTime * 5);
          const sparkAlpha = Math.max(0, 1 - sparkTime);
          ctx.fillStyle = i % 2 === 0 ? `rgba(254, 240, 138, ${sparkAlpha})` : `rgba(249, 115, 22, ${sparkAlpha})`;
          ctx.fillRect(sparkX, sparkY, 1.5, 1.5);
        }

        // Multi-stage warm radial light glow
        const glowRad = 65 + Math.sin(time * 0.01) * 6;
        const grad = ctx.createRadialGradient(sx, sy, 3, sx, sy, glowRad);
        grad.addColorStop(0, 'rgba(251, 146, 60, 0.55)');
        grad.addColorStop(0.35, 'rgba(245, 158, 11, 0.25)');
        grad.addColorStop(0.75, 'rgba(234, 88, 12, 0.08)');
        grad.addColorStop(1, 'rgba(234, 88, 12, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, glowRad, 0, Math.PI * 2);
        ctx.fill();

        // Progressive LOD: Ember details and expedition kettle
        if (zoom >= 1.25) {
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(sx - 4, sy + 1, 2, 2);
          ctx.fillRect(sx + 3, sy, 2, 2);
          ctx.fillStyle = '#FEF08A';
          ctx.fillRect(sx - 1, sy + 1, 1, 1);

          if (zoom >= 1.7) {
            // Iron crossbar with hanging blackened expedition kettle
            ctx.strokeStyle = '#18181B';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx - 8, sy - 8);
            ctx.lineTo(sx + 8, sy - 8);
            ctx.moveTo(sx, sy - 8);
            ctx.lineTo(sx, sy - 4);
            ctx.stroke();

            // Cast iron kettle
            ctx.fillStyle = '#09090B';
            ctx.fillRect(sx - 3, sy - 4, 6, 4);
            ctx.fillStyle = '#27272A';
            ctx.fillRect(sx - 2, sy - 5, 4, 1);

            // Steam wisp from kettle spout
            const steamPhase = (time * 0.003) % 1;
            ctx.fillStyle = `rgba(241, 245, 249, ${Math.max(0, 0.5 - steamPhase * 0.5)})`;
            ctx.fillRect(sx + 3 + steamPhase * 2, sy - 6 - steamPhase * 5, 2, 2);
          }
        }
      } else if (struct.type === 'BEACON') {
        // Holographic warning signpost
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(sx - 1, sy - 14, 2, 18);
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(sx, sy - 16, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', sx, sy - 13);
      } else if (struct.type === 'SHELTER') {
        // Wooden frame with green thermal canvas bivouac
        ctx.fillStyle = '#3E2723';
        ctx.beginPath();
        ctx.moveTo(sx - 20, sy + 10);
        ctx.lineTo(sx, sy - 16);
        ctx.lineTo(sx + 20, sy + 10);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#4E342E';
        ctx.stroke();

        // Canvas canopy
        ctx.fillStyle = '#1B4332';
        ctx.beginPath();
        ctx.moveTo(sx - 18, sy + 8);
        ctx.lineTo(sx, sy - 14);
        ctx.lineTo(sx + 18, sy + 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2D6A4F';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Small warm stove / lantern inside
        const stoveGlow = 30 + Math.sin(time * 0.01) * 4;
        const stoveGrad = ctx.createRadialGradient(sx, sy + 2, 2, sx, sy + 2, stoveGlow);
        stoveGrad.addColorStop(0, 'rgba(251, 191, 36, 0.45)');
        stoveGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = stoveGrad;
        ctx.beginPath();
        ctx.arc(sx, sy + 2, stoveGlow, 0, Math.PI * 2);
        ctx.fill();

        // Protective radius ring (safe zone from wind/cold)
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(sx, sy, 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (struct.type === 'FLARE') {
        // Ground magnesium flare (intense red light that scares phantoms)
        ctx.fillStyle = '#7F1D1D';
        ctx.fillRect(sx - 2, sy - 6, 4, 10);

        // Brilliant magnesium flame
        const flarePulse = Math.sin(time * 0.03) * 3;
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(sx, sy - 7, 5 + flarePulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(sx, sy - 7, 2, 0, Math.PI * 2);
        ctx.fill();

        // Glowing red safety perimeter that repels phantoms
        const flareRad = 65 + Math.sin(time * 0.015) * 6;
        const fGrad = ctx.createRadialGradient(sx, sy - 7, 4, sx, sy - 7, flareRad);
        fGrad.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
        fGrad.addColorStop(0.7, 'rgba(239, 68, 68, 0.15)');
        fGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = fGrad;
        ctx.beginPath();
        ctx.arc(sx, sy - 7, flareRad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  // Draw Lost Cargo Container
  private drawLostContainer(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, zoom: number = 1.0) {
    ctx.save();
    // Metal shipping case
    ctx.fillStyle = '#D97706';
    ctx.fillRect(x - 7, y - 5, 14, 10);
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 7, y - 5, 14, 10);

    // Glowing blue beacon beam from container
    const beamAlpha = 0.3 + Math.sin(time * 0.005) * 0.2;
    ctx.fillStyle = `rgba(56, 189, 248, ${beamAlpha})`;
    ctx.fillRect(x - 1, y - 40, 2, 35);

    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(x - 2, y - 42, 4, 4);

    if (zoom >= 1.25) {
      // Corner black rubber shock bumpers
      ctx.fillStyle = '#18181B';
      ctx.fillRect(x - 7, y - 5, 2, 2);
      ctx.fillRect(x + 5, y - 5, 2, 2);
      ctx.fillRect(x - 7, y + 3, 2, 2);
      ctx.fillRect(x + 5, y + 3, 2, 2);

      // Metallic toggle latch
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(x - 1, y - 1, 2, 3);

      if (zoom >= 1.7) {
        // Digital blinking battery status led on container
        ctx.fillStyle = '#10B981';
        ctx.fillRect(x + 3, y - 3, 1, 1);
      }
    }

    ctx.restore();
  }

  // Draw Natural Resource Nodes in the Taiga
  private drawResourceNodes(
    ctx: CanvasRenderingContext2D,
    nodes: WorldResourceNode[],
    cameraX: number,
    cameraY: number,
    time: number,
    player: PlayerStats,
    zoom: number = 1.0
  ) {
    ctx.save();
    for (const node of nodes) {
      if (node.harvested) continue;
      const sx = node.x * TILE_SIZE - cameraX;
      const sy = node.y * TILE_SIZE - cameraY;
      const distToPlayer = Math.hypot(node.x - player.x, node.y - player.y);

      // Render resource pixel-art sprite according to type (Ref Screenshots 1, 2, 3)
      if (node.type === 'WOOD_PINE') {
        // Stack of Siberian pine/cedar logs with snow cover (Ref Screenshot 3)
        // Log 1 (Bottom)
        ctx.fillStyle = '#26160F';
        ctx.fillRect(sx - 9, sy - 3, 18, 6);
        ctx.fillStyle = '#3E2519';
        ctx.fillRect(sx - 8, sy - 2, 14, 4);
        // Cut end wood rings
        ctx.fillStyle = '#A88365';
        ctx.fillRect(sx + 5, sy - 3, 4, 6);
        ctx.fillStyle = '#6E4E36';
        ctx.fillRect(sx + 6, sy - 2, 2, 4);

        // Log 2 (Top)
        ctx.fillStyle = '#26160F';
        ctx.fillRect(sx - 7, sy - 8, 14, 6);
        ctx.fillStyle = '#4A2C1E';
        ctx.fillRect(sx - 6, sy - 7, 10, 4);
        ctx.fillStyle = '#A88365';
        ctx.fillRect(sx + 3, sy - 8, 4, 6);
        ctx.fillStyle = '#6E4E36';
        ctx.fillRect(sx + 4, sy - 7, 2, 4);

        // Snow dusting on logs
        ctx.fillStyle = '#DDE8F2';
        ctx.fillRect(sx - 7, sy - 9, 10, 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(sx - 5, sy - 10, 6, 1);
      } else if (node.type === 'CHAGA_HERB') {
        // Birch stump with dark velvety chaga polypore & red lingonberry sprigs (Ref Screenshot 1 & 4)
        // Birch stump
        ctx.fillStyle = '#F1F5F9';
        ctx.fillRect(sx - 5, sy - 8, 10, 11);
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(sx + 3, sy - 8, 2, 11);
        // Birch bark dark notches
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(sx - 5, sy - 5, 3, 2);
        ctx.fillRect(sx - 2, sy - 1, 3, 2);

        // Velvety black/dark-ochre Chaga fungus cluster
        ctx.fillStyle = '#140D07';
        ctx.beginPath();
        ctx.arc(sx + 3, sy - 4, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5A3415';
        ctx.fillRect(sx + 2, sy - 5, 2, 2);

        // Wild red tundra berries growing at stump base
        ctx.fillStyle = '#E11D48';
        ctx.fillRect(sx - 8, sy + 1, 3, 3);
        ctx.fillRect(sx + 5, sy + 2, 3, 3);
        ctx.fillStyle = '#FDA4AF';
        ctx.fillRect(sx - 7, sy + 1, 1, 1);
      } else if (node.type === 'SCRAP_METAL') {
        // Weathered polar alloy plate with rivets, rust & frost
        ctx.fillStyle = '#2A3644';
        ctx.fillRect(sx - 8, sy - 7, 16, 10);
        ctx.fillStyle = '#4A5B6E';
        ctx.fillRect(sx - 7, sy - 6, 14, 8);
        // Rust oxidation patches
        ctx.fillStyle = '#9A3412';
        ctx.fillRect(sx - 4, sy - 4, 6, 3);
        ctx.fillStyle = '#EA580C';
        ctx.fillRect(sx - 3, sy - 3, 3, 1);
        // Rivets
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(sx - 6, sy - 5, 1, 1);
        ctx.fillRect(sx + 5, sy - 5, 1, 1);
        ctx.fillRect(sx - 6, sy, 1, 1);
        ctx.fillRect(sx + 5, sy, 1, 1);
        // Frost edge
        ctx.fillStyle = 'rgba(241, 245, 249, 0.75)';
        ctx.fillRect(sx - 8, sy - 7, 16, 1);
      } else if (node.type === 'CHIRAL_RESIN') {
        // Glowing crystalline chiral cluster (Deep cyan & violet facets)
        const glow = Math.sin(time * 0.008) * 3;
        const crystalGrad = ctx.createRadialGradient(sx, sy - 2, 2, sx, sy - 2, 15 + glow);
        crystalGrad.addColorStop(0, 'rgba(56, 189, 248, 0.7)');
        crystalGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.35)');
        crystalGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = crystalGrad;
        ctx.beginPath();
        ctx.arc(sx, sy - 2, 15 + glow, 0, Math.PI * 2);
        ctx.fill();

        // Faceted crystal spikes
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.moveTo(sx - 1, sy - 14);
        ctx.lineTo(sx + 5, sy + 1);
        ctx.lineTo(sx - 6, sy + 1);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(sx - 1, sy - 14);
        ctx.lineTo(sx + 3, sy);
        ctx.lineTo(sx - 2, sy);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#C084FC';
        ctx.beginPath();
        ctx.moveTo(sx + 5, sy - 10);
        ctx.lineTo(sx + 9, sy + 2);
        ctx.lineTo(sx + 2, sy + 2);
        ctx.closePath();
        ctx.fill();

        // Chiral sparkle
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(sx - 1, sy - 14, 2, 2);
      } else if (node.type === 'COPPER_WIRE') {
        // Industrial copper wire coil spool
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(sx - 6, sy - 6, 12, 10);
        ctx.fillStyle = '#B45309';
        ctx.fillRect(sx - 4, sy - 5, 8, 8);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(sx - 3, sy - 4, 6, 6);
        ctx.fillStyle = '#FDE68A';
        ctx.fillRect(sx - 1, sy - 3, 2, 4);
      } else if (node.type === 'TAIGA_FUR') {
        // Arctic wolf/sable fur bundle with leather strap
        ctx.fillStyle = '#451A03';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 2, 8, 5, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9A3412';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 3, 6, 4, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 3, 3, 2, 0.15, 0, Math.PI * 2);
        ctx.fill();
        // Leather binding strap
        ctx.fillStyle = '#1C1917';
        ctx.fillRect(sx - 1, sy - 7, 2, 10);
      } else if (node.type === 'PARAFFIN_WAX') {
        // Insulated kerosene/paraffin expedition canister
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(sx - 5, sy - 8, 10, 10);
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(sx - 4, sy - 7, 8, 8);
        // Yellow caution band
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(sx - 4, sy - 4, 8, 2);
        // Brass cap
        ctx.fillStyle = '#B45309';
        ctx.fillRect(sx - 2, sy - 10, 4, 2);
      }

      // Scanner highlight or proximity prompt
      const isClose = distToPlayer < 2.5;
      const isScanned = player.scannerActive;

      if (isClose || isScanned) {
        // Glowing target ring
        ctx.strokeStyle = isClose ? '#F59E0B' : '#38BDF8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy - 2, 11, 0, Math.PI * 2);
        ctx.stroke();

        // Prompt tag if courier is within gathering distance
        if (isClose) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(sx - 36, sy - 26, 72, 14);
          ctx.strokeStyle = '#F59E0B';
          ctx.strokeRect(sx - 36, sy - 26, 72, 14);
          ctx.fillStyle = '#FEF08A';
          ctx.font = '9px "Share Tech Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`[F] ${node.name.split(' ')[0]}`, sx, sy - 16);
        }
      }
    }
    ctx.restore();
  }

  // Draw World NPCs (Taras, Stepan, Ulukitkan, Vera)
  private drawWorldNPCs(
    ctx: CanvasRenderingContext2D,
    npcs: WorldNPC[],
    cameraX: number,
    cameraY: number,
    time: number,
    player: PlayerStats,
    zoom: number = 1.0
  ) {
    ctx.save();
    for (const npc of npcs) {
      const sx = npc.x * TILE_SIZE - cameraX;
      const sy = npc.y * TILE_SIZE - cameraY;
      const distToPlayer = Math.hypot(npc.x - player.x, npc.y - player.y);

      // Pixel-art character sprite
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 6, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body (Winter Parka)
      ctx.fillStyle = npc.id === 'npc_taras' ? '#3B2F2F' : npc.id === 'npc_stepan' ? '#1E3A8A' : npc.id === 'npc_ulukitkan' ? '#5B21B6' : '#047857';
      ctx.fillRect(sx - 6, sy - 14, 12, 14);

      // Fur trim
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(sx - 7, sy - 15, 14, 3);
      ctx.fillRect(sx - 6, sy - 1, 12, 2);

      // Head / Ushanka Hat
      ctx.fillStyle = '#FED7AA'; // face
      ctx.fillRect(sx - 4, sy - 22, 8, 7);

      ctx.fillStyle = '#1C1917'; // Ushanka fur cap
      ctx.fillRect(sx - 6, sy - 27, 12, 6);
      ctx.fillRect(sx - 7, sy - 24, 3, 6);
      ctx.fillRect(sx + 4, sy - 24, 3, 6);

      // Eyes
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(sx - 2, sy - 19, 1, 2);
      ctx.fillRect(sx + 1, sy - 19, 1, 2);

      // Progressive LOD for NPCs
      if (zoom >= 1.25) {
        // Red star / polar badge on Ushanka
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(sx - 1, sy - 25, 2, 2);

        // Beard stubble or scarf
        if (npc.id === 'npc_taras' || npc.id === 'npc_stepan') {
          ctx.fillStyle = '#78716C';
          ctx.fillRect(sx - 3, sy - 16, 6, 2);
        } else {
          ctx.fillStyle = '#DC2626'; // Red wool scarf
          ctx.fillRect(sx - 4, sy - 16, 8, 2);
        }

        // Parka brass button toggles
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(sx - 1, sy - 11, 2, 2);
        ctx.fillRect(sx - 1, sy - 6, 2, 2);

        if (zoom >= 1.7) {
          // Goggle rim pushed up on ushanka forehead
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(sx - 3, sy - 23, 6, 1);
        }
      }

      // Animated breath vapor puff
      const breathPhase = (time * 0.002 + (npc.x % 5)) % 3;
      if (breathPhase < 1.4) {
        const bAlpha = Math.max(0, 0.5 - breathPhase * 0.3);
        ctx.fillStyle = `rgba(241, 245, 249, ${bAlpha})`;
        ctx.beginPath();
        ctx.arc(sx + 2 + breathPhase * 4, sy - 20 - breathPhase * 3, 2 + breathPhase * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Overhead Nameplate & Role
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(sx - 45, sy - 42, 90, 13);
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 45, sy - 42, 90, 13);
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 9px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${npc.portrait} ${npc.name}`, sx, sy - 33);

      // Interaction Prompt if Courier approaches
      if (distToPlayer < 3.2) {
        const pulse = Math.sin(time * 0.01) * 2;
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(sx - 38, sy - 60 + pulse, 76, 14);
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 9px "Share Tech Mono", monospace';
        ctx.fillText('[E] ПОГОВОРИТЬ', sx, sy - 50 + pulse);
      }
    }
    ctx.restore();
  }

  // Draw Holographic Waypoint Beacon for active exploration quest
  private drawQuestObjective(
    ctx: CanvasRenderingContext2D,
    target: { x: number; y: number; title: string } | null,
    cameraX: number,
    cameraY: number,
    time: number
  ) {
    if (!target) return;
    const sx = target.x * TILE_SIZE - cameraX;
    const sy = target.y * TILE_SIZE - cameraY;

    ctx.save();
    // Holographic vertical beacon pillar
    const beamGrad = ctx.createLinearGradient(sx, sy, sx, sy - 160);
    beamGrad.addColorStop(0, 'rgba(234, 179, 8, 0.7)');
    beamGrad.addColorStop(0.7, 'rgba(234, 179, 8, 0.2)');
    beamGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(sx - 3, sy - 160, 6, 160);

    // Expanding ground radar pulse ring
    const ringRad = ((time * 0.03) % 40);
    ctx.strokeStyle = `rgba(234, 179, 8, ${Math.max(0, 1 - ringRad / 40)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sx, sy, ringRad, ringRad * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Floating diamond indicator
    const diamondY = sy - 45 + Math.sin(time * 0.006) * 4;
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(sx, diamondY - 8);
    ctx.lineTo(sx + 7, diamondY);
    ctx.lineTo(sx, diamondY + 8);
    ctx.lineTo(sx - 7, diamondY);
    ctx.closePath();
    ctx.fill();

    // Objective text
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(sx - 50, diamondY - 24, 100, 13);
    ctx.strokeStyle = '#F59E0B';
    ctx.strokeRect(sx - 50, diamondY - 24, 100, 13);
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 9px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(target.title, sx, diamondY - 14);

    ctx.restore();
  }

  // Draw Anomalies (Frost Phantoms / BTs, Sinkhole Obelisks, Gravity Vortexes)
  private drawAnomaly(
    ctx: CanvasRenderingContext2D,
    anom: AnomalyEntity,
    x: number,
    y: number,
    time: number,
    player: PlayerStats,
    zoom: number = 1.0
  ) {
    ctx.save();

    if (anom.type === 'FROST_PHANTOM') {
      // Distance to player
      const dist = Math.hypot((anom.x - player.x) * TILE_SIZE, (anom.y - player.y) * TILE_SIZE);
      const isVisible = dist < 100 || player.scannerActive || anom.suspicion > 30;

      // 1. Permafrost Sinkhole & Monolith Obelisks (Directly matching Reference Screenshot 1)
      // Fractured permafrost ground depression
      ctx.fillStyle = 'rgba(15, 23, 34, 0.45)';
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 28, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Concentric cracked ice fissures surrounding the rift (Ref Screenshot 1)
      ctx.strokeStyle = '#9DB2A6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 24, 10, 0, 0, Math.PI * 2);
      ctx.ellipse(x, y + 14, 16, 7, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Pitch-black void core
      ctx.fillStyle = '#090A0D';
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 10, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sharp Jet-Black Monolith Obelisks protruding from the rift edge (Ref Screenshot 1)
      // Left monolith
      ctx.fillStyle = '#101418';
      ctx.fillRect(x - 18, y - 2, 4, 14);
      ctx.fillStyle = '#222A32';
      ctx.fillRect(x - 17, y, 2, 12);
      ctx.fillStyle = '#6E8192'; // Top bevel highlight
      ctx.fillRect(x - 18, y - 3, 4, 1);

      // Right monolith (taller)
      ctx.fillStyle = '#0D1114';
      ctx.fillRect(x + 15, y - 8, 5, 20);
      ctx.fillStyle = '#1E252C';
      ctx.fillRect(x + 16, y - 6, 3, 18);
      ctx.fillStyle = '#6E8192';
      ctx.fillRect(x + 15, y - 9, 5, 1);

      // Center-back small monolith
      ctx.fillStyle = '#13171C';
      ctx.fillRect(x - 4, y + 2, 3, 10);
      ctx.fillStyle = '#738698';
      ctx.fillRect(x - 4, y + 1, 3, 1);

      // Progressive LOD for Monoliths: Cyan Chiral Rune Fissures
      if (zoom >= 1.25) {
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(x - 17, y + 2, 1, 3);
        ctx.fillRect(x + 17, y - 2, 1, 4);
        ctx.fillRect(x + 18, y + 5, 1, 3);

        if (zoom >= 1.7) {
          // Floating obsidian micro-debris drifting around rift
          const debPhase = (time * 0.002) % 1;
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(x - 12 + Math.sin(time * 0.003) * 4, y + 10 - debPhase * 16, 2, 2);
          ctx.fillRect(x + 10 + Math.cos(time * 0.003) * 4, y + 8 - debPhase * 14, 2, 2);
        }
      }

      // 2. Suspended Phantom Entity
      if (isVisible) {
        const floatY = y + Math.sin(time * 0.003 + anom.pulseTimer) * 4;
        const alpha = Math.min(1, Math.max(0.25, (110 - dist) / 60));

        // Umbilical strand ascending into the blizzard sky (Death Stranding style)
        ctx.strokeStyle = `rgba(15, 23, 42, ${alpha * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, floatY - 14);
        ctx.bezierCurveTo(x + 12, floatY - 50, x - 12, floatY - 90, x, floatY - 140);
        ctx.stroke();

        // Dark phantom spectral silhouette
        ctx.fillStyle = `rgba(15, 23, 42, ${alpha * 0.9})`;
        // Head
        ctx.beginPath();
        ctx.arc(x, floatY - 12, 5, 0, Math.PI * 2);
        ctx.fill();

        // Slender torso & trailing wisps
        ctx.beginPath();
        ctx.moveTo(x - 4, floatY - 8);
        ctx.lineTo(x + 4, floatY - 8);
        ctx.lineTo(x + 2, floatY + 12);
        ctx.lineTo(x - 2, floatY + 12);
        ctx.closePath();
        ctx.fill();

        // Trailing dark mist wisps
        ctx.fillStyle = `rgba(2, 6, 23, ${alpha * 0.6})`;
        ctx.fillRect(x - 3, floatY + 12, 2, 4);
        ctx.fillRect(x + 1, floatY + 13, 2, 5);

        // If hunting / alert: glowing ruby eyes
        if (anom.suspicion > 35) {
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(x - 2, floatY - 13, 1, 1);
          ctx.fillRect(x + 1, floatY - 13, 1, 1);
        }
      }
    } else if (anom.type === 'GRAVITY_VORTEX') {
      // Swirling gravitational distortion vortex
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time * 0.004);
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = `rgba(147, 51, 234, ${0.4 + i * 0.15})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 10 + i * 7, i * 1.5, i * 1.5 + Math.PI * 0.8);
        ctx.stroke();
      }
      ctx.restore();
    } else if (anom.type === 'STATIC_DISCHARGE') {
      // Atmospheric blue electrical arcs
      if (Math.sin(time * 0.02 + anom.pulseTimer) > 0.7) {
        ctx.strokeStyle = '#60A5FA';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 10, y - 8);
        ctx.lineTo(x, y - 14);
        ctx.lineTo(x + 4, y - 2);
        ctx.lineTo(x + 12, y - 12);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // Draw Courier Player (Pixel-art courier in amber expedition parka matching Ref Screenshot 1 & 2)
  private drawCourier(
    ctx: CanvasRenderingContext2D,
    player: PlayerStats,
    cargo: CargoItem[],
    x: number,
    y: number,
    time: number,
    anomalies: AnomalyEntity[],
    zoom: number = 1.0
  ) {
    ctx.save();

    // Walking stride animation
    const speed = Math.hypot(player.vx, player.vy);
    const isMoving = speed > 0.05;
    const walkCycle = isMoving ? Math.sin(time * 0.015) : 0;

    // Center of Gravity tilt angle from player balance (-100 to 100)
    const tiltRad = (player.balance / 100) * 0.28;

    // Soft realistic shadow beneath courier (Ref Screenshot 2)
    ctx.fillStyle = 'rgba(20, 32, 48, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stumble warning jitter
    const shakeX = player.isStumbling ? (Math.random() * 4 - 2) : 0;
    const shakeY = player.isStumbling ? (Math.random() * 2 - 1) : 0;

    ctx.translate(x + shakeX, y + shakeY);
    ctx.rotate(tiltRad);

    // 1. Legs & Arctic Boots (Dark expedition trousers & heavy alpine tread)
    ctx.fillStyle = player.bootsIntegrity < 20 ? '#7F1D1D' : '#1A232E'; // Dark slate pants
    // Left leg
    ctx.fillRect(-6, 3 + walkCycle * 3, 4, 8);
    // Right leg
    ctx.fillRect(2, 3 - walkCycle * 3, 4, 8);

    // Deep-tread insulated winter boots with snow gaiters
    ctx.fillStyle = '#0F1620';
    ctx.fillRect(-7, 9 + walkCycle * 3, 6, 3);
    ctx.fillRect(1, 9 - walkCycle * 3, 6, 3);

    // Progressive LOD: Boots Crampons & reflective pants stripe
    if (zoom >= 1.25) {
      // Ice crampon steel spikes under soles
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-7, 12 + walkCycle * 3, 2, 1);
      ctx.fillRect(-3, 12 + walkCycle * 3, 2, 1);
      ctx.fillRect(1, 12 - walkCycle * 3, 2, 1);
      ctx.fillRect(5, 12 - walkCycle * 3, 2, 1);

      // Reflective safety stripes on pant legs
      ctx.fillStyle = '#E0F2FE';
      ctx.fillRect(-6, 6 + walkCycle * 3, 4, 1);
      ctx.fillRect(2, 6 - walkCycle * 3, 4, 1);
    }

    // 2. Courier Body & Expedition Parka (Warm Ochre/Amber Gold from Ref Screenshot 1)
    // Main parka torso
    ctx.fillStyle = '#D98F18'; // Rich amber ochre
    ctx.fillRect(-7, -10, 14, 14);
    // Parka shadow side
    ctx.fillStyle = '#A86A0E';
    ctx.fillRect(-7, -10, 3, 14);
    // Front zipper & storm flap
    ctx.fillStyle = '#1C1917';
    ctx.fillRect(-1, -10, 2, 14);

    // Progressive LOD: Parka chest pocket, climbing carabiner, and expedition patch
    if (zoom >= 1.25) {
      // Radio chest pocket & antenna
      ctx.fillStyle = '#92400E';
      ctx.fillRect(2, -7, 4, 5);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(4, -10, 1, 3); // Radio antenna

      // Climbing harness carabiner
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1;
      ctx.strokeRect(-5, 1, 3, 2);

      // "СЕВЕР" sleeve patch
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(-8, -6, 2, 3);

      if (zoom >= 1.7) {
        // Brass zipper pull tab
        ctx.fillStyle = '#FCD34D';
        ctx.fillRect(-1, -4, 2, 2);
        // Quilted baffle stitching
        ctx.fillStyle = '#B45309';
        ctx.fillRect(-6, -2, 12, 1);
        ctx.fillRect(-6, -6, 12, 1);
      }
    }

    // Thick white fur collar & hood trim (Ref Screenshot 1)
    ctx.fillStyle = '#CCD6E0'; // Fur collar underside shadow
    ctx.fillRect(-8, -11, 16, 4);
    ctx.fillStyle = '#F8FAFC'; // Crisp white fur
    ctx.fillRect(-8, -13, 16, 3);

    // 3. Courier Hood & Blizzard Goggles
    ctx.fillStyle = '#B47312'; // Amber hood
    ctx.fillRect(-5, -20, 10, 8);
    ctx.fillStyle = '#F8FAFC'; // Hood white fur rim
    ctx.fillRect(-6, -21, 12, 2);

    // Polarized Blizzard Visor / Goggles (Amber tint)
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(-4, -17, 8, 3);
    ctx.fillStyle = '#FEF08A'; // Glint reflection
    ctx.fillRect(-3, -17, 2, 1);

    if (zoom >= 1.25) {
      // Goggle black elastic strap wrapping around hood
      ctx.fillStyle = '#09090B';
      ctx.fillRect(-6, -17, 2, 2);
      ctx.fillRect(4, -17, 2, 2);
    }

    // 4. "Эхо-4" Odradek Mechanical Scanner on Left Shoulder
    this.drawScannerArm(ctx, player, -8, -14, time, anomalies, zoom);

    // 5. Stacked Cargo Containers on Backpack Frame
    this.drawCargoStack(ctx, cargo, walkCycle, zoom);

    // 6. Straps held by hands (Bracing visual)
    ctx.fillStyle = '#451A03';
    // Left strap
    ctx.fillRect(-7, -9, 2, 8);
    // Right strap
    ctx.fillRect(5, -9, 2, 8);

    // Insulated gloves gripping straps
    ctx.fillStyle = player.isBracingLeft ? '#38BDF8' : '#D98F18';
    ctx.fillRect(-8, -3, 3, 4);
    ctx.fillStyle = player.isBracingRight ? '#38BDF8' : '#D98F18';
    ctx.fillRect(5, -3, 3, 4);

    // Breath vapor puff in frosty taiga air
    if (!player.isHoldingBreath && Math.sin(time * 0.003) > 0.3) {
      ctx.fillStyle = 'rgba(241, 245, 249, 0.45)';
      ctx.beginPath();
      ctx.arc(6, -18, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Draw Odradek "Эхо-4" Shoulder Scanner
  private drawScannerArm(
    ctx: CanvasRenderingContext2D,
    player: PlayerStats,
    baseX: number,
    baseY: number,
    time: number,
    anomalies: AnomalyEntity[],
    zoom: number = 1.0
  ) {
    ctx.save();
    // Find closest Frost Phantom
    let nearestPhantom: AnomalyEntity | null = null;
    let minDist = 180; // detection range in pixels

    for (const anom of anomalies) {
      if (anom.type === 'FROST_PHANTOM') {
        const d = Math.hypot((anom.x - player.x) * TILE_SIZE, (anom.y - player.y) * TILE_SIZE);
        if (d < minDist) {
          minDist = d;
          nearestPhantom = anom;
        }
      }
    }

    // Arm joint
    ctx.fillStyle = '#334155';
    ctx.fillRect(baseX - 1, baseY, 3, 4);

    // Mechanical arm segment
    let sensorAngle = -Math.PI / 4;
    let sensorColor = '#38BDF8'; // Blue for safe
    let flapSpeed = 0.005;

    if (nearestPhantom) {
      // Turn towards phantom!
      const dx = (nearestPhantom.x - player.x) * TILE_SIZE;
      const dy = (nearestPhantom.y - player.y) * TILE_SIZE;
      sensorAngle = Math.atan2(dy, dx);
      if (minDist < 70) {
        sensorColor = '#EF4444'; // Red danger
        flapSpeed = 0.04;
      } else {
        sensorColor = '#F59E0B'; // Yellow warning
        flapSpeed = 0.02;
      }
    }

    // Arm line
    const armLen = 8;
    const endX = baseX + Math.cos(sensorAngle) * armLen;
    const endY = baseY + Math.sin(sensorAngle) * armLen;

    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Sensor head (three petals flapping like Odradek!)
    const flap = Math.sin(time * flapSpeed) * 0.4;
    ctx.fillStyle = sensorColor;

    ctx.save();
    ctx.translate(endX, endY);
    ctx.rotate(sensorAngle);

    // Center pivot
    ctx.fillRect(-2, -2, 4, 4);

    // Top petal
    ctx.fillRect(2, -4 - flap * 3, 5, 2);
    // Bottom petal
    ctx.fillRect(2, 2 + flap * 3, 5, 2);

    // Progressive LOD for Odradek
    if (zoom >= 1.25) {
      // Chrome hydraulic piston rod along the mechanical joint
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(0, -1, 3, 2);
      // Small status sensor lens
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(1, -1, 1, 1);
    }

    ctx.restore();
    ctx.restore();
  }

  // Draw Stack of Cargo Containers strapped on courier's back
  private drawCargoStack(ctx: CanvasRenderingContext2D, cargo: CargoItem[], walkCycle: number, zoom: number = 1.0) {
    if (cargo.length === 0) return;

    ctx.save();
    let currentY = -12;

    // Draw up to 5 containers stacked vertically
    const maxContainers = Math.min(5, cargo.length);
    for (let i = 0; i < maxContainers; i++) {
      const item = cargo[i];
      const boxHeight = 6;
      const boxWidth = 14 - i * 1.5;
      const boxX = -boxWidth / 2 + Math.sin(walkCycle * 0.5 + i) * 0.8;

      // Color based on category
      let boxColor = '#3B82F6';
      let tapeColor = '#1D4ED8';
      if (item.category === 'MEDICAL') {
        boxColor = '#FFFFFF';
        tapeColor = '#EF4444';
      } else if (item.category === 'RADIO_TUBES') {
        boxColor = '#F59E0B';
        tapeColor = '#B45309';
      } else if (item.category === 'ISOTOPE_BATTERY') {
        boxColor = '#10B981';
        tapeColor = '#047857';
      } else if (item.category === 'TAIGA_RATIONS') {
        boxColor = '#D97706';
        tapeColor = '#78350F';
      }

      // Main container
      ctx.fillStyle = boxColor;
      ctx.fillRect(boxX, currentY - boxHeight, boxWidth, boxHeight);

      // Warning / tape stripe
      ctx.fillStyle = tapeColor;
      ctx.fillRect(boxX + 2, currentY - boxHeight, 3, boxHeight);

      // Damaged condition visual
      if (item.currentIntegrity < 60) {
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(boxX + boxWidth - 3, currentY - boxHeight, 2, 2);
      }

      // Progressive LOD for cargo containers
      if (zoom >= 1.25) {
        // Rubber shock corners
        ctx.fillStyle = '#18181B';
        ctx.fillRect(boxX, currentY - boxHeight, 1, 1);
        ctx.fillRect(boxX + boxWidth - 1, currentY - boxHeight, 1, 1);
        ctx.fillRect(boxX, currentY - 1, 1, 1);
        ctx.fillRect(boxX + boxWidth - 1, currentY - 1, 1, 1);

        // Barcode / stencil label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillRect(boxX + boxWidth - 5, currentY - boxHeight + 2, 3, 2);

        if (zoom >= 1.7) {
          // Status battery LED on each container
          ctx.fillStyle = item.currentIntegrity > 50 ? '#10B981' : '#EF4444';
          ctx.fillRect(boxX + 1, currentY - boxHeight + 1, 1, 1);
        }
      }

      currentY -= boxHeight + 1;
    }

    // Nylon cargo tie-down strap running from top container to frame
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -10);
    ctx.lineTo(-2, currentY);
    ctx.lineTo(2, currentY);
    ctx.lineTo(6, -10);
    ctx.stroke();

    ctx.restore();
  }

  // Draw Dynamic Twilight Lighting Pass (Warm campfire bloom, lanterns, and cool mountain twilight)
  private drawDynamicLighting(
    ctx: CanvasRenderingContext2D,
    structures: PlacedStructure[],
    playerScreenX: number,
    playerScreenY: number,
    width: number,
    height: number,
    time: number,
    weather: WeatherState,
    cameraX: number,
    cameraY: number
  ) {
    ctx.save();

    // 1. Base Mountain Dusk / Twilight Ambient Layer
    const duskIntensity = weather.type === 'BLIZZARD' ? 0.18 : 0.28;
    ctx.fillStyle = `rgba(11, 25, 44, ${duskIntensity})`;
    ctx.fillRect(0, 0, width, height);

    // 2. Light sources punching warm illumination through the dusk
    // Campfires
    for (const struct of structures) {
      if (struct.type === 'CAMPFIRE') {
        const sx = struct.x * TILE_SIZE - cameraX;
        const sy = struct.y * TILE_SIZE - cameraY;
        if (sx >= -100 && sx <= width + 100 && sy >= -100 && sy <= height + 100) {
          const flicker = Math.sin(time * 0.012) * 5;
          const radius = 80 + flicker;
          const grad = ctx.createRadialGradient(sx, sy, 4, sx, sy, radius);
          grad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
          grad.addColorStop(0.25, 'rgba(251, 146, 60, 0.32)');
          grad.addColorStop(0.65, 'rgba(245, 158, 11, 0.12)');
          grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (struct.type === 'SHELTER') {
        const sx = struct.x * TILE_SIZE - cameraX;
        const sy = struct.y * TILE_SIZE - cameraY;
        if (sx >= -100 && sx <= width + 100 && sy >= -100 && sy <= height + 100) {
          const grad = ctx.createRadialGradient(sx, sy + 4, 4, sx, sy + 4, 45);
          grad.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
          grad.addColorStop(0.6, 'rgba(245, 158, 11, 0.1)');
          grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(sx, sy + 4, 45, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Subtle Courier expedition chest lamp / headlamp beam
    const headlampGrad = ctx.createRadialGradient(playerScreenX, playerScreenY, 4, playerScreenX, playerScreenY, 42);
    headlampGrad.addColorStop(0, 'rgba(224, 242, 254, 0.22)');
    headlampGrad.addColorStop(0.6, 'rgba(186, 230, 253, 0.08)');
    headlampGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
    ctx.fillStyle = headlampGrad;
    ctx.beginPath();
    ctx.arc(playerScreenX, playerScreenY, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Celestial Starry Sky with Milky Way galaxy, cosmic dust nebula and billowing twilight clouds (Matching reference image)
  private drawCelestialNightSky(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
    weatherType: WeatherType
  ) {
    ctx.save();

    // 1. Celestial Deep Indigo to Twilight Azure sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, width, height * 0.7);
    skyGrad.addColorStop(0, 'rgba(6, 19, 37, 0.42)');
    skyGrad.addColorStop(0.5, 'rgba(11, 29, 58, 0.28)');
    skyGrad.addColorStop(1, 'rgba(23, 59, 108, 0)');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height * 0.75);

    // 2. The Majestic Milky Way Galaxy Diagonal Band
    // Diagonal galactic dust band from top-left toward center-right
    ctx.save();
    ctx.rotate(-0.25);
    const galaxyGrad = ctx.createLinearGradient(0, -50, width * 1.2, height * 0.6);
    galaxyGrad.addColorStop(0, 'rgba(2, 132, 199, 0.08)');
    galaxyGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.16)');
    galaxyGrad.addColorStop(0.5, 'rgba(125, 211, 252, 0.22)');
    galaxyGrad.addColorStop(0.7, 'rgba(192, 132, 252, 0.12)');
    galaxyGrad.addColorStop(1, 'rgba(30, 58, 138, 0)');
    ctx.fillStyle = galaxyGrad;
    ctx.fillRect(-100, 20, width * 1.4, 75);

    // Dense core stardust ribbon
    ctx.fillStyle = 'rgba(224, 242, 254, 0.14)';
    ctx.fillRect(-80, 48, width * 1.3, 22);
    ctx.restore();

    // 3. Twinkling Alpine Star Pixels
    const starCount = weatherType === 'CLEAR_FROST' ? 65 : 35;
    for (let i = 0; i < starCount; i++) {
      // Deterministic positions based on index
      const sx = ((i * 137.5 + 43) % width);
      const sy = ((i * 83.7 + 17) % (height * 0.55));
      
      // Star twinkle animation
      const twinkle = Math.sin(time * 0.003 + i * 3.7) * 0.4 + 0.6;
      const size = (i % 7 === 0) ? 2 : 1;
      
      // Star color variation (pure white, cold cyan, faint amber)
      if (i % 5 === 0) {
        ctx.fillStyle = `rgba(186, 230, 253, ${0.8 * twinkle})`;
      } else if (i % 11 === 0) {
        ctx.fillStyle = `rgba(254, 240, 138, ${0.75 * twinkle})`;
      } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * twinkle})`;
      }
      ctx.fillRect(sx, sy, size, size);

      // Diamond cross sparkle on brightest stars
      if (i % 13 === 0 && twinkle > 0.85) {
        ctx.fillStyle = `rgba(224, 242, 254, ${0.5 * twinkle})`;
        ctx.fillRect(sx - 1, sy, 3, 1);
        ctx.fillRect(sx, sy - 1, 1, 3);
      }
    }

    // 4. Soft Billowing Twilight Cumulus Clouds (matching reference image)
    const drift = (time * 0.004) % (width + 300);
    for (let c = 0; c < 4; c++) {
      const cx = ((c * 180 + drift) % (width + 300)) - 150;
      const cy = 40 + (c * 25) % 80;
      const cloudGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 65);
      cloudGrad.addColorStop(0, 'rgba(98, 125, 152, 0.22)');
      cloudGrad.addColorStop(0.6, 'rgba(72, 101, 129, 0.14)');
      cloudGrad.addColorStop(1, 'rgba(72, 101, 129, 0)');
      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 75, 28, -0.05, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Alpine Valley Mist Layer
    const mistGrad = ctx.createLinearGradient(0, height * 0.5, 0, height);
    mistGrad.addColorStop(0, 'rgba(72, 101, 129, 0)');
    mistGrad.addColorStop(0.6, 'rgba(98, 125, 152, 0.08)');
    mistGrad.addColorStop(1, 'rgba(130, 154, 177, 0.14)');
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, height * 0.5, width, height * 0.5);

    ctx.restore();
  }

  // Draw Weather effects (Snow, Blizzard, Aurora Borealis, Extreme Cold, Magnetic Storm, Milky Way)
  private drawWeather(
    ctx: CanvasRenderingContext2D,
    weather: WeatherState,
    particles: { x: number; y: number; speed: number; size: number }[],
    width: number,
    height: number,
    time: number,
    zoom: number = 1.0
  ) {
    ctx.save();

    // 0. Celestial Milky Way & Mountain Clouds Night Sky (Matching reference image)
    if (weather.type === 'CLEAR_FROST' || weather.type === 'LIGHT_SNOW' || weather.type === 'ANOMALOUS_AURORA' || weather.type === 'EXTREME_COLD') {
      this.drawCelestialNightSky(ctx, width, height, time, weather.type);
    }

    // 1. Anomalous Aurora Borealis (Polar Lights)
    if (weather.type === 'ANOMALOUS_AURORA') {
      const auroraGrad = ctx.createLinearGradient(0, 0, width, height * 0.75);
      const shift = Math.sin(time * 0.001) * 0.15;
      auroraGrad.addColorStop(0, `rgba(16, 185, 129, ${0.22 + shift})`);
      auroraGrad.addColorStop(0.35, `rgba(139, 92, 246, ${0.18 - shift})`);
      auroraGrad.addColorStop(0.7, `rgba(236, 72, 153, ${0.12 + shift * 0.5})`);
      auroraGrad.addColorStop(1, 'rgba(6, 78, 59, 0)');

      ctx.fillStyle = auroraGrad;
      ctx.fillRect(0, 0, width, height);

      // Waving curtain ribbons
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.2)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let x = 0; x < width; x += 20) {
        const y = 60 + Math.sin(x * 0.01 + time * 0.0015) * 25 + Math.cos(x * 0.02 + time * 0.002) * 15;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 2. Magnetic Storm (Lightning discharges & electronic interference)
    if (weather.type === 'MAGNETIC_STORM') {
      // Periodic ambient flash
      const flashChance = Math.sin(time * 0.008);
      if (flashChance > 0.92) {
        ctx.fillStyle = 'rgba(224, 242, 254, 0.18)';
        ctx.fillRect(0, 0, width, height);
      }

      // Random electric lightning arc
      if (Math.sin(time * 0.015) > 0.88) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let lx = (Math.abs(Math.sin(time * 3)) * width);
        let ly = 0;
        ctx.moveTo(lx, ly);
        for (let seg = 0; seg < 6; seg++) {
          lx += (Math.sin(time + seg) - 0.5) * 50;
          ly += height / 6;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
      }

      // CRT Scanline glitch lines
      ctx.fillStyle = 'rgba(14, 165, 233, 0.06)';
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 1);
      }
    }

    // 3. Blizzard (Fierce whiteout veil + horizontal wind streaks)
    if (weather.type === 'BLIZZARD') {
      ctx.fillStyle = 'rgba(241, 245, 249, 0.32)';
      ctx.fillRect(0, 0, width, height);

      // Fast horizontal wind streaks
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 73 + time * 2.8) % (width + 60)) - 30;
        const sy = ((i * 47 + time * 1.2) % height);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 50, sy + 18);
        ctx.stroke();
      }
    }

    // 4. Heavy Snowfall (Dense soft flakes and muted atmosphere)
    if (weather.type === 'HEAVY_SNOWFALL') {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.12)';
      ctx.fillRect(0, 0, width, height);

      // Extra big slow fluffy flakes
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (let i = 0; i < 25; i++) {
        const fx = (i * 89 + Math.sin(time * 0.001 + i) * 20) % width;
        const fy = (i * 53 + time * 0.12) % height;
        ctx.beginPath();
        ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Extreme Cold (Cyan shivering haze)
    if (weather.type === 'EXTREME_COLD') {
      ctx.fillStyle = 'rgba(186, 230, 253, 0.08)';
      ctx.fillRect(0, 0, width, height);
    }

    // Standard Snow particles
    ctx.fillStyle = '#FFFFFF';
    for (const p of particles) {
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    ctx.restore();
  }

  // Screen-edge Frost Vignette when Courier is freezing or in severe cold
  private drawScreenFrost(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    warmth: number,
    weather: WeatherState
  ) {
    ctx.save();
    const isExtremeCold = weather.type === 'EXTREME_COLD';
    const isBlizzard = weather.type === 'BLIZZARD';

    // Cold rim border
    if (warmth < 60 || isBlizzard || isExtremeCold) {
      const coldIntensity = Math.max(0, (60 - warmth) / 60);
      const extraBoost = isExtremeCold ? 0.35 : isBlizzard ? 0.2 : 0;
      const rimAlpha = Math.min(0.85, 0.15 + coldIntensity * 0.5 + extraBoost);

      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.25,
        width / 2,
        height / 2,
        Math.min(width, height) * 0.65
      );
      grad.addColorStop(0, 'rgba(186, 230, 253, 0)');
      grad.addColorStop(0.75, `rgba(186, 230, 253, ${rimAlpha * 0.6})`);
      grad.addColorStop(1, `rgba(186, 230, 253, ${rimAlpha})`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Frost needle crystals along screen borders when freezing or in extreme cold
      if (warmth < 35 || isExtremeCold) {
        ctx.strokeStyle = 'rgba(240, 249, 255, 0.6)';
        ctx.lineWidth = 1;

        // Top edge needles
        for (let x = 0; x < width; x += 16) {
          const len = 8 + (Math.sin(x * 0.05) * 6);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + 4, len);
          ctx.lineTo(x + 8, 0);
          ctx.stroke();
        }

        // Bottom edge needles
        for (let x = 0; x < width; x += 16) {
          const len = 8 + (Math.cos(x * 0.05) * 6);
          ctx.beginPath();
          ctx.moveTo(x, height);
          ctx.lineTo(x + 4, height - len);
          ctx.lineTo(x + 8, height);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}
