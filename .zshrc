# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Set name of the theme to load --- if set to "random", it will
# load a random theme each time oh-my-zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes
# ZSH_THEME="robbyrussell"
ZSH_THEME="ys"

# Uncomment the following line to enable command auto-correction.
ENABLE_CORRECTION="true"

# Uncomment the following line to display red dots whilst waiting for completion.
# You can also set it to another string to have that shown instead of the default red dots.
# e.g. COMPLETION_WAITING_DOTS="%F{yellow}waiting...%f"
# Caution: this setting can cause issues with multiline prompts in zsh < 5.7.1 (see #5765)
COMPLETION_WAITING_DOTS="true"

# Uncomment the following line if you want to disable marking untracked files
# under VCS as dirty. This makes repository status check for large repositories
# much, much faster.
# DISABLE_UNTRACKED_FILES_DIRTY="true"

# Which plugins would you like to load?
# Standard plugins can be found in $ZSH/plugins/
# Custom plugins may be added to $ZSH_CUSTOM/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(git poetry ripgrep vi-mode virtualenv fzf tmux)

# ALWAYS tmux!!! :)
# But don't do this for remote (ssh) logins.
#
# N.B. Remember to export ZSH_TMUX_AUTOSTART=false before manually sourcing .zshrc
if [ -z "$SSH_CLIENT" ]; then
	export ZSH_TMUX_AUTOSTART=true
fi
export ZSH_TMUX_CONFIG=$HOME/.config/tmux/tmux.conf

# On OSX, Enable homebrew completions
if type brew &>/dev/null
then
	FPATH="$(brew --prefix)/share/zsh/site-functions:${FPATH}"
fi

# if [[ `uname -s` == "Darwin" ]]; then
# 	export FD_COMMAND="fd"
# else
# 	export FD_COMMAND="fdfind"
# fi
#

# No longer need above because fd now works as-is on Manjaro Linux
export FD_COMMAND="fd"

export FZF_DEFAULT_COMMAND="$FD_COMMAND . $HOME"
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND="$FD_COMMAND -t d . $HOME"

if [[ `uname -s` == "NetBSD" ]]; then
	export FZF_BASE="/usr/pkg/share/fzf"
fi
source $ZSH/oh-my-zsh.sh


source $HOME/.aliases

# Created by `pipx` on 2023-02-15 20:39:07
export PATH="$PATH:$HOME/.local/bin"
# Add my rando binaries dir :)
export PATH="$PATH:$HOME/bin"
# Cargo stuff!
export PATH="$PATH:$HOME/.cargo/bin"


# Activate 1password biometric auth
OP_BIOMETRIC_UNLOCK_ENABLED=true
if [ -f $HOME/.config/op/plugins.sh ]; then
	source $HOME/.config/op/plugins.sh
fi

# Neovim 4-evah!
export EDITOR=nvim
export VISUAL=nvim

# except on NetBSD where vim will have to do :)

if [[ `uname -s` == "NetBSD" ]]; then
	export EDITOR=vim
	export VISUAL=vim
fi

# Grudgingly going back to pyenv :)
export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"


# NVM gubbins!
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
