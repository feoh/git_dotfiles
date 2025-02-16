-- Defined in init.lua
vim.lsp.config('*', {
  capabilities = {
    textDocument = {
      semanticTokens = {
        multilineTokenSupport = true,
      }
    }
  },
  root_markers = { '.git' },
})
-- Defined in ../lsp/clangd.lua
return {
  cmd = { 'clangd' },
  root_markers = { '.clangd', 'compile_commands.json' },
  filetypes = { 'c', 'cpp' },
}
-- Defined in init.lua
vim.lsp.config('clangd', {
  filetypes = { 'c' },
})
