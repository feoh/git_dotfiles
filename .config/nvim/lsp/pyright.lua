return {
  cmd = { 'pyright' },
  filetypes = { "python" },
  root_markers = {
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "requirements.txt",
    "Pipfile",
    "pyrightconfig.json",
  },
  settings = {
    python = {
      analysis = {
	autoSearchPaths = true,
	useLibraryCodeForTypes = true,
      },
    },
  },
}
