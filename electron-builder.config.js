const FLATPAK_RUNTIME_VERSION = process.env.FLATPAK_RUNTIME_VERSION || "25.08";

module.exports = {
  appId: "pw.kmr.amd",
  artifactName: "${productName}-v${version}-${os}-${arch}.${ext}",
  productName: "Android Messages",
  copyright: "Copyright 2026 OrangeDrangon",
  files: ["app/**/*", "resources/**/*"],
  directories: {
    buildResources: "resources",
    output: "dist",
  },
  publish: [
    {
      provider: "github",
      releaseType: "draft",
    },
  ],
  linux: {
    target: ["AppImage", "deb", "pacman", "rpm", "freebsd", "zip"],
    executableName: "AndroidMessages",
    category: "Network",
    desktop: {
      entry: {
        Name: "Android Messages Desktop",
        StartupWMClass: "AndroidMessages",
      },
    },
  },
  flatpak: {
    base: "org.electronjs.Electron2.BaseApp",
    baseVersion: FLATPAK_RUNTIME_VERSION,
    runtime: "org.freedesktop.Platform",
    runtimeVersion: FLATPAK_RUNTIME_VERSION,
    sdk: "org.freedesktop.Sdk",
    finishArgs: [
      "--share=ipc",
      "--socket=x11",
      "--socket=wayland",
      "--socket=pulseaudio",
      "--share=network",
      "--device=dri"
    ],
     desktop: {
      entry: {
        Name: "Android Messages",
        Comment: "Android Messages as a desktop app",
        StartupWMClass: "android-messages-desktop",
     },
    },   
  },   
  win: {
    target: ["nsis", "portable"],
  },
  mac: {
    category: "public.app-category.social-networking",
    target: { target: "default", arch: "universal" },
  },
  portable: {
    artifactName: "${productName}-v${version}-${os}-${arch}.portable.${ext}",
  },
  nsis: {
    allowToChangeInstallationDirectory: true,
    oneClick: false,
  },
};
