{ pkgs, lib, config, inputs, ... }:

{
  packages = [ 
    pkgs.gitFull
  ];

  languages.javascript.enable = true;
  languages.javascript.yarn.enable = true;
  languages.javascript.yarn.install.enable = true;
}
