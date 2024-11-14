local wezterm = require("wezterm")

local config = wezterm.config_builder()

config.color_scheme = "Dracula"
config.font = wezterm.font("Firacode Nerd Font")
config.font_size = 18

print(config)
return config
