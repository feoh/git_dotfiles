return function(use)
  use {'ellisonleao/glow.nvim'}
  use {'ixru/nvim-markdown'}
  use {'mfussenegger/nvim-dap'}
  use {'mfussenegger/nvim-dap-python'}
  use {'theHamsta/nvim-dap-virtual-text'}
  use {'rcarriga/nvim-dap-ui', requires = {"mfussenegger/nvim-dap"}}
  use {'Olical/conjure'}
  -- friendly-snippets
  use {'rafamadriz/friendly-snippets'}
  require("luasnip.loaders.from_vscode").lazy_load()

  require("custom.dap")
end


