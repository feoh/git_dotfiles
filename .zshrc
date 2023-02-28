# Add Linux when I have time :)
if [[ `uname` == "Darwin" ]]; then
	source /opt/homebrew/share/antigen/antigen.zsh
else
	source /usr/local/share/antigen.zsh
fi



antigen bundle git
# TODO: Something is breaking around ZSH_CACHE_DIR still saying robbyrussell. Ungh.
# antigen bundle poetry
antigen bundle ripgrep
antigen bundle vi-mode
antigen bundle virtualenv
antigen bundle fzf
antigen bundle heroku

antigen theme tonyseek/oh-my-zsh-seeker-theme seeker
antigen use oh-my-zsh
antigen apply

export FZF_DEFAULT_COMMAND="fd . $HOME"
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND="fd -t d . $HOME"

source $HOME/.aliases

# Created by `pipx` on 2023-02-15 20:39:07
export PATH="$PATH:$HOME/.local/bin"

