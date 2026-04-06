
export PATH="$PATH:/opt/homebrew/bin"
if type brew &>/dev/null
then
	eval "$(brew shellenv)"
fi

if [ -f "$HOME/.lmstudio" ]; then
	# Added by LM Studio CLI (lms)
	export PATH="$PATH:$HOME/.lmstudio/bin"
fi

if [ -f "$HOME/.cargo/env" ]; then
    . "$HOME/.cargo/env"
fi

if [ -f "$HOME/packages/sdk/flutter" ]; then
	export PATH="$PATH:$HOME/packages/sdk/flutter/bin"
fi

if [ -f "$HOME/.volta" ]; then
	export VOLTA_HOME="$HOME/.volta"
	export PATH="$VOLTA_HOME/bin:$PATH"
fi

[[ -f "$HOME/.config/zsh/aliases" ]] && source "$HOME/.config/zsh/aliases"
