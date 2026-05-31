# env.nu — ported from ~/.zshenv + PATH bits of ~/.zshrc
# Loaded before config.nu and login.nu

# ---------- PATH --------------------------------------------------------
# Use a helper closure to prepend/append while skipping non-existent dirs.
def --env path-add [dir: string, --prepend (-p)] {
    let p = ($dir | path expand)
    if ($p | path exists) {
        $env.PATH = (
            $env.PATH
            | split row (char esep)
            | where { |x| $x != $p }
            | (if $prepend { prepend $p } else { append $p })
        )
    }
}

# Homebrew (mac/linuxbrew). If present, run its shellenv-equivalent.
path-add --prepend "/opt/homebrew/bin"
if (which brew | is-not-empty) {
    # Mirror `brew shellenv` for the common vars.
    let brew_prefix = (brew --prefix | str trim)
    $env.HOMEBREW_PREFIX = $brew_prefix
    $env.HOMEBREW_CELLAR = $"($brew_prefix)/Cellar"
    $env.HOMEBREW_REPOSITORY = $brew_prefix
    path-add --prepend $"($brew_prefix)/bin"
    path-add --prepend $"($brew_prefix)/sbin"
}

# LM Studio
path-add $"($env.HOME)/.lmstudio/bin"

# Rust / cargo
path-add $"($env.HOME)/.cargo/bin"

# Flutter
path-add $"($env.HOME)/packages/sdk/flutter/bin"

# Volta (Node toolchain). zshrc had a buggy `-f` test for a directory; fix it.
let volta_home = $"($env.HOME)/.volta"
if ($volta_home | path exists) {
    $env.VOLTA_HOME = $volta_home
    path-add --prepend $"($volta_home)/bin"
}

# pipx / personal scripts
path-add $"($env.HOME)/.local/bin"
path-add $"($env.HOME)/bin"

# snap
path-add "/snap/bin"

# Pulumi
path-add $"($env.HOME)/.pulumi/bin"

# ---------- Editor ------------------------------------------------------
if ((uname | get kernel-name) == "NetBSD") {
    $env.EDITOR = "vim"
    $env.VISUAL = "vim"
    $env.FZF_BASE = "/usr/pkg/share/fzf"
} else {
    $env.EDITOR = "nvim"
    $env.VISUAL = "nvim"
}

# ---------- AWS ---------------------------------------------------------
$env.AWS_REGION = "us-east-1"
$env.AWS_DEFAULT_REGION = "us-east-1"

# ---------- 1Password ---------------------------------------------------
$env.OP_BIOMETRIC_UNLOCK_ENABLED = "true"

# ---------- fd / fzf defaults ------------------------------------------
$env.FD_COMMAND = (if (which fdfind | is-not-empty) { "fdfind" } else { "fd" })
$env.FZF_DEFAULT_COMMAND = $"($env.FD_COMMAND) . ($env.HOME)"
$env.FZF_CTRL_T_COMMAND  = $env.FZF_DEFAULT_COMMAND
$env.FZF_ALT_C_COMMAND   = $"($env.FD_COMMAND) -t d . ($env.HOME)"
