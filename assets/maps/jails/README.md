# RNK Patrol - Jail Map Assets

**IMPORTANT:** Place your jail map images here with the EXACT filenames listed below.
The module will NOT work without these map files!

## Required Files (10 Total)

| Filename | Jail Type | Size (pixels) | Description |
|----------|-----------|---------------|-------------|
| `dungeon.webp` | Medieval Dungeon | 2000 x 2000 | Classic stone dungeon with iron bars and torchlight |
| `barracks.webp` | City Guard Barracks | 2400 x 1800 | Military holding cells in the city guard station |
| `cavern.webp` | Underground Cavern | 2500 x 2500 | Natural cave used as a prison |
| `tower.webp` | Prison Tower | 1500 x 1500 | Tower with prison cells on multiple floors |
| `city_watch.webp` | City Watch Station | 2000 x 1600 | Official city watch holding cells |
| `castle.webp` | Castle Dungeon | 2800 x 2000 | Deep dungeon beneath the castle keep |
| `thieves_guild.webp` | Thieves Guild | 2200 x 2200 | Secret prison maintained by local thieves guild |
| `temple.webp` | Temple Prison | 1800 x 1800 | Sacred prison maintained by religious order |
| `military.webp` | Military Stockade | 2400 x 1600 | Military prison for deserters and war criminals |
| `ancient.webp` | Ancient Ruins | 2000 x 2000 | Forgotten prison in ancient ruins, repurposed |

## Image Specifications

- **Format:** WebP (`.webp`) for best compression and quality
- **Grid Size:** 100 pixels per square (standard Foundry grid)
- **Content:** Include visible cell/cage areas for prisoner placement
- **Style:** Dark, atmospheric prison environments

## Cell Placement Guide

Each jail has pre-configured cell locations. Design maps with cells/cages in these areas:

| Jail Type | # Cells | Layout |
|-----------|---------|--------|
| Dungeon | 8 | 2 columns (left and right sides) |
| Barracks | 6 | 2 rows at top |
| Cavern | 6 | Scattered throughout |
| Tower | 4 | Corners |
| City Watch | 8 | 2 columns (left and right walls) |
| Castle | 10 | 2 rows |
| Thieves Guild | 6 | Scattered |
| Temple | 6 | 2 rows |
| Military | 10 | 2 rows |
| Ancient | 6 | 2 rows |

## Usage

1. Add all 10 map files to this folder
2. Open Foundry VTT and enable the module
3. Go to **GM Hub > Jails** tab
4. Click **"Create All Jails"** to auto-generate all 10 jail scenes
5. Prisoners will be automatically teleported to available cells

## Quick Test

To test without custom maps, you can:
1. Create simple solid color images at the specified sizes
2. Name them according to the table above
3. Create the jails and verify the system works
4. Replace with proper maps later

## Troubleshooting

If jail creation fails:
- Verify filename is EXACTLY as listed (case-sensitive, underscores not dashes)
- Ensure the file is in WebP format
- Check the browser console (F12) for detailed error messages
- Verify file path: `modules/rnk-patrol/assets/maps/jails/[filename].webp`
