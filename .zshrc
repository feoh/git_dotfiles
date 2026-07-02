# ~/.zshrc — bespoke, no oh-my-zsh.
# Backup of the previous OMZ-based rc is at ~/.zshrc.omz-backup-YYYYMMDD.

# ---------- Core zsh options ---------------------------------------------
set -o vi
autoload -U colors && colors            # $fg, $bg, $reset_color, $terminfo
autoload -Uz compinit && compinit       # completion system
setopt prompt_subst                     # allow $(funcs) in PROMPT
setopt interactive_comments             # allow # comments at the prompt

# History
HISTFILE=~/.zsh_history
HISTSIZE=50000
SAVEHIST=50000
setopt SHARE_HISTORY HIST_IGNORE_DUPS HIST_IGNORE_SPACE HIST_REDUCE_BLANKS \
       EXTENDED_HISTORY INC_APPEND_HISTORY

# Completion polish (the bits OMZ's completion.zsh gave you)
zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}' 'r:|=*' 'l:|=* r:|=*'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*:descriptions' format '%F{yellow}-- %d --%f'
zstyle ':completion:*:warnings'     format ''   # silence "no matches" / "not a git repository"
zstyle ':completion:*:messages'     format ''   # silence completer info messages (e.g. _git's "not a git repository")

# Make `config` (dotfiles bare-repo alias) get git completion without
# tripping "not a git repository" on the host cwd.
compdef config=git

# Vi mode (replaces OMZ vi-mode plugin)
bindkey -v
export KEYTIMEOUT=1

# ---------- Prompt / theme -----------------------------------------------
source $HOME/.config/zsh/spectrum.zsh
source $HOME/.config/zsh/git-prompt.zsh
source $HOME/.config/zsh/themes/fino-time-feoh.zsh-theme

# ---------- Shell functions ---------------------------------------------
source $HOME/.config/zsh/functions

# ---------- Tool integrations (replace OMZ plugins) ----------------------
# fd binary name differs on Debian/Ubuntu
if (( ${+commands[fdfind]} )); then
    export FD_COMMAND="fdfind"
else
    export FD_COMMAND="fd"
fi

# fzf: keybindings + fuzzy completion (replaces omz fzf plugin)
export FZF_DEFAULT_COMMAND="$FD_COMMAND . $HOME"
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND="$FD_COMMAND -t d . $HOME"
_feoh_setup_fzf

# Native completions for the tools whose OMZ plugins were completion-only
(( ${+commands[gh]} ))      && eval "$(gh completion -s zsh)"
(( ${+commands[helm]} ))    && source <(helm completion zsh)
(( ${+commands[uv]} ))      && eval "$(uv generate-shell-completion zsh)"
(( ${+commands[kubectl]} )) && source <(kubectl completion zsh)
(( ${+commands[docker]} ))  && {
    # Docker ships completions; just make sure compinit can find them.
    fpath+=(/usr/share/zsh/vendor-completions /usr/share/zsh/site-functions)
}
# aws v2 completer (replaces omz aws plugin completer)
if (( ${+commands[aws_completer]} )); then
    autoload -U +X bashcompinit && bashcompinit
    complete -C aws_completer aws
fi

# atuin owns Ctrl-R (must come AFTER fzf so it wins the binding)
(( ${+commands[atuin]} )) && eval "$(atuin init zsh)"

# ---------- Your aliases -------------------------------------------------
source $HOME/.config/zsh/aliases

# ---------- PATH & environment -------------------------------------------
export PATH="$PATH:$HOME/.local/bin"          # pipx
export PATH="$PATH:$HOME/bin"                 # personal scripts

export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"

[[ -d /snap/bin ]] && export PATH="$PATH:/snap/bin"
[[ -d $HOME/.pulumi/bin ]] && export PATH="$PATH:$HOME/.pulumi/bin"

# 1Password biometric auth + plugins
export OP_BIOMETRIC_UNLOCK_ENABLED=true
[[ -f $HOME/.config/op/plugins.sh ]] && source $HOME/.config/op/plugins.sh

# For SDF NetBSD systems
if [[ $(uname -s) == "NetBSD" ]]; then
    export EDITOR=vim VISUAL=vim
    export FZF_BASE="/usr/pkg/share/fzf"
else
    export EDITOR=nvim VISUAL=nvim
fi

# AWS defaults
export AWS_REGION="us-east-1"
export AWS_DEFAULT_REGION="us-east-1"

# luaver
[[ -s ~/.luaver/luaver ]] && . ~/.luaver/luaver

# Pi LLM interface 
# Always write sessions to "$HOME/.pi/sessions"
export PI_AGENT_SESSIONS_DIR="$HOME/.pi/sessions"

# Always exit .zshrc cleanly so the first prompt's %(?...) isn't poisoned
# by a short-circuited `&&` on the last line above.
true
