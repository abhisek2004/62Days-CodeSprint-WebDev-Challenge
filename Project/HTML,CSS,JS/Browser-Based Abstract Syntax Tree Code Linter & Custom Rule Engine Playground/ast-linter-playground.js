function runAstLint() {
  const status = document.getElementById("astStatus");
  status.textContent = "AST Rule Violation: Line 4 - Use of 'var' keyword disallowed by ESTree Visitor rule (no-var). Suggestion: Use 'const' or 'let'.";
}
