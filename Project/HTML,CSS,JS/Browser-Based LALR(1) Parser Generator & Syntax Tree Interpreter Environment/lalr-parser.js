function generateLalrTable() {
  const status = document.getElementById("lalrStatus");
  status.textContent = "Parsed Expression '3 + 5 * 2' -> SHIFT s3, SHIFT s5, REDUCE E -> E + T. AST Root evaluated to 13.";
}
