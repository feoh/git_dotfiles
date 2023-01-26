
  require('dap-python').setup('~/.virtualenvs/debugpy/bin/python')
  require("nvim-dap-virtual-text").setup {
    enabled = true,
    commented = true,
  }
  require("dapui").setup()
