# Minimal replacement for oh-my-zsh's lib/spectrum.zsh.
# Populates associative arrays $FG and $BG for 256-color prompts:
#   %{$FG[040]%}green text%{$reset_color%}

typeset -AHg FG BG
for k in {000..255}; do
    FG[$k]="%{"$'\e'"[38;5;${k}m%}"
    BG[$k]="%{"$'\e'"[48;5;${k}m%}"
done
