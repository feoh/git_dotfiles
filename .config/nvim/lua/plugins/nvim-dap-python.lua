return {
  'mfussenegger/nvim-dap-python',
  dependencies = {'mfussenegger/nvim-dap', 'theHamsta/nvim-dap-virtual-text'},
  config = function ()
    require("dap-python").setup("uv")
  end
}
