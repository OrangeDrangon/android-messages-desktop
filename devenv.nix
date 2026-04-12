{ pkgs, lib, config, inputs, ... }:

{
  packages = [
    pkgs.gitFull
    pkgs.nixd
  ];

  languages.nix.enable = true;

  languages.javascript.enable = true;
  languages.javascript.pnpm.enable = true;
  languages.javascript.pnpm.install.enable = true;

  git-hooks.hooks = {
    prettier.enable = true;
  };
}
