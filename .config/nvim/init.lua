require("config.lazy")
require("config.kickstart-lsp-config")

vim.cmd("colorscheme carbonfox")

-- Enable the LSPs!
vim.lsp.enable('luals', 'pyright', 'rust-analyzer')

