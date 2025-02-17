vim.lsp.config['pyright'] = {
  filetypes = { "python" },
  root_dir = function(fname)
    return vim.lsp.util.root_pattern("pyproject.toml")(fname)
      or vim.lsp.util.root_pattern("setup.py")(fname)
      or vim.lsp.util.root_pattern("setup.cfg")(fname)
      or vim.lsp.util.root_pattern("requirements.txt")(fname)
      or vim.lsp.util.root_pattern("Pipfile")(fname)
      or vim.lsp.util.root_pattern("pyrightconfig.json")(fname)
      or vim.loop.cwd()
  end,
  settings = {
    python = {
      analysis = {
	autoSearchPaths = true,
	useLibraryCodeForTypes = true,
      },
    },
  },
}
