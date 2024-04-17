vim.opt.textwidth = 80
vim.opt.wrapmargin = 78
vim.opt.colorcolumn = '+1'

-- Spelling
vim.opt_local.spell = true
vim.opt_local.spelllang = 'en_us'
vim.opt_local.spellfile = vim.fn.stdpath 'config' .. '/spell/en.utf-8.add'
