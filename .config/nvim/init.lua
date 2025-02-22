require("config.lazy")
require("config.kickstart-lsp-config")

vim.cmd("colorscheme carbonfox")

require('lualine').setup()

-- Enable the LSPs!
vim.lsp.enable({'luals', 'basedpyright', 'rust-analyzer'})

