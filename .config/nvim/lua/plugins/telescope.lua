-- plugins/telescope.lua:
return {
  'nvim-telescope/telescope.nvim', tag = '0.1.8',
  dependencies = {
    'nvim-lua/plenary.nvim',
     {
       'nvim-telescope/telescope-fzf-native.nvim',
       build = 'make',
       -- installed and loaded.
       cond = function()
         return vim.fn.executable 'make' == 1
       end,
     },
    { 'nvim-telescope/telescope-ui-select.nvim' },
    { 'echasnovski/mini.icons', version = '*' },
  }
}
