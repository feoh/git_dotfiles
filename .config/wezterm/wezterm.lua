-- Pull in the wezterm API
local wezterm = require("wezterm")

-- This will hold the configuration.
local config = wezterm.config_builder()

config.font = wezterm.font("FiraCode Nerd Font")
config.font_size = 20

-- This is where you actually apply your config choices

-- For example, changing the color scheme:
-- config.color_scheme = "AdventureTime"
config.color_scheme = "Dark Pastel (Gogh)"

config.keys = {
	{ key = "l", mods = "ALT", action = wezterm.action.ShowLauncher },
}

if wezterm.target_triple == "x86_64-pc-windows-msvc" then
	-- WSL first please!
	config.default_prog = { "ubuntu" }
	config.launch_menu = {
		{
			args = { "ubuntu" },
		},
		{
			args = { "pwsh" },
		},
	}
end

local seen = {}
wezterm.on("window-focus-changed", function(window, pane)
	local wid = window:window_id()
	if not seen[wid] then
		seen[wid] = true
		window:maximize()
	end
end)

-- and finally, return the configuration to wezterm
return config
