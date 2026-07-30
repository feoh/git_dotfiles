# Safe, static zsh completion for pi.
# This is sourced after compinit from ~/.zshrc instead of being added to fpath,
# so it cannot affect completion for unrelated commands.

_pi_completion() {
  emulate -L zsh

  local cur prev cmd word
  cur=${words[CURRENT]}
  prev=${words[CURRENT-1]}

  local -a commands global_opts install_opts remove_opts update_opts list_opts config_opts
  local -a modes levels providers tools source_prefixes

  commands=(install remove uninstall update list config)
  modes=(text json rpc)
  levels=(off minimal low medium high xhigh max)
  providers=(google anthropic openai azure-openai deepseek nvidia gemini groq cerebras xai fireworks together openrouter ai-gateway zai zai-coding-cn mistral minimax moonshot opencode kimi cloudflare xiaomi aws-bedrock ollama openai-codex claude-bridge)
  tools=(read bash edit write grep find ls ask_question)
  source_prefixes=('npm:' 'git:' 'git:github.com/' 'git:git@github.com:' 'https://github.com/' 'ssh://git@github.com/')

  global_opts=(
    --provider --model --api-key --system-prompt --append-system-prompt
    --mode --print -p --continue -c --resume -r --session --session-id
    --fork --session-dir --no-session --name -n --models --no-tools -nt
    --no-builtin-tools -nbt --tools -t --exclude-tools -xt --thinking
    --extension -e --no-extensions -ne --skill --no-skills -ns
    --prompt-template --no-prompt-templates -np --theme --no-themes
    --no-context-files -nc --export --list-models --verbose --approve -a
    --no-approve -na --offline --help -h --version -v
    --mcp-config --no-lens --no-lsp --no-autoformat --immediate-format
    --no-autofix --no-tests --no-delta --lens-guard --no-opengrep
    --no-read-guard --no-lens-context --lens-turn-summary
  )
  install_opts=(-l --local -a --approve -na --no-approve -h --help)
  remove_opts=(-l --local -a --approve -na --no-approve -h --help)
  update_opts=(--self --extensions --all --extension -a --approve -na --no-approve --force -h --help)
  list_opts=(-a --approve -na --no-approve -h --help)
  config_opts=(-l --local -a --approve -na --no-approve -h --help)

  # Complete @file message arguments.
  if [[ $cur == @* ]]; then
    compset -P @
    _files
    return
  fi

  # Complete values for options that take arguments.
  case $prev in
    --mode)
      compadd -a modes; return ;;
    --thinking)
      compadd -a levels; return ;;
    --provider)
      compadd -a providers; return ;;
    --tools|-t|--exclude-tools|-xt)
      compadd -a tools; return ;;
    --session|--fork|--extension|-e|--skill|--prompt-template|--theme|--export|--append-system-prompt|--mcp-config)
      _files; return ;;
    --session-dir)
      _directories; return ;;
    --model|--models|--api-key|--system-prompt|--session-id|--name|-n|--list-models)
      return ;;
  esac

  # Identify the first pi subcommand, if any.
  cmd=''
  for word in ${words[2,$(( CURRENT - 1 ))]}; do
    case $word in
      install|remove|uninstall|update|list|config)
        cmd=$word
        break
        ;;
    esac
  done

  case $cmd in
    install)
      if [[ $cur == -* ]]; then compadd -- $install_opts; else compadd -a source_prefixes; _files; fi
      ;;
    remove|uninstall)
      if [[ $cur == -* ]]; then compadd -- $remove_opts; else compadd npm: git: git:github.com/; fi
      ;;
    update)
      if [[ $cur == -* ]]; then compadd -- $update_opts; else compadd pi self; fi
      ;;
    list)
      [[ $cur == -* ]] && compadd -- $list_opts
      ;;
    config)
      [[ $cur == -* ]] && compadd -- $config_opts
      ;;
    *)
      if [[ $cur == -* ]]; then
        compadd -- $global_opts
      else
        compadd -- $commands
        compadd -- $global_opts
      fi
      ;;
  esac
}

compdef _pi_completion pi
