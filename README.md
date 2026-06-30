# Vortex Web

Vortex Web is my unofficial browser client for Vortex.

This started as Vortex2+2, but I am slowly turning it into its own cleaner web client. It is a hobby project, not an official Vortex release, and it is still changing a lot.

The basic idea is simple: keep Vortex playable from the browser, keep multiplayer working through a hosted relay, and move the old hacked-together client code into a proper runtime that is easier to maintain.

## What This Is

- An unofficial Chrome/Edge extension for playing Vortex in the browser
- A rewrite/refactor of the old Vortex2+2 browser client
- A WebGPU/Three.js runtime experiment for making the browser client feel better over time
- A place to test web-only extras like profile cosmetics, nameplates, badges, themes, and better in-game UI

## What This Is Not

- It is not made by the official Vortex team
- It is not finished

## What this might get:
- It may feature tools to publish/streamline assets such as: UGC, Maps, Content and maybe even a studio in the future.

## Current State

The extension can launch supported Vortex games in the browser and connect through the hosted Vortex Web relay. The client now uses a bundled TypeScript/Vite runtime instead of the old pile of order-dependent override scripts.

Some of the bigger things that are in right now:

- Browser game launch from supported Vortex pages
- Hosted relay multiplayer
- Chat, leaderboard, notifications, and player list UI
- Profile cosmetics, badges, name gradients, nameplates, and in-game leaderboard styling
- WebGPU renderer path
- Runtime settings menu with graphics, audio, controls, and dev tools
- Theme editing for site/runtime styling experiments
- Map loading, chunk visibility work, runtime diagnostics, and performance tools
- Modern GLB avatar path as the main direction
- Early foundations for physics, asset streaming, SLIM-style optimisation, and scripting

Some things are still rough or unfinished:

- Rapier physics is not the main movement controller yet
- Foot IK is disabled until the avatar rig is good enough
- UGC/accessory support is planned but not done
- Some compatibility bridge code still exists while the old runtime is being replaced
- The scripting/game API work is only preparation right now
- WebGPU shadows and renderer settings are still being tuned

## Multiplayer

Browser extensions cannot directly use the same native networking path as the desktop app, so Vortex Web uses a hosted WebSocket relay.

Hosted mode does not send your Vortex browser cookies or session token to my servers. The extension uses your normal browser session locally to request a short-lived launch authorisation, then the relay verifies that authorisation server-side.

Local relay support is mostly for development. Public builds are intended to use the hosted relay.

## Access

Multiplayer access is currently license-gated because the project is still moving fast and the relay is privately hosted.

For access, contact `quackduck.` on Discord.

Some browser/dev tools are feature-gated. See [COMMANDS_README.md](COMMANDS_README.md) if you are testing those.

## Installing

1. Download the latest build or clone the repo.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable developer mode.
4. Click `Load unpacked`.
5. Select the project folder.
6. Go to a supported Vortex game page and use the Play in Web button.

The checked-in `runtime/` and `extension/` files are built so normal testers do not need to run `npm run build`.

## Troubleshooting

If a game does not connect to multiplayer, go back to the game page and launch again with Play in Web. Refreshing the play page directly can lose the relay launch session.

If the client stops loading after an update, reload the extension and refresh the Vortex page.

If a page looks wrong, another extension may be changing the same page. Ad blockers can also block some of the normal Vortex site scripts, although that is not usually fatal.

For performance testing, launch normally through the game page. Testing from a refreshed play URL can give misleading results.

If you are using FireFox, Linux or Chromium Browsers please refer to your browser flags/settings as you may need to enable WebGPU mode specifically on those browsers. Otherwise you may not be able to use this, or will suffer massive performance loss.

## Development Direction

The long-term direction is to remove the remaining old Vortex2+2-style compatibility code and keep moving systems into the Vortex Web runtime.

Things I want the runtime to support eventually:

- Better avatar equipment and UGC-style attachments
- Streamed meshes, textures, sounds, and game assets
- Better map chunking, culling, instancing, and SLIM-style LOD
- Rapier-backed physics where it makes sense
- A safe game scripting API, with Lua/WASM as a possible later layer
- More customisable site and in-game themes
- Cleaner profile and community features for Vortex Web users

The old hardcoded 2+2 game modes and one-off features are not the direction anymore. Future game-specific tools, UI, items, and behaviour should come from proper runtime APIs and streamed game data.

## Credits

- Native UDP protocol research and browser multiplayer bridge by [@craighulme23](https://github.com/craighulme23)
- Assistance from [@Inuk84](https://github.com/inuk84)
- Search engine originally created by enk, modified and used with permission

## Media (Will add later)