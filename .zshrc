# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Set name of the theme to load --- if set to "random", it will
# load a random theme each time oh-my-zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes
#ZSH_THEME="robbyrussell"
ZSH_THEME="fino-time"

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
plugins=(git poetry vi-mode virtualenv fzf gh kubectl helm uv aws docker)

# On OSX, Enable homebrew completions
if type brew &>/dev/null
then
	eval "$(brew shellenv)"
fi

# Some like Ubuntu are stupid and afraid of calling fd fd.
if [[ `whence -p fdfind` ]]; then
	export FD_COMMAND="fdfind"
else
	export FD_COMMAND="fd"
fi


export FZF_DEFAULT_COMMAND="$FD_COMMAND . $HOME"
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND="$FD_COMMAND -t d . $HOME"

# Stop whining at me and just auto update already oh my zsh! :)
zstyle ':omz:update' mode auto

if [[ `uname -s` == "NetBSD" ]]; then
	export FZF_BASE="/usr/pkg/share/fzf"
fi
source $ZSH/oh-my-zsh.sh


source $HOME/.config/zsh/aliases
source $HOME/.config/zsh/functions

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

# When in Rome - add snaps to path if on Ubuntu.
[[ -d /snap/bin ]] && export PATH=$PATH:/snap/bin



# NVM gubbins!
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Go Go Gadget RUST!
[[ -d $HOME/.cargo/env ]] && source "$HOME/.cargo/env"

# add Pulumi to the PATH if we can't install as a package.
if [ -d /home/feoh/.pulumi/bin ]; then
	export PATH=$PATH:/home/feoh/.pulumi/bin
fi


# Make my shell history be EVERYWHERE :)
if type atuin &>/dev/null
then
	eval "$(atuin init zsh)"
fi

# Stop bugging me about updates. JUST DOO EET!
export DISABLE_UPDATE_PROMPT=true

# Work schtuff.
AWS_REGION="us-east-1"
AWS_DEFAULT_REGION="us-east-1"

# Ungh. The pain. It burns. :) Only alias op to the Windows executable on WSL.
if [ -f /mnt/c/Users/feoh/AppData/Local/Microsoft/WinGet/Packages/AgileBits.1Password.CLI_Microsoft.Winget.Source_8wekyb3d8bbwe/op.exe ]; then
	alias op='/mnt/c/Users/feoh/AppData/Local/Microsoft/WinGet/Packages/AgileBits.1Password.CLI_Microsoft.Winget.Source_8wekyb3d8bbwe/op.exe'
fi

# # Under WSL, we KINDA have Wayland, but not really, and that blows up Neovim. Ungh. :)
# # Add an alias so if we actually WANT the pseudo wayland, we can haz.
#
# if [[ $(uname -r | grep "microsoft") ]] then
# 	unset WAYLAND_DISPLAY
# 	alias wway='export WAYLAND_DISPLAY=wayland-0'
# fi

# Todoist API key magic
# export TODOIST_API_KEY="$(op read 'op://private/Todoist API/credential')"

# golang! 
export PATH="$PATH:/usr/local/go/bin"


[ -s ~/.luaver/luaver ] && . ~/.luaver/luaver


# Added by LM Studio CLI (lms)
export PATH="$PATH:/Users/cpatti/.lmstudio/bin"
