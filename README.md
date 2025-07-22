# 💬 Android Messages™ Desktop ![main status](https://github.com/LanikSJ/android-messages-desktop/actions/workflows/main.yml/badge.svg)

Run Android Messages as a desktop app, a la iMessage. For those of us that prefer not to have a browser tab always open for this sort of thing.

**Not affiliated with Google in any way. Android is a trademark of Google LLC.**

Inspired by:

- [Google Play Music Desktop Player](https://github.com/MarshallOfSound/Google-Play-Music-Desktop-Player-UNOFFICIAL-)
- [a Reddit post on r/Android](https://www.reddit.com/r/Android/comments/8shv6q/web_messages/e106a8r/)

**Important Note 1:** We currently have builds for Windows and macOS, and Linux. I test releases on Arch Linux and to a lesser degree Windows. I would love help testing in additional places.

**Important Note 2:** Neither the MacOS nor the Windows binaries are signed right now. I am willing to add this but I do not have the certificates required at this time.

## 📑 Table of Contents

- [📥 Install Anywhere](#-install-anywhere)
- [🐧 Install on Archlinux via AUR](#-install-on-archlinux-via-aur)
- [🍏 Install on MacOS via Homebrew](#-install-on-macos-via-homebrew)
- [🪟 Install on Windows via Scoop](#-install-on-windows-via-scoop)
- [🤝 Contributions](#-contributions)
- [💻 Developer Environment](#-developer-environment)
- [📄 License](#-license)

## 📥 Install Anywhere

Download your build from the [releases](https://github.com/LanikSJ/android-messages-desktop/releases/latest) page.
`paru -S android-messages-desktop-bin` or the relevant command in your aur helper.

## 🐧 Install on Archlinux via AUR

`paru -S android-messages-desktop-bin` or the relevant command in your aur helper.
`paru -S android-messages-desktop-bin` or the relevant command in your aur helper.

## 🍏 Install on MacOS via Homebrew

`brew install laniksj/tap/android-messages-plus`

## 🪟 Install on Windows via Scoop

`scoop bucket add extras && scoop install android-messages`

## 🤝 Contributions

The code is pretty ugly but getting better every day. Feel free to take a look.

Steps to contribute:

1. Fork
2. Clone
3. Edit
4. `yarn install` for dependencies
5. `yarn start` to build and run assuming you have electron installed.
6. Open a pull request when you think it is ready or for feedback during the dev process

## 💻 Developer Environment

The easiest way to get a developer environment up and running is using [devenv](https://devenv.sh).
It is just node and yarn though so any install of those should work at the end

## 📄 License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
