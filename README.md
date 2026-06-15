# Vortex2+2
Vortex2+2 is an extension for [Vortex](https://playvortex.io/) to add many more features.
Please join the [Vortex2+2 & AIS discord server](https://discord.gg/3Rphp3duKR) to get early releases and sneak peaks, and submit suggestions for vortex2+2 and AIS!

## Browser play

This fork injects a `Play in Browser` button on `https://playvortex.io/games/{id}`. The button fetches the normal Vortex launch token with your existing browser login and opens the Vortex2+2 browser client.

The official app now uses UDP for live multiplayer. Browser extensions cannot open UDP sockets, so live Vortex multiplayer uses a small local WebSocket-to-UDP relay.

Setup:

```bat
Register-NativeBridgeProtocol.cmd
Start-NativeBridge.cmd
```

`Register-NativeBridgeProtocol.cmd` registers `v22bridge://`, which lets the extension start the relay automatically. `Start-NativeBridge.cmd` starts the same relay manually. The relay does not launch or inject the native Vortex app; it verifies the short-lived browser launch token and talks to the current Vortex UDP server directly.

The relay URL is `ws://127.0.0.1:27822/ws`. The extension popup should use that URL for live multiplayer.

Credits:
- Native UDP protocol research and browser multiplayer bridge by [@craighulme23](https://github.com/craighulme23)
- Search engine originally created by enk, modified and used with permission
- Maps:
- Crossroads by Shedletsky
- SFOTH by Shedletsky
- Sword fight baseplate by Inuk
- Building game by Inuk
- Party.exe map by 8DSK
- Fencing map by Stickmasterluke

current features are:
- Clean custom dark ui
- Map loader
- Normal mapping
- Shadows
- Custom games
- Multiplayer health and sword system
- Multiplayer building game

**If you encounter any issues with Vortex2+2 breaking the game,**
**please check if you have any other extentions installed and disable them.**
**If not, it's probably a vortex update and you should wait until a new release is out**

installation:
1. download the latest release
2. unzip it
3. go to chrome://extensions
4. enable developer mode
5. press 'load unpacked' and select the folder containing this file!

Vortex2+2 Building game:

![Vortex2+2 Building game](https://i.imgur.com/SooHiwI.jpeg)


Sword fight on the heights:

![Sword fight on the heights](https://media.discordapp.net/attachments/1497640288687100115/1502972700874899556/image.png?ex=6a06ede7&is=6a059c67&hm=a74ea0a22261862d10508df7a5e77764839d42ed480882d742e39d35c1ca3dc8&=&format=webp&quality=lossless)


If you like vortex2+2 please consider starring this github and sharing this with your friends!
