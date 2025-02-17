vim.lsp.config({
  cmd = { "pyright-langserver", "--stdio" },
  filetypes = { "python" },
  root_dir = function(fname)
    return util.find_git_ancestor(fname) or util.path.dirname(fname)
  end,
  settings = {
    python = {
      analysis = {
	autoSearchPaths = true,
	useLibraryCodeForTypes = true,
	diagnosticMode = "workspace",
	typeCheckingMode = "basic",
	stubPath = "/usr/lib/python3.9/site-packages",
      },
    },
  },
})
