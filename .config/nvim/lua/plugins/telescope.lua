-- plugins/telescope.lua:
return {
  'nvim-telescope/telescope.nvim', tag = '0.1.8',
  dependencies = {
    'nvim-lua/plenary.nvim',
     {
       'nvim-telescope/telescope-fzf-native.nvim',
     },
    { 'nvim-telescope/telescope-ui-select.nvim' },
    { 'echasnovski/mini.icons', version = '*' },
  }
}
