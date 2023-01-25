return function(use)
  use {"ellisonleao/glow.nvim"}
  use {'ixru/nvim-markdown'}
  use {'mfussenegger/nvim-dap'}
  use {'theHamsta/nvim-dap-virtual-text'}
  use {'mfussenegger/nvim-dap-python'}
  require("nvim-dap-virtual-text").setup {
    commented = true,
  }
  require('dap-python').setup('~/.virtualenvs/debugpy/bin/python')
end


