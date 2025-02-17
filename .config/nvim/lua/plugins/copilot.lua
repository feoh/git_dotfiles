return {
  "github/copilot.vim",
  cmd = "Copilot",
  build = ":Copilot auth",
  event = "BufWinEnter",
  init = function()
    vim.g.copilot_no_maps = true
  end,
  config = function()
    -- Block the normal Copilot suggestions
    vim.api.nvim_create_augroup("github_copilot", { clear = true })
    for _, event in pairs({ "FileType", "BufUnload", "BufEnter" }) do
      vim.api.nvim_create_autocmd({ event }, {
        group = "github_copilot",
        callback = function()
          vim.fn["copilot#On" .. event]()
        end,
      })
    end
  end,
}
