echo "==zshenv=="
if [ -f "$HOME/.cargo/env" ]; then
. "$HOME/.cargo/env"
fi

# RUST RUST RUSTY RUST YAY!
[[ -f "$HOME/.cargo/env" ]] && . "$HOME/.cargo/env"

export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"

[[ -f "$HOME/.config/zsh/aliases" ]] && source "$HOME/.config/zsh/aliases"
