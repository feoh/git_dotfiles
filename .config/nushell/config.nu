# config.nu — ported from ~/.zshrc
# Loaded after env.nu, before login.nu.

# ---------- Core shell behavior ----------------------------------------
$env.config.buffer_editor = "nvim"
$env.config.edit_mode = "vi"           # zsh had `bindkey -v`
$env.config.show_banner = false

# Let starship own the entire prompt; suppress nu's default indicators
# (otherwise you get an extra `: ` appended after starship's `〉`).
$env.PROMPT_INDICATOR = ""
$env.PROMPT_INDICATOR_VI_INSERT = ""
$env.PROMPT_INDICATOR_VI_NORMAL = ""
$env.PROMPT_MULTILINE_INDICATOR = "::: "

# History — mirror SHARE_HISTORY / HIST_IGNORE_DUPS / large size
$env.config.history.max_size = 50000
$env.config.history.sync_on_enter = true   # like INC_APPEND_HISTORY + SHARE
$env.config.history.isolation = false      # share across sessions
# Nushell defaults to a sqlite history; keep it but bump size.

# Completion polish (closest equivalents to your zstyle bits)
$env.config.completions.case_sensitive = false
$env.config.completions.algorithm = "fuzzy"
$env.config.completions.partial = true
$env.config.completions.quick = true

# ---------- Aliases & user functions -----------------------------------
source ~/.config/nushell/aliases.nu
source ~/.config/nushell/functions.nu

# ---------- 1Password plugins ------------------------------------------
# zsh sourced ~/.config/op/plugins.sh, which is bash. Nushell can't source it
# directly. If you use op plugins from nu, run `op plugin init` and add the
# generated aliases here, or stay in zsh for those workflows.

# ---------- WSL: shim `op` to the Windows 1Password CLI ----------------
let op_exe = "/mnt/c/Users/feoh/AppData/Local/Microsoft/WinGet/Packages/AgileBits.1Password.CLI_Microsoft.Winget.Source_8wekyb3d8bbwe/op.exe"
if ($op_exe | path exists) {
    alias op = ^$op_exe
}

# ---------- Tool integrations (replace OMZ plugins) --------------------
# Most of these are wired up via vendor/autoload (see scripts below).
# atuin owns Ctrl-R; starship owns the prompt; uv ships completions.

# luaver is a bash-only thing; if you need it, run it from a bash subshell.
