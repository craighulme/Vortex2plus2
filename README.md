# Vortex Web

Vortex Web is an unofficial browser client for Vortex. It started from the Vortex2+2 project, but the project is now being rebuilt as a cleaner extension-delivered web runtime.

The goal is to keep Vortex playable in the browser, support native-style multiplayer through a hosted relay, and build a modern runtime that can grow with future Vortex features such as streamed assets, richer avatars, equipment, physics, and safe game scripting.

This is not an official Vortex client.

## Direction

Vortex2+2 is being rebranded as Vortex Web.

The new direction is a browser-first Vortex client, not a web studio. The client should feel close to the native app where it matters, while taking advantage of web rendering, extension delivery, profile cosmetics, and future runtime APIs.

Version `0.5.0` is a major internal migration release. The old override-heavy layout is being replaced by a TypeScript/Vite runtime, generated static extension bundles, a WebGPU renderer path, and smaller services for engine, world, avatar, input, UI, multiplayer, diagnostics, and assets.

## What Works Today

- Browser play from supported Vortex game pages
- Hosted WebSocket relay support for native-style multiplayer
- Extension-managed launch flow with short-lived game authorisation
- Multiplayer chat, player replication, leaderboard, nameplates, and profile cosmetics
- Current map loading for supported Vortex games
- Avatar clothing support for existing shirt, pants, face, body type, and colour data
- WebGPU renderer path with older renderer code being phased out
- Cascaded shadow work with runtime quality controls
- Runtime settings menu, HUD, notifications, audio, pointer lock, and shortcut handling
- Command-gated browser tools for authorised users
- Built extension assets under `runtime/` and `extension/` so public installs do not need to run a build step

## Runtime Upgrade Progress

Vortex Web is being upgraded in stages so the browser client remains playable during the rewrite.

Moved into the new runtime:

- Single Vortex Web boot bundle loaded by the extension
- TypeScript services for renderer, world, input, local player movement, avatar, audio, chat, leaderboard, notifications, settings, diagnostics, and multiplayer relay handling
- WebGPU renderer path using the current Three.js WebGPU build
- Shadow service with quality presets and WebGPU-focused CSM work
- Runtime map bootstrap, world part normalisation, collider helpers, picking, and material handling
- Modern GLB avatar assets as the default runtime path
- Hosted relay broker and multiplayer message routing inside the web-client service layer
- Profile cosmetics, badges, name effects, nameplates, and leaderboard row styling
- Audio service for client sounds
- Runtime performance tools, renderer diagnostics, scene diagnostics, and FPS sampling
- Asset resolver and manifest structure for runtime-owned assets
- Early physics, SLIM, and streaming foundations for future production use
- Removal of the old public `overrides/` and `js/` source layout in favour of generated extension/runtime output

Still being migrated:

- Further cleanup of compatibility bridges left from the Vortex2+2 runtime
- More world batching, map chunking, collider generation, disposal, and streaming hooks
- Rapier-driven gameplay physics once movement parity is good enough
- Foot IK on a rig that supports it cleanly
- Avatar equipment slots for hats, masks, tools, shoes, back items, and held items
- Production SLIM-style LOD for meshes, repeated assets, streamed UGC, and map chunks
- Streamed UGC models/assets from future Vortex APIs
- Script package loading, a stable game API, and eventual Lua/WASM integration

The old 2+2-only hardcoded game systems are not the future direction. Future game-specific items, tools, UI, and behaviour should come through runtime APIs, streamed assets, equipment/attachment systems, and safe script packages.

## Multiplayer

The official Vortex app uses native networking. Browser extensions cannot use native UDP sockets directly, so Vortex Web uses a WebSocket relay model for browser multiplayer.

Public builds are designed around the hosted Vortex Web relay. Local relay mode exists for private development and testing, but it is not the normal public setup.

Hosted mode does not send your Vortex browser cookies or session token to Vortex Web servers. The extension uses your normal browser session locally to request a short-lived Vortex launch authorisation, then the hosted relay verifies that authorisation server-side.

## Access

Vortex Web browser multiplayer is license-gated while the project is still moving fast. For access, contact `quackduck.` on Discord.

Command access is feature-gated. Some commands are available to all licensed users, while advanced movement tools require extra authorisation. See [COMMANDS_README.md](COMMANDS_README.md).

## Installation

1. Download the latest release.
2. Unzip it.
3. Open `chrome://extensions`.
4. Enable developer mode.
5. Select `Load unpacked`.
6. Choose the folder containing this README.

## Troubleshooting

If the browser client stops loading, first reload the extension and refresh the Vortex game page. If the problem continues, disable other extensions that may be changing the same page.

If launch authorisation fails, the relay or license server may have rejected the request. Newer builds show the server reason where available.

For performance testing, launch from the game page with the normal Play in Web button. Reloading an already-running play page can drop the relay session.

If a game page shows the runtime but does not connect to multiplayer, return to the game page and launch again with the Play in Web button. The relay session is tied to the launch flow.

## Credits

- Native UDP protocol research and browser multiplayer bridge by [@craighulme23](https://github.com/craighulme23)
- Search engine originally created by enk, modified and used with permission
- Crossroads by Shedletsky
- SFOTH by Shedletsky
- Sword fight baseplate by Inuk
- Building game by Inuk
- Party.exe map by 8DSK
- Fencing map by Stickmasterluke

## Screenshots

Vortex Web Building game:

![Vortex Web Building game](https://i.imgur.com/SooHiwI.jpeg)

Sword fight on the heights:

![Sword fight on the heights](https://media.discordapp.net/attachments/1497640288687100115/1502972700874899556/image.png?ex=6a06ede7&is=6a059c67&hm=a74ea0a22261862d10508df7a5e77764839d42ed480882d742e39d35c1ca3dc8&=&format=webp&quality=lossless)
