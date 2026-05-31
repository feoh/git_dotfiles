# Standalone replacement for oh-my-zsh's git_prompt_info.
# Provides:
#   git_prompt_info  — echoes the current branch wrapped in
#                      $ZSH_THEME_GIT_PROMPT_{PREFIX,SUFFIX,DIRTY,CLEAN}
#
# Honors:
#   ZSH_THEME_GIT_PROMPT_PREFIX
#   ZSH_THEME_GIT_PROMPT_SUFFIX
#   ZSH_THEME_GIT_PROMPT_DIRTY
#   ZSH_THEME_GIT_PROMPT_CLEAN
#   DISABLE_UNTRACKED_FILES_DIRTY=true   (skip untracked check, faster)
#
# Uses zsh's built-in vcs_info under the hood — no forks per prompt for
# the branch name, single `git status` for dirty detection.

autoload -Uz vcs_info
zstyle ':vcs_info:*' enable git
zstyle ':vcs_info:git:*' formats '%b'
zstyle ':vcs_info:git:*' actionformats '%b|%a'

_git_dirty() {
    local flags=('--porcelain')
    if [[ "${DISABLE_UNTRACKED_FILES_DIRTY:-false}" == true ]]; then
        flags+=('--untracked-files=no')
    fi
    if [[ -n $(command git status ${flags} 2>/dev/null | head -n1) ]]; then
        echo "${ZSH_THEME_GIT_PROMPT_DIRTY}"
    else
        echo "${ZSH_THEME_GIT_PROMPT_CLEAN}"
    fi
}

git_prompt_info() {
    vcs_info
    [[ -z "${vcs_info_msg_0_}" ]] && return
    local dirty
    dirty=$(_git_dirty)
    print -n -- "${ZSH_THEME_GIT_PROMPT_PREFIX}${vcs_info_msg_0_}${dirty}${ZSH_THEME_GIT_PROMPT_SUFFIX}"
}

# Hook so vcs_info refreshes on every prompt.
autoload -Uz add-zsh-hook
add-zsh-hook precmd vcs_info
