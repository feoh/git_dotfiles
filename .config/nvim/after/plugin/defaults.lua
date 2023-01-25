-- nvim-dap debug key mappings
vim.keymap.set('n','<Leader>dc',function() require('dap').continue() end)
vim.keymap.set('n','<Leader>do',function() require('dap').step_over() end)
vim.keymap.set('n','<Leader>di',function() require('dap').step_into() end)
vim.keymap.set('n','<Leader>du',function() require('dap').step_out() end)
vim.keymap.set('n','<Leader>b',function() require('dap').toggle_breakpoint() end)
vim.keymap.set('n','<Leader>B',function() require('dap').set_breakpoint() end)
vim.keymap.set('n','<Leader>lp',function() require('dap').set_breakpoint(nil, nil, vim.fn.input('Log point message: ')) end)
vim.keymap.set('n','<Leader>dr',function() require('dap').repl.open() end)
vim.keymap.set('n','<Leader>dl',function() require('dap').run_last() end)
vim.keymap.set('n','<Leader>tm',function() require('dap-python').test_method() end)
vim.keymap.set('n','<Leader>dut',function() require("dapui").toggle() end)

-- Blogging
vim.keymap.set('i','<Leader>idt', "<cmd>pu=strftime('%Y-%m-%d %H:%M:%S')<CR>")

-- Options

-- Syntax highlight YAML front matter in Markdown files.
vim.o.vim_markdown_frontmatter = 1
