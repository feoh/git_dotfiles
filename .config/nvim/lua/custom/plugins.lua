return function(use)
  use {"ellisonleao/glow.nvim"}
  use {'ixru/nvim-markdown'}
  use {'mfussenegger/nvim-dap'}
  use {'mfussenegger/nvim-dap-python'}
  use {'theHamsta/nvim-dap-virtual-text'}
  use { "rcarriga/nvim-dap-ui", requires = {"mfussenegger/nvim-dap"} }

  require('dap-python').setup('~/.virtualenvs/debugpy/bin/python')
  require("nvim-dap-virtual-text").setup {
    enabled = true,
    commented = true,
  }
  require("dapui").setup()

end


