# fino-time-feoh.zsh-theme  (standalone, no oh-my-zsh)
# Based on fino-time, with exit-status indicator after username.
# ✔ (green) = last command succeeded, ✘ (red) = failed.
#
# Requires (sourced by .zshrc before this file):
#   autoload -U colors && colors          # provides $reset_color, $fg, $terminfo
#   source ~/.config/zsh/spectrum.zsh     # provides $FG / $BG 256-color arrays
#   source ~/.config/zsh/git-prompt.zsh   # provides git_prompt_info

function virtualenv_info {
    [ $CONDA_DEFAULT_ENV ] && echo "($CONDA_DEFAULT_ENV) "
    [ $VIRTUAL_ENV ] && echo '('`basename $VIRTUAL_ENV`') '
}

function prompt_char {
    git branch >/dev/null 2>/dev/null && echo '⠠⠵' && return
    echo '○'
}

function box_name {
  local box="${SHORT_HOST:-$HOST}"
  [[ -f ~/.box-name ]] && box="$(< ~/.box-name)"
  echo "${box:gs/%/%%}"
}

setopt prompt_subst

# ---- Vi mode indicator (replaces omz vi-mode plugin) --------------------
# Shown on the right side of the prompt; empty in INSERT mode.
MODE_INDICATOR="%{$FG[208]%}[NORMAL]%{$reset_color%}"
_vi_mode_prompt=""

function zle-keymap-select {
    case $KEYMAP in
        vicmd)      _vi_mode_prompt="$MODE_INDICATOR" ;;
        main|viins) _vi_mode_prompt="" ;;
    esac
    zle reset-prompt
}
function zle-line-init   { _vi_mode_prompt=""; zle reset-prompt }
function zle-line-finish { _vi_mode_prompt="" }
zle -N zle-keymap-select
zle -N zle-line-init
zle -N zle-line-finish

RPROMPT='${_vi_mode_prompt}'

PROMPT="╭─%{$FG[040]%}%n%{$reset_color%}%(?.%{$FG[040]%} ✔.%{$FG[196]%} ✘)%{$reset_color%} %{$FG[239]%}at%{$reset_color%} %{$FG[033]%}\$(box_name)%{$reset_color%} %{$FG[239]%}in%{$reset_color%} %{$terminfo[bold]$FG[226]%}%~%{$reset_color%}\$(git_prompt_info) %D - %*
╰─\$(virtualenv_info)\$(prompt_char) "

ZSH_THEME_GIT_PROMPT_PREFIX=" %{$FG[239]%}on%{$reset_color%} %{$fg[255]%}"
ZSH_THEME_GIT_PROMPT_SUFFIX="%{$reset_color%}"
ZSH_THEME_GIT_PROMPT_DIRTY="%{$FG[202]%}✘✘✘"
ZSH_THEME_GIT_PROMPT_CLEAN="%{$FG[040]%}✔"
