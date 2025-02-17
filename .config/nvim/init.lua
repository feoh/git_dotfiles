require("config.lazy")

vim.cmd("colorscheme carbonfox")

-- Enable the LSPs!
vim.lsp.enable('luals', 'pyright', 'rust-analyzer')

